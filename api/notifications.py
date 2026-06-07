"""
Sistema de notificaciones por correo:
  - send_bet_reminder     : recordatorio cuando las apuestas cierran en ~2 h
  - send_result_notification: resultado del partido a quienes apostaron
  - notify_result_to_all  : llama lo anterior para todos los apostadores
  - run_bet_reminders     : job del scheduler (cada 30 min)
  - start_scheduler       : inicia APScheduler en background
"""
import ssl
import smtplib
import threading
from datetime import timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL
from database import get_db, chile_now


# ── Utilidades de envío ──────────────────────────────────────────

def _send(to_email, subject, text_body, html_body):
    if not SMTP_HOST or not SMTP_USER:
        return
    try:
        msg            = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = to_email
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body,  "html",  "utf-8"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, to_email, msg.as_string())
    except Exception as e:
        print(f"[email] Error → {to_email}: {e}")


# ── Fragmentos HTML reutilizables ────────────────────────────────

_HDR = (
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;'
    'background:#0A1628;color:#e2e8f0;border-radius:12px;overflow:hidden">'
    '<div style="background:linear-gradient(135deg,#060e1c,#0a1e3d);'
    'padding:1.25rem 1.5rem;border-bottom:2px solid #F5B800;text-align:center">'
    '<h2 style="color:#F5B800;font-size:1.3rem;margin:0;letter-spacing:2px">'
    '&#9917; POLLA FIFA WORLD CUP 2026</h2></div>'
    '<div style="padding:1.5rem">'
)
_FTR = (
    '</div>'
    '<div style="padding:.7rem 1.5rem;background:rgba(0,0,0,.35);'
    'text-align:center;font-size:.7rem;color:#4a5568">'
    'Juega FIFA World Cup 2026 &#8212; Proyecto independiente no afiliado a FIFA&#8482;</div>'
    '</div>'
)


def _btn(url, label, color="#00843D"):
    return (
        f'<a href="{url}" style="display:block;text-align:center;padding:12px;'
        f'background:{color};color:#fff;text-decoration:none;border-radius:8px;'
        f'font-weight:700;font-size:1rem;margin-top:1.1rem">{label}</a>'
    )


def _card(content):
    return (
        '<div style="background:#111f38;border:1px solid rgba(245,184,0,.3);'
        f'border-radius:10px;padding:1rem;margin:.9rem 0;text-align:center">{content}</div>'
    )


# ── Templates de email ───────────────────────────────────────────

def send_bet_reminder(to_email, nombre, partido):
    """Recordatorio: la ventana de apuestas está por cerrar (~2 h)."""
    fecha_dt  = partido["fecha"]
    fecha_str = (fecha_dt.strftime("%d %b %Y, %H:%M")
                 if hasattr(fecha_dt, "strftime") else str(fecha_dt))
    local  = partido["equipo_local"]
    visita = partido["equipo_visita"]

    subject = f"Apuesta pronto: {local} vs {visita} · cierra en ~2 horas"
    url     = FRONTEND_URL + "/index.html"

    text = (
        f"Hola {nombre},\n\n"
        f"Las apuestas para {local} vs {visita} cierran muy pronto.\n"
        f"El partido comienza el {fecha_str}.\n\n"
        f"Recuerda: las apuestas se cierran 24 horas antes del inicio.\n"
        f"Ingresa en: {url}\n\n"
        f"Polla FIFA World Cup 2026"
    )
    html = (
        _HDR
        + f"<p>Hola <strong>{nombre}</strong>,</p>"
        + _card(
            '<p style="color:#F5B800;font-size:.75rem;letter-spacing:2px;'
            'margin:0 0 .5rem;text-transform:uppercase">Apuesta por cerrar</p>'
            f'<p style="font-size:1.15rem;font-weight:700;margin:.2rem 0">{local} vs {visita}</p>'
            f'<p style="color:#7a91b3;font-size:.85rem;margin:.4rem 0 0">&#128197; {fecha_str}</p>'
        )
        + '<p style="color:#f87171;font-weight:600">&#9201; Las apuestas cierran '
          '<strong>24&nbsp;horas antes</strong> del partido. ¡Tienes poco tiempo!</p>'
        + _btn(url, "&#9917; Apostar ahora")
        + _FTR
    )
    _send(to_email, subject, text, html)


