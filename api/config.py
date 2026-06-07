import os
from zoneinfo import ZoneInfo

SANTIAGO = ZoneInfo("America/Santiago")

SECRET_KEY   = os.environ.get("SECRET_KEY", "mundial2026_clave_secreta_cambiar_en_produccion")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://usuario:contraseña@localhost:5432/polla_mundial")

SMTP_HOST    = os.environ.get("SMTP_HOST", "")
SMTP_PORT    = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER    = os.environ.get("SMTP_USER", "")
SMTP_PASS    = os.environ.get("SMTP_PASS", "")
SMTP_FROM    = os.environ.get("SMTP_FROM", "") or SMTP_USER
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://juega-fifa2026.netlify.app")
