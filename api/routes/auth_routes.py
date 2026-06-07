import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from database import get_db
from auth import send_reset_email
from config import SECRET_KEY, SMTP_HOST, SMTP_USER

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/registro", methods=["POST"])
def registro():
    datos    = request.get_json()
    nombre   = datos.get("nombre", "").strip()
    email    = datos.get("email",  "").strip().lower()
    password = datos.get("password", "")

    if not nombre or not email or not password:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400

    hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO usuarios (nombre, email, password, rol) VALUES (%s, %s, %s, 'usuario') RETURNING id",
            (nombre, email, hash_pw)
        )
        uid = cur.fetchone()["id"]
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Usuario registrado correctamente", "id": uid}), 201
    except Exception as e:
        import psycopg2
        if isinstance(e, psycopg2.errors.UniqueViolation):
            return jsonify({"error": "El email ya está registrado"}), 409
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    datos    = request.get_json()
    email    = datos.get("email", "").strip().lower()
    password = datos.get("password", "")
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT * FROM usuarios WHERE email = %s", (email,))
        usuario = cur.fetchone()
        cur.close(); conn.close()

        if not usuario or not bcrypt.checkpw(password.encode(), usuario["password"].encode()):
            return jsonify({"error": "Credenciales incorrectas"}), 401

        token = jwt.encode(
            {"id": usuario["id"], "nombre": usuario["nombre"], "rol": usuario["rol"],
             "exp": datetime.utcnow() + timedelta(hours=24)},
            SECRET_KEY, algorithm="HS256"
        )
        return jsonify({"token": token, "nombre": usuario["nombre"],
                        "rol": usuario["rol"], "id": usuario["id"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/recuperar-password", methods=["POST"])
def recuperar_password():
    datos = request.get_json()
    email = datos.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "El email es obligatorio"}), 400
    if not SMTP_HOST or not SMTP_USER:
        return jsonify({"error": "El servicio de email no está configurado en el servidor"}), 503
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
        usuario = cur.fetchone()
        if usuario:
            token  = secrets.token_urlsafe(32)
            expiry = datetime.utcnow() + timedelta(hours=1)
            cur.execute(
                "UPDATE usuarios SET reset_token = %s, reset_token_expiry = %s WHERE id = %s",
                (token, expiry, usuario["id"])
            )
            conn.commit()
            send_reset_email(email, token)
        cur.close(); conn.close()
        return jsonify({"mensaje": "Si el correo está registrado, recibirás un enlace en breve."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    datos    = request.get_json()
    token    = datos.get("token", "").strip()
    password = datos.get("password", "")
    if not token or not password:
        return jsonify({"error": "Token y contraseña son obligatorios"}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT id, reset_token_expiry FROM usuarios WHERE reset_token = %s", (token,))
        usuario = cur.fetchone()
        if not usuario:
            cur.close(); conn.close()
            return jsonify({"error": "El enlace es inválido o ya fue usado"}), 400
        if datetime.utcnow() > usuario["reset_token_expiry"]:
            cur.close(); conn.close()
            return jsonify({"error": "El enlace ha expirado. Solicita uno nuevo."}), 400
        hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur.execute(
            "UPDATE usuarios SET password = %s, reset_token = NULL, reset_token_expiry = NULL WHERE id = %s",
            (hash_pw, usuario["id"])
        )
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"mensaje": "Contraseña actualizada correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
