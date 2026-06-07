import threading
import bcrypt
import psycopg2
from flask import Blueprint, request, jsonify
from database import get_db, row_as_dict
from auth import solo_admin, token_requerido

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.route("/partido", methods=["POST"])
@solo_admin
def crear_partido():
    datos = request.get_json()
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO partidos
              (equipo_local, equipo_visita, fecha, fase, bandera_local, bandera_visita,
               grupo, imagen_estadio, nombre_estadio)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            datos["equipo_local"], datos["equipo_visita"],
            datos["fecha"], datos.get("fase", "Grupos"),
            datos.get("bandera_local", ""), datos.get("bandera_visita", ""),
            datos.get("grupo", ""), datos.get("imagen_estadio"), datos.get("nombre_estadio", "")
        ))
        pid = cur.fetchone()["id"]
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Partido creado", "id": pid}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/partido/<int:partido_id>", methods=["PUT"])
@solo_admin
def editar_partido(partido_id):
    datos          = request.get_json()
    equipo_local   = datos.get("equipo_local", "").strip()
    equipo_visita  = datos.get("equipo_visita", "").strip()
    fecha          = datos.get("fecha")
    if not equipo_local or not equipo_visita or not fecha:
        return jsonify({"error": "Faltan campos obligatorios"}), 400

    fase           = datos.get("fase", "Grupos")
    bandera_local  = datos.get("bandera_local", "")
    bandera_visita = datos.get("bandera_visita", "")
    grupo          = datos.get("grupo", "")
    finalizado     = bool(datos.get("finalizado", False))
    goles_local    = datos.get("goles_local", 0)
    goles_visita   = datos.get("goles_visita", 0)
    nombre_estadio = datos.get("nombre_estadio", "")
    tiene_imagen   = "imagen_estadio" in datos

    try:
        conn = get_db()
        cur  = conn.cursor()
        sets = ("equipo_local=%s, equipo_visita=%s, bandera_local=%s, bandera_visita=%s,"
                "fecha=%s, fase=%s, grupo=%s, finalizado=%s, goles_local=%s, goles_visita=%s,"
                "nombre_estadio=%s")
        values = [equipo_local, equipo_visita, bandera_local, bandera_visita,
                  fecha, fase, grupo, finalizado, goles_local, goles_visita, nombre_estadio]
        if tiene_imagen:
            sets  += ", imagen_estadio=%s"
            values.append(datos["imagen_estadio"])
        values.append(partido_id)
        cur.execute(f"UPDATE partidos SET {sets} WHERE id=%s", values)
        if cur.rowcount == 0:
            return jsonify({"error": "Partido no encontrado"}), 404

        if finalizado:
            cur.execute("SELECT * FROM apuestas WHERE id_partido = %s", (partido_id,))
            ganador_real = "local" if goles_local > goles_visita else ("visita" if goles_visita > goles_local else "empate")
            for ap in cur.fetchall():
                gl_ap, gv_ap = ap["goles_local_apostado"], ap["goles_visita_apostado"]
                ganador_ap = "local" if gl_ap > gv_ap else ("visita" if gv_ap > gl_ap else "empate")
                pts = 3 if (gl_ap == goles_local and gv_ap == goles_visita) else (1 if ganador_ap == ganador_real else 0)
                cur.execute("UPDATE apuestas SET puntos=%s WHERE id=%s", (pts, ap["id"]))

        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Partido actualizado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/partido/<int:partido_id>", methods=["DELETE"])
