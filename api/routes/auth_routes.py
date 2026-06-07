import re
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from database import get_db
from auth import send_reset_email
from config import SECRET_KEY, SMTP_HOST, SMTP_USER

auth_bp = Blueprint("auth", __name__)

# ── Validación de email ──────────────────────────────────────────
_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')

# Dominios de correo desechables/temporales conocidos
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


def _email_valido(email):
    """Retorna (True, "") o (False, mensaje_error)."""
    if not _EMAIL_RE.match(email):
        return False, "Formato de correo inválido"
    domain = email.split("@", 1)[1].lower()
    if domain in _DISPOSABLE:
        return False, ("No se aceptan correos temporales o desechables. "
                       "Usa tu correo de Gmail, Hotmail, Outlook u otro proveedor válido.")
    return True, ""


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
