import jwt
import ssl
import smtplib
from functools import wraps
from flask import request, jsonify
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SECRET_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL


def token_requerido(f):
    @wraps(f)
    def decorada(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ")[1] if auth_header.startswith("Bearer ") else None
        if not token:
            return jsonify({"error": "Token requerido"}), 401
        try:
            datos = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.usuario_id  = datos["id"]
            request.usuario_rol = datos.get("rol", "usuario")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expirado"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido"}), 401
        return f(*args, **kwargs)
    return decorada


def solo_admin(f):
    @wraps(f)
    @token_requerido
    def decorada(*args, **kwargs):
        if request.usuario_rol != "admin":
            return jsonify({"error": "Acceso restringido a administradores"}), 403
        return f(*args, **kwargs)
    return decorada


def send_reset_email(to_email, token):
    link = f"{FRONTEND_URL}/reset-password.html?token={token}"
    msg  = MIMEMultipart("alternative")
    msg["Subject"] = "Recupera tu contraseña — Polla FIFA 2026"
    msg["From"]    = SMTP_FROM
    msg["To"]      = to_email

    text = (f"Hola,\n\nHaz clic en este enlace para restablecer tu contraseña:\n{link}\n\n"
            "El enlace expira en 1 hora.\n\nSi no solicitaste este cambio, ignora este mensaje.")
    html = f"""<div style="font-family:sans-serif;max-width:480px;margin:auto">
<h2 style="color:#E8192C">Polla FIFA 2026 🏆</h2>
<p>Haz clic en el botón para restablecer tu contraseña:</p>
<a href="{link}" style="display:inline-block;padding:12px 24px;background:#E8192C;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Restablecer contraseña</a>
<p style="margin-top:16px;color:#666;font-size:.85rem">
  Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.
</p>
</div>"""

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html,  "html"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls(context=ctx)
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())
