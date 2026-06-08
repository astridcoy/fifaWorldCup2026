import bcrypt
from flask import Blueprint, request, jsonify
from database import get_db
from auth import token_requerido
import psycopg2

user_bp = Blueprint("user", __name__)


@user_bp.route("/perfil", methods=["GET"])
@token_requerido
def obtener_perfil():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT id, nombre, email, foto_perfil FROM usuarios WHERE id = %s",
            (request.usuario_id,)
        )
        usuario = cur.fetchone()
        cur.close(); conn.close()
        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404
        return jsonify(dict(usuario))
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


@user_bp.route("/perfil", methods=["PUT"])
@token_requerido
def actualizar_perfil():
    datos  = request.get_json()
    nombre = datos.get("nombre", "").strip()
    email  = datos.get("email",  "").strip().lower()
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

        values.append(request.usuario_id)
        cur.execute(f"UPDATE usuarios SET {', '.join(sets)} WHERE id = %s", values)
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Perfil actualizado correctamente"})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está en uso por otro usuario"}), 409
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500


@user_bp.route("/mi-campeon", methods=["GET"])
@token_requerido
def mi_campeon():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT campeon FROM apuesta_campeon WHERE id_usuario = %s", (request.usuario_id,))
        fila = cur.fetchone()
        cur.close(); conn.close()
        return jsonify({"campeon": fila["campeon"] if fila else ""})
    except Exception as e:
        return jsonify({"error": "Error interno del servidor"}), 500
