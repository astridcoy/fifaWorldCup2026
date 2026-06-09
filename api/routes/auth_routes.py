import os
import re
import hmac
import hashlib
import logging
import bcrypt
import jwt
import psycopg2
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from database import get_db
from auth import send_reset_email
from config import SECRET_KEY, SMTP_HOST, SMTP_USER

try:
    from google.oauth2 import id_token as _g_id_token
    from google.auth.transport import requests as _g_requests
    _GOOGLE_AUTH_OK = True
except ImportError:
    _GOOGLE_AUTH_OK = False


auth_bp = Blueprint("auth", __name__)


# ── Validadores ──────────────────────────────────────────────────

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')

_DISPOSABLE = frozenset([
    "mailinator.com", "guerrillamail.com", "guerrillamail.info",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net",
    "guerrillamail.org", "guerrillamailblock.com", "grr.la", "sharklasers.com",
    "spam4.me", "trashmail.com", "trashmail.me", "trashmail.net", "trashmail.at",
    "trashmail.io", "trashmail.org", "trashemails.de", "trashmailer.com",
    "discard.email", "discardmail.com", "discardmail.de", "fakeinbox.com",
    "mailnull.com", "yopmail.com", "yopmail.fr", "yopmail.net",
    "temp-mail.org", "tempmail.com", "tempmail.net", "tempr.email",
    "tempinbox.com", "temporaryemail.net", "temporaremail.com",
    "temporaryinbox.com", "tempymail.com", "throwaway.email", "throwam.com",
    "throwemailaway.com", "maildrop.cc", "spamgourmet.com", "spamgourmet.net",
    "spamgourmet.org", "mytrashmail.com", "mt2009.com", "dispostable.com",
    "mailexpire.com", "fakemailgenerator.com", "10minutemail.com",
    "10minutemail.net", "minutemailbox.com", "crazymailing.com",
    "hmamail.com", "pookmail.com", "objectmail.com", "rcpt.at",
    "trbvm.com", "trbvn.com", "binkmail.com", "bob.email",
    "deadaddress.com", "dumpmail.de", "jetable.com", "jetable.fr.nf",
    "jetable.net", "jetable.org", "kasmail.com", "killmail.com",
    "killmail.net", "lazyinbox.com", "mailbolt.com", "mailcatch.com",
    "mailin8r.com", "mailinator2.com", "mailsiphon.com", "mintemail.com",
    "mvrht.com", "no-spam.ws", "nomail.pw", "odaymail.com",
    "one-time.email", "onewaymail.com", "papierkorb.me", "pfui.ru",
    "pjjkp.com", "popmail.io", "prtnx.com", "safetypost.de",
    "sneakemail.com", "snkmail.com", "sogetthis.com", "spamavert.com",
    "spambog.com", "spamcorptastic.com", "spamcowboy.com", "spamfree.eu",
    "spamgob.com", "spamhole.com", "spaml.com", "spammotel.com",
    "spamoff.de", "spamspot.com", "squizzy.net", "tafmail.com",
    "techemail.com", "teleworm.us", "tmail.com", "tmail.io",
    "toiea.com", "trashdevil.com", "trashdevil.de", "turual.com",
    "vaultmail.co", "vomoto.com", "walkmail.net", "wegwerfmail.de",
    "wegwerfmail.net", "xagloo.com", "yaoo.fr", "yapped.net",
    "zehnminutenmail.de", "zippymail.info", "zzrgg.com",
    "inboxalias.com", "instant-mail.de", "mail-temporaire.fr",
    "mailguard.me", "mailimate.com", "mailme.ir", "mailme24.com",
    "mailmoat.com", "mailnew.com", "mailpick.biz", "mailzilla.com",
    "mailzilla.org", "getonemail.com", "gettempmail.com",
])

_PW_RE = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$')

_DUMMY_HASH = bcrypt.hashpw(b"__timing_safe_dummy__", bcrypt.gensalt())


def _email_valido(email):
    if not _EMAIL_RE.match(email):
        return False, "Formato de correo inválido"
    domain = email.split("@", 1)[1].lower()
    if domain in _DISPOSABLE:
        return False, (
            "No se aceptan correos temporales o desechables. "
            "Usa tu correo de Gmail, Hotmail, Outlook u otro proveedor válido."
        )
    return True, ""


def _password_valido(pw):
    return bool(_PW_RE.match(pw)) if pw else False


def _hmac_token(token):
    return hmac.new(SECRET_KEY.encode(), token.encode(), digestmod=hashlib.sha256).hexdigest()


# ── Rutas ────────────────────────────────────────────────────────