@solo_admin
def eliminar_partido(partido_id):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("DELETE FROM partidos WHERE id = %s", (partido_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Partido no encontrado"}), 404
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Partido eliminado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/resultado/<int:partido_id>", methods=["PUT"])
@solo_admin
def ingresar_resultado(partido_id):
    datos        = request.get_json()
    goles_local  = datos["goles_local"]
    goles_visita = datos["goles_visita"]
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE partidos SET goles_local=%s, goles_visita=%s, finalizado=TRUE WHERE id=%s
        """, (goles_local, goles_visita, partido_id))
        cur.execute("SELECT * FROM apuestas WHERE id_partido = %s", (partido_id,))
        ganador_real = "local" if goles_local > goles_visita else ("visita" if goles_visita > goles_local else "empate")
        for ap in cur.fetchall():
            gl_ap, gv_ap = ap["goles_local_apostado"], ap["goles_visita_apostado"]
            ganador_ap = "local" if gl_ap > gv_ap else ("visita" if gv_ap > gl_ap else "empate")
            pts = 3 if (gl_ap == goles_local and gv_ap == goles_visita) else (1 if ganador_ap == ganador_real else 0)
            cur.execute("UPDATE apuestas SET puntos=%s WHERE id=%s", (pts, ap["id"]))
        conn.commit()
        cur.close(); conn.close()
        # Notificar a apostadores en background (no bloquea la respuesta)
        threading.Thread(
            target=_notificar_resultado, args=(partido_id,), daemon=True
        ).start()
        return jsonify({"mensaje": "Resultado ingresado y puntos calculados"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _notificar_resultado(partido_id):
    try:
        from notifications import notify_result_to_all
        notify_result_to_all(partido_id)
    except Exception as e:
        print(f"[admin] _notificar_resultado: {e}")


@admin_bp.route("/campeon-real", methods=["PUT"])
@solo_admin
def definir_campeon_real():
    datos        = request.get_json()
    campeon_real = datos.get("campeon")
    if not campeon_real:
        return jsonify({"error": "Debes indicar el campeón"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("UPDATE apuesta_campeon SET puntos_campeon=5 WHERE LOWER(campeon)=LOWER(%s)", (campeon_real,))
        cur.execute("UPDATE apuesta_campeon SET puntos_campeon=0 WHERE LOWER(campeon)!=LOWER(%s)", (campeon_real,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": f"Campeón {campeon_real} registrado. Puntos asignados."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/usuarios", methods=["GET"])
@solo_admin
def listar_usuarios():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT id, nombre, email, rol, foto_perfil FROM usuarios ORDER BY id ASC")
        usuarios = cur.fetchall()
        cur.close(); conn.close()
        return jsonify([dict(u) for u in usuarios])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/usuario", methods=["POST"])
@solo_admin
def crear_usuario():
    datos    = request.get_json()
    nombre   = datos.get("nombre", "").strip()
    email    = datos.get("email",  "").strip().lower()
    password = datos.get("password", "")
    rol      = datos.get("rol", "usuario")
    if not nombre or not email or not password:
        return jsonify({"error": "Nombre, email y contraseña son obligatorios"}), 400
    if rol not in ("usuario", "admin"):
        return jsonify({"error": "Rol inválido"}), 400
    hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO usuarios (nombre, email, password, rol) VALUES (%s, %s, %s, %s) RETURNING id",
            (nombre, email, hash_pw, rol)
        )
        uid = cur.fetchone()["id"]
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Usuario creado correctamente", "id": uid}), 201
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está registrado"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/usuario/<int:uid>", methods=["PUT"])
@solo_admin
def editar_usuario(uid):
    datos    = request.get_json()
    nombre   = datos.get("nombre", "").strip()
    email    = datos.get("email",  "").strip().lower()
    rol      = datos.get("rol", "usuario")
    password = datos.get("password", "")
    if not nombre or not email:
        return jsonify({"error": "Nombre y email son obligatorios"}), 400
    if rol not in ("usuario", "admin"):
        return jsonify({"error": "Rol inválido"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        sets   = ["nombre=%s", "email=%s", "rol=%s"]
        values = [nombre, email, rol]
        if password:
            hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            sets.append("password=%s")
            values.append(hash_pw)
        values.append(uid)
        cur.execute(f"UPDATE usuarios SET {', '.join(sets)} WHERE id=%s", values)
        if cur.rowcount == 0:
            return jsonify({"error": "Usuario no encontrado"}), 404
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Usuario actualizado correctamente"})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está en uso por otro usuario"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/usuario/<int:uid>", methods=["DELETE"])
@solo_admin
def eliminar_usuario(uid):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT rol FROM usuarios WHERE id = %s", (uid,))
        usuario = cur.fetchone()
        if not usuario:
            cur.close(); conn.close()
            return jsonify({"error": "Usuario no encontrado"}), 404
        if usuario["rol"] == "admin":
            cur.execute("SELECT COUNT(*) AS cnt FROM usuarios WHERE rol='admin'")
            if cur.fetchone()["cnt"] <= 1:
                cur.close(); conn.close()
                return jsonify({"error": "No puedes eliminar el único administrador"}), 400
        cur.execute("DELETE FROM usuarios WHERE id = %s", (uid,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Usuario eliminado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/apuestas", methods=["GET"])
@token_requerido
@solo_admin
def ver_apuestas():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.id AS id_usuario, u.nombre, u.email, u.foto_perfil,
                   p.id AS id_partido, p.equipo_local, p.equipo_visita,
                   p.bandera_local, p.bandera_visita,
                   p.fecha, p.fase, p.grupo,
                   p.goles_local AS resultado_local, p.goles_visita AS resultado_visita,
                   p.finalizado,
                   a.goles_local_apostado, a.goles_visita_apostado,
                   a.puntos, a.intentos
            FROM apuestas a
            JOIN usuarios u ON u.id = a.id_usuario
            JOIN partidos p ON p.id = a.id_partido
            ORDER BY u.nombre ASC, p.fecha ASC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
