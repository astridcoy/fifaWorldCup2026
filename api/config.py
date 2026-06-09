import os
from zoneinfo import ZoneInfo

SANTIAGO = ZoneInfo("America/Santiago")

SECRET_KEY   = os.environ.get("SECRET_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY env var must be set — refusing to start without it")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL env var must be set — refusing to start without it")

SMTP_HOST        = os.environ.get("SMTP_HOST", "")
SMTP_PORT        = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER        = os.environ.get("SMTP_USER", "")
SMTP_PASS        = os.environ.get("SMTP_PASS", "")
SMTP_FROM        = os.environ.get("SMTP_FROM", "") or SMTP_USER
FRONTEND_URL     = os.environ.get("FRONTEND_URL", "https://juega-fifa2026.netlify.app")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
