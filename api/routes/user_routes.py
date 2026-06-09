import bcrypt
import psycopg2
from flask import Blueprint, request, jsonify
from database import get_db
from auth import token_requerido

user_bp = Blueprint("user", __name__)

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
            sets.append("foto_perfil = %s")
            values.append(datos["foto_perfil"])

        for campo, max_len in _PERFIL_EXTRAS.items():
            if campo in datos:
                val = (datos[campo] or "").strip()
                if len(val) > max_len:
                    return jsonify({"error": f"El campo supera el límite de {max_len} caracteres"}), 400
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
                   COALESCE(SUM(a.puntos), 0) + COALESCE(ac.puntos_campeon, 0) AS total_puntos,
                   COUNT(CASE WHEN a.puntos > 0 THEN 1 END)  AS aciertos,
                   ac.campeon AS campeon_apostado
            FROM usuarios u
            LEFT JOIN apuestas a          ON a.id_usuario  = u.id AND a.puntos IS NOT NULL
            LEFT JOIN apuesta_campeon ac  ON ac.id_usuario = u.id
            WHERE u.id = %s
            GROUP BY u.id, u.nombre, u.foto_perfil,
                     u.estado, u.biografia, u.cancion_url, u.estado_animo,
                     ac.puntos_campeon, ac.campeon
        """, (user_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return jsonify({"error": "Usuario no encontrado"}), 404
        return jsonify(dict(row))
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@user_bp.route("/mi-campeon", methods=["GET"])
@token_requerido
def mi_campeon():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT campeon FROM apuesta_campeon WHERE id_usuario = %s",
            (request.usuario_id,)
        )
        fila = cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({"campeon": fila["campeon"] if fila else ""})
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500
