import time
from flask import Blueprint, request, jsonify
from database import get_db, row_as_dict
from auth import token_requerido

chat_bp = Blueprint("chat", __name__)

_RATE_LIMIT = {}
_RATE_SECONDS = 3
_MAX_MESSAGES = 200


def _check_rate(user_id):
    now = time.time()
    last = _RATE_LIMIT.get(user_id, 0)
    if now - last < _RATE_SECONDS:
        return False
    _RATE_LIMIT[user_id] = now
    return True


@chat_bp.route("/chat/messages", methods=["GET"])
@token_requerido
def get_messages():
    since = request.args.get("since", 0, type=int)
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT cm.id, cm.id_usuario, cm.mensaje, cm.created_at,
                   u.nombre, u.foto_perfil
            FROM chat_messages cm
            JOIN usuarios u ON u.id = cm.id_usuario
            WHERE cm.id > %s
            ORDER BY cm.id ASC
            LIMIT 100
        """, (since,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([row_as_dict(r) for r in rows])
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@chat_bp.route("/chat/messages", methods=["POST"])
@token_requerido
def send_message():
    if not _check_rate(request.usuario_id):
        return jsonify({"error": "Espera un momento antes de enviar otro mensaje"}), 429

    datos   = request.get_json(silent=True) or {}
    mensaje = (datos.get("mensaje") or "").strip()

    if not mensaje:
        return jsonify({"error": "El mensaje no puede estar vacío"}), 400
    if len(mensaje) > 300:
        return jsonify({"error": "Máximo 300 caracteres"}), 400

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO chat_messages (id_usuario, mensaje) VALUES (%s, %s) RETURNING id",
            (request.usuario_id, mensaje)
        )
        new_id = cur.fetchone()["id"]

        cur.execute("""
            DELETE FROM chat_messages
            WHERE id NOT IN (
                SELECT id FROM chat_messages ORDER BY id DESC LIMIT %s
            )
        """, (_MAX_MESSAGES,))

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"id": new_id})
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@chat_bp.route("/chat/messages", methods=["DELETE"])
@token_requerido
def clear_all_messages():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT rol FROM usuarios WHERE id = %s", (request.usuario_id,))
        user = cur.fetchone()
        if not user or user["rol"] != "admin":
            cur.close()
            conn.close()
            return jsonify({"error": "Sin permiso"}), 403

        cur.execute("DELETE FROM chat_messages")
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Historial borrado"})
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500


@chat_bp.route("/chat/messages/<int:msg_id>", methods=["DELETE"])
@token_requerido
def delete_message(msg_id):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT id_usuario FROM chat_messages WHERE id = %s", (msg_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify({"error": "Mensaje no encontrado"}), 404

        cur.execute("SELECT rol FROM usuarios WHERE id = %s", (request.usuario_id,))
        user = cur.fetchone()
        is_admin = user and user["rol"] == "admin"
        is_owner = row["id_usuario"] == request.usuario_id

        if not is_admin and not is_owner:
            cur.close()
            conn.close()
            return jsonify({"error": "Sin permiso"}), 403

        cur.execute("DELETE FROM chat_messages WHERE id = %s", (msg_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Eliminado"})
    except Exception:
        return jsonify({"error": "Error interno del servidor"}), 500
