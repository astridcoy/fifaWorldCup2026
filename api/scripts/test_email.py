import os, ssl, smtplib, sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

host = os.environ.get("SMTP_HOST", "")
port = int(os.environ.get("SMTP_PORT", 587))
user = os.environ.get("SMTP_USER", "")
pw   = os.environ.get("SMTP_PASS", "")
frm  = os.environ.get("SMTP_FROM", "")
to   = "astridcoy240398@gmail.com"

print(f"Config: host={host}  port={port}  user={user}  from={frm}")
print(f"Enviando a: {to}")

if not host or not user or not pw:
    print("ERROR: Variables SMTP no configuradas")
    sys.exit(1)

html = """
<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;
background:#0A1628;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#060e1c,#0a1e3d);
  padding:1.25rem 1.5rem;border-bottom:2px solid #F5B800;text-align:center">
    <h2 style="color:#F5B800;font-size:1.3rem;margin:0;letter-spacing:2px">
      &#9917; JUEGA FIFA WORLD CUP 2026</h2>
  </div>
  <div style="padding:1.5rem">
    <p>&#128075; Hola!</p>
    <p>El sistema de notificaciones est&#225; funcionando correctamente.</p>
    <div style="background:#111f38;border:1px solid rgba(245,184,0,.3);
    border-radius:10px;padding:1rem;margin:.9rem 0;text-align:center">
      <p style="color:#F5B800;font-size:.8rem;letter-spacing:2px;
      margin:0 0 .75rem;text-transform:uppercase">Sistema activo &#10003;</p>
      <p style="margin:.3rem 0">&#9201; Apuestas cierran 24 h antes del partido</p>
      <p style="margin:.3rem 0">&#128276; Recordatorios autom&#225;ticos cada 30 min</p>
      <p style="margin:.3rem 0">&#128202; Notificaci&#243;n de resultados al registrarlos</p>
    </div>
    <p style="color:#7a91b3;font-size:.82rem;margin-top:.9rem">
      Enviado desde <strong>astridcoy45@gmail.com</strong> &#8212; Railway</p>
  </div>
  <div style="padding:.7rem 1.5rem;background:rgba(0,0,0,.35);
  text-align:center;font-size:.7rem;color:#4a5568">
    Juega FIFA World Cup 2026 &#8212; No afiliado a FIFA&#8482;
  </div>
</div>
"""

try:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Prueba de notificaciones — Juega FIFA 2026 ⚽"
    msg["From"]    = frm
    msg["To"]      = to
    msg.attach(MIMEText("Sistema de notificaciones activo. Apuestas cierran 24h antes. Recordatorios automaticos. Todo funciona.", "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=20) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.login(user, pw)
        s.sendmail(frm, to, msg.as_string())
    print("CORREO ENVIADO EXITOSAMENTE")
except smtplib.SMTPAuthenticationError as e:
    print(f"ERROR de autenticacion: {e}")
    print("Verifica que el App Password sea correcto y que tenga 2FA activado en la cuenta.")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