def send_result_notification(to_email, nombre, partido_row):
    """Resultado del partido + puntos obtenidos por el usuario."""
    local  = partido_row["equipo_local"]
    visita = partido_row["equipo_visita"]
    gl, gv = partido_row["goles_local"], partido_row["goles_visita"]
    result = f"{gl} – {gv}"
    pts    = partido_row.get("puntos")
    pts_str = ("" if pts is None
               else f"{pts} punto{'s' if pts != 1 else ''}")

    subject = f"Resultado: {local} {gl}-{gv} {visita} | Polla FIFA 2026"
    url     = FRONTEND_URL + "/ranking.html"

    apuesta_html = ""
    if partido_row.get("goles_local_apostado") is not None:
        al, av   = partido_row["goles_local_apostado"], partido_row["goles_visita_apostado"]
        pts_color = ("#F5B800" if pts == 3
                     else ("#4ade80" if pts == 1 else "#f87171"))
        apuesta_html = (
            '<div style="background:#0f1e35;border:1px solid rgba(74,222,128,.2);'
            'border-radius:8px;padding:.8rem;margin-top:.7rem;text-align:left">'
            f'<p style="margin:0 0 .3rem;font-size:.85rem;color:#7a91b3">'
            f'Tu apuesta: <strong style="color:#e2e8f0">{al} – {av}</strong></p>'
            f'<p style="margin:0;font-size:.85rem;color:#7a91b3">'
            f'Puntos obtenidos: <strong style="color:{pts_color};font-size:1rem">'
            f'{pts_str}</strong></p></div>'
        )

    text = (
        f"Hola {nombre},\n\n"
        f"Resultado registrado: {local} {gl}-{gv} {visita}\n"
        f"Tu apuesta: {partido_row.get('goles_local_apostado')} - "
        f"{partido_row.get('goles_visita_apostado')}\n"
        f"Puntos: {pts_str}\n\n"
        f"Ver ranking actualizado: {url}\n\nPolla FIFA 2026"
    )
    html = (
        _HDR
        + f"<p>Hola <strong>{nombre}</strong>, se registró el resultado:</p>"
        + _card(
            '<p style="color:#F5B800;font-size:.75rem;letter-spacing:2px;'
            'margin:0 0 .5rem;text-transform:uppercase">Resultado final</p>'
            f'<p style="font-size:1.3rem;font-weight:700;letter-spacing:1px;margin:.2rem 0">'
            f'{local} <span style="color:#F5B800;font-size:1.45rem">&nbsp;{result}&nbsp;</span> {visita}</p>'
        )
        + apuesta_html
        + _btn(url, "Ver ranking actualizado", "#003DA5")
        + _FTR
    )
    _send(to_email, subject, text, html)


# ── Lógica de disparo ─────────────────────────────────────────────

def notify_result_to_all(partido_id):
    """Llamado en hilo background tras ingresar resultado."""
    if not SMTP_HOST:
        return
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.email, u.nombre,
                   a.goles_local_apostado, a.goles_visita_apostado, a.puntos,
                   p.equipo_local, p.equipo_visita, p.goles_local, p.goles_visita
            FROM   apuestas  a
            JOIN   usuarios  u ON u.id = a.id_usuario
            JOIN   partidos  p ON p.id = a.id_partido
            WHERE  a.id_partido = %s
        """, (partido_id,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        for row in rows:
            send_result_notification(row["email"], row["nombre"], dict(row))
    except Exception as e:
        print(f"[notifications] notify_result_to_all: {e}")


def run_bet_reminders():
    """
    Job programado: envía recordatorio a usuarios sin apuesta cuando
    las apuestas para un partido cierran en las próximas 1-3 horas
    (es decir, el partido empieza en 25-27 horas).
    """
    if not SMTP_HOST:
        return
    try:
        conn         = get_db()
        cur          = conn.cursor()
        now          = chile_now()
        window_start = now + timedelta(hours=25)
        window_end   = now + timedelta(hours=27)
        cur.execute("""
            SELECT p.id, p.equipo_local, p.equipo_visita, p.fecha,
                   u.id AS uid, u.nombre, u.email
            FROM   partidos p
            CROSS  JOIN usuarios u
            WHERE  p.fecha BETWEEN %s AND %s
              AND  p.finalizado = FALSE
              AND  NOT EXISTS (
                       SELECT 1 FROM apuestas a
                       WHERE  a.id_partido = p.id AND a.id_usuario = u.id)
              AND  NOT EXISTS (
                       SELECT 1 FROM notificaciones n
                       WHERE  n.id_partido = p.id AND n.id_usuario = u.id
                         AND  n.tipo = 'recordatorio_24h')
        """, (window_start, window_end))
        pendientes = cur.fetchall()
        for row in pendientes:
            send_bet_reminder(row["email"], row["nombre"], dict(row))
            cur.execute("""
                INSERT INTO notificaciones (id_usuario, id_partido, tipo)
                VALUES (%s, %s, 'recordatorio_24h')
                ON CONFLICT (id_usuario, id_partido, tipo) DO NOTHING
            """, (row["uid"], row["id"]))
        conn.commit()
        cur.close(); conn.close()
        if pendientes:
            print(f"[scheduler] Recordatorios enviados: {len(pendientes)}")
    except Exception as e:
        print(f"[scheduler] run_bet_reminders: {e}")


# ── Scheduler ────────────────────────────────────────────────────

def start_scheduler():
    """Inicia APScheduler en background. Falla silenciosamente si no está instalado."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from config import SANTIAGO
        scheduler = BackgroundScheduler(timezone=str(SANTIAGO))
        scheduler.add_job(
            run_bet_reminders,
            trigger="interval",
            minutes=30,
            id="bet_reminders",
            replace_existing=True,
        )
        scheduler.start()
        print("[scheduler] Activo: recordatorios de apuestas cada 30 min")
    except ImportError:
        print("[scheduler] APScheduler no instalado — notificaciones automáticas desactivadas")
    except Exception as e:
        print(f"[scheduler] Error al iniciar: {e}")