@auth_bp.route("/auth/google", methods=["POST"])
def google_login():
    if not _GOOGLE_AUTH_OK:
        return jsonify({"error": "Google auth no disponible en el servidor"}), 503

    data  = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()
    if not token:
        return jsonify({"error": "Token requerido"}), 400

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        return jsonify({"error": "Google login no configurado en el servidor"}), 503

    try:
        idinfo = _g_id_token.verify_oauth2_token(token, _g_requests.Request(), client_id)
    except ValueError:
        return jsonify({"error": "Token de Google inválido o expirado"}), 401
    except Exception:
        logging.exception("Error verificando token Google")
        return jsonify({"error": "Error interno del servidor"}), 500

    email   = (idinfo.get("email") or "").lower().strip()
    nombre  = (idinfo.get("name")  or "").strip() or email.split("@")[0]
    picture = idinfo.get("picture") or None

    if not email:
        return jsonify({"error": "No se pudo obtener el email de Google"}), 400

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT id, nombre, rol, foto_perfil FROM usuarios WHERE email = %s",
            (email,)
        )
        usuario = cur.fetchone()

        if usuario:
            uid = usuario["id"]
            rol = usuario["rol"]
            nom = usuario["nombre"]
            if picture and not usuario["foto_perfil"]:
                cur.execute("UPDATE usuarios SET foto_perfil = %s WHERE id = %s", (picture, uid))
                conn.commit()
        else:
            pw_hash = bcrypt.hashpw(secrets.token_bytes(32), bcrypt.gensalt()).decode()
            cur.execute(
                "INSERT INTO usuarios (nombre, email, password, rol, foto_perfil)"
                " VALUES (%s, %s, %s, 'usuario', %s) RETURNING id",
                (nombre[:80], email, pw_hash, picture)
            )
            uid = cur.fetchone()["id"]
            rol = "usuario"
            nom = nombre[:80]
            conn.commit()

        cur.close()
        conn.close()

        jwt_tok = jwt.encode(
            {"id": uid, "nombre": nom, "rol": rol,
             "exp": datetime.utcnow() + timedelta(hours=24)},
            SECRET_KEY,
            algorithm="HS256"
        )
        return jsonify({"token": jwt_tok, "nombre": nom, "rol": rol, "id": uid})

    except Exception:
        logging.exception("Error en /auth/google")
        return jsonify({"error": "Error interno del servidor"}), 500


@auth_bp.route("/registro", methods=["POST"])
def registro():
    datos    = request.get_json()
    nombre   = datos.get("nombre", "").strip()
    email    = datos.get("email",  "").strip().lower()
    password = datos.get("password", "")

    if not nombre or not email or not password:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400

    ok, msg = _email_valido(email)
    if not ok:
        return jsonify({"error": msg}), 400
    if len(nombre) < 2 or len(nombre) > 80:
        return jsonify({"error": "El nombre debe tener entre 2 y 80 caracteres"}), 400
    if not _password_valido(password):
        return jsonify({"error": (
            "La contraseña debe tener al menos 8 caracteres, "
            "una mayúscula, una minúscula y un número"
        )}), 400

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
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Usuario registrado correctamente", "id": uid}), 201
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "El email ya está registrado"}), 409
    except Exception:
        logging.exception("Error en /registro")
        return jsonify({"error": "Error interno del servidor"}), 500


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
        cur.close()
        conn.close()

        stored = usuario["password"].encode() if usuario else _DUMMY_HASH
        if not usuario or not bcrypt.checkpw(password.encode(), stored):
            return jsonify({"error": "Credenciales incorrectas"}), 401

        token = jwt.encode(
            {"id": usuario["id"], "nombre": usuario["nombre"], "rol": usuario["rol"],
             "exp": datetime.utcnow() + timedelta(hours=24)},
            SECRET_KEY,
            algorithm="HS256"
        )
        return jsonify({
            "token":  token,
            "nombre": usuario["nombre"],
            "rol":    usuario["rol"],
            "id":     usuario["id"],
        })
    except Exception:
        logging.exception("Error en /login")
        return jsonify({"error": "Error interno del servidor"}), 500


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
            stored = _hmac_token(token)
            expiry = datetime.utcnow() + timedelta(hours=1)
            cur.execute(
                "UPDATE usuarios SET reset_token = %s, reset_token_expiry = %s WHERE id = %s",
                (stored, expiry, usuario["id"])
            )
            conn.commit()
            send_reset_email(email, token)
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Si el correo está registrado, recibirás un enlace en breve."}), 200
    except Exception:
        logging.exception("Error en /recuperar-password")
        return jsonify({"error": "Error interno del servidor"}), 500


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    datos    = request.get_json()
    token    = datos.get("token", "").strip()
    password = datos.get("password", "")
    if not token or not password:
        return jsonify({"error": "Token y contraseña son obligatorios"}), 400
    if not _password_valido(password):
        return jsonify({"error": (
            "La contraseña debe tener al menos 8 caracteres, "
            "una mayúscula, una minúscula y un número"
        )}), 400
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "SELECT id, reset_token_expiry FROM usuarios WHERE reset_token = %s",
            (_hmac_token(token),)
        )
        usuario = cur.fetchone()
        if not usuario:
            cur.close()
            conn.close()
            return jsonify({"error": "El enlace es inválido o ya fue usado"}), 400
        if datetime.utcnow() > usuario["reset_token_expiry"]:
            cur.close()
            conn.close()
            return jsonify({"error": "El enlace ha expirado. Solicita uno nuevo."}), 400
        hash_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur.execute(
            "UPDATE usuarios SET password = %s, reset_token = NULL, reset_token_expiry = NULL"
            " WHERE id = %s",
            (hash_pw, usuario["id"])
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"mensaje": "Contraseña actualizada correctamente"})
    except Exception:
        logging.exception("Error en /reset-password")
        return jsonify({"error": "Error interno del servidor"}), 500
