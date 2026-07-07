import re
import bcrypt
import psycopg2
from flask import Blueprint, request, jsonify
from database import get_db, row_as_dict
from auth import token_requerido
from routes.auth_routes import _password_valido, _email_valido

user_bp = Blueprint("user", __name__)

_MAX_FOTO_CHARS = 3_000_000  # ~2 MB original after base64 encoding

_CANCION_RE = re.compile(
    r'^https://(open\.spotify\.com/(track|playlist|album|artist)/|'
    r'(www\.)?youtube\.com/watch(\?|/)|'
    r'youtu\.be/|'
    r'music\.youtube\.com/)'
)

_PERFIL_EXTRAS = {
    "estado":       150,
    "biografia":    500,
    "cancion_url":  300,
    "estado_animo": 20,
}


@user_bp.route("/perfil", methods=["GET"])
@token_requerido
def obtener_perfil():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT id, nombre, email, foto_perfil, estado, biografia, cancion_url, estado_animo"
            " FROM usuarios WHERE id = %s",
            (request.usuario_id,)
        )
        usuario = cur.fetchone()
        cur.close()
        conn.close()
        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404
        return jsonify(dict(usuario))
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@user_bp.route("/perfil", methods=["PUT"])
@token_requerido
def actualizar_perfil():
    datos    = request.get_json() or {}
    nombre   = datos.get("nombre", "").strip()
    email    = datos.get("email",  "").strip().lower()
    password = datos.get("password", "")

    if not nombre or not email:
        return jsonify({"error": "Nombre y email son obligatorios"}), 400
    if len(nombre) < 2 or len(nombre) > 80:
        return jsonify({"error": "El nombre debe tener entre 2 y 80 caracteres"}), 400

    ok, msg = _email_valido(email)
    if not ok:
        return jsonify({"error": msg}), 400

    if password and not _password_valido(password):
        return jsonify({"error": (
            "La contraseña debe tener al menos 8 caracteres, "
            "una mayúscula, una minúscula y un número"
        )}), 400

    try:
        conn = get_db()
        cur  = conn.cursor()
        sets   = ["nombre = %s", "email = %s"]
        values = [nombre, email]

        if password:
            hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            sets.append("password = %s")
            values.append(hash_pw)

        if "foto_perfil" in datos:
            fp = datos["foto_perfil"]
            if fp and len(fp) > _MAX_FOTO_CHARS:
                cur.close()
                conn.close()
                return jsonify({"error": "La foto no puede superar los 2 MB"}), 400
            sets.append("foto_perfil = %s")
            values.append(fp)

        for campo, max_len in _PERFIL_EXTRAS.items():
            if campo in datos:
                val = (datos[campo] or "").strip()
                if len(val) > max_len:
                    return jsonify({"error": f"El campo supera el límite de {max_len} caracteres"}), 400
                if campo == "cancion_url" and val and not _CANCION_RE.match(val):
                    return jsonify({"error": "Solo se aceptan URLs de Spotify o YouTube"}), 400
                sets.append(f"{campo} = %s")
                values.append(val or None)

        values.append(request.usuario_id)
        cur.execute(f"UPDATE usuarios SET {', '.join(sets)} WHERE id = %s", values)
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Perfil actualizado correctamente"})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está en uso por otro usuario"}), 409
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@user_bp.route("/usuarios/<int:user_id>/perfil-publico", methods=["GET"])
@token_requerido
def perfil_publico(user_id):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.id, u.nombre, u.foto_perfil,
                   u.estado, u.biografia, u.cancion_url, u.estado_animo,
                   COALESCE(SUM(a.puntos), 0) + COALESCE(ac.puntos_campeon, 0)
                     + COALESCE(ac.puntos_segundo, 0) + COALESCE(ac.puntos_tercero, 0) AS total_puntos,
                   COUNT(CASE WHEN a.puntos > 0 THEN 1 END)  AS aciertos,
                   ac.campeon AS campeon_apostado,
                   ac.segundo_lugar AS segundo_apostado,
                   ac.tercer_lugar AS tercer_apostado
            FROM usuarios u
            LEFT JOIN apuestas a          ON a.id_usuario  = u.id AND a.puntos IS NOT NULL
            LEFT JOIN apuesta_campeon ac  ON ac.id_usuario = u.id
            WHERE u.id = %s
            GROUP BY u.id, u.nombre, u.foto_perfil,
                     u.estado, u.biografia, u.cancion_url, u.estado_animo,
                     ac.puntos_campeon, ac.campeon, ac.puntos_segundo, ac.segundo_lugar,
                     ac.puntos_tercero, ac.tercer_lugar
        """, (user_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return jsonify({"error": "Usuario no encontrado"}), 404
        return jsonify(dict(row))
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@user_bp.route("/usuarios/<int:user_id>/no-votados", methods=["GET"])
@token_requerido
def no_votados(user_id):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT p.id, p.equipo_local, p.equipo_visita,
                   p.bandera_local, p.bandera_visita, p.fecha, p.fase, p.grupo
            FROM partidos p
            WHERE p.finalizado = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM apuestas a
                  WHERE a.id_partido = p.id AND a.id_usuario = %s
              )
            ORDER BY p.fecha ASC
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([row_as_dict(r) for r in rows])
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@user_bp.route("/mi-campeon", methods=["GET"])
@token_requerido
def mi_campeon():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT campeon, segundo_lugar, tercer_lugar,
                   intentos_campeon, intentos_segundo, intentos_tercero
            FROM apuesta_campeon WHERE id_usuario = %s
        """, (request.usuario_id,))
        fila = cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({
            "campeon":           (fila["campeon"]       if fila else "") or "",
            "segundo_lugar":     (fila["segundo_lugar"] if fila else "") or "",
            "tercer_lugar":      (fila["tercer_lugar"]  if fila else "") or "",
            "intentos_campeon":  fila["intentos_campeon"] if fila else 0,
            "intentos_segundo":  fila["intentos_segundo"] if fila else 0,
            "intentos_tercero":  fila["intentos_tercero"] if fila else 0,
        })
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500
