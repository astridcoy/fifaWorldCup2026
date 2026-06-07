import psycopg2
import psycopg2.extras
from datetime import datetime
from zoneinfo import ZoneInfo
from config import DATABASE_URL, SANTIAGO


def chile_now():
    """Hora actual en Santiago (naive, sin tzinfo), para comparar con fechas en DB."""
    return datetime.now(SANTIAGO).replace(tzinfo=None)


def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def row_as_dict(row):
    """Serializa datetime como ISO string para que Flask no use formato RFC 2822."""
    result = {}
    for k, v in dict(row).items():
        result[k] = v.strftime("%Y-%m-%dT%H:%M:%S") if isinstance(v, datetime) else v
    return result


def init_db():
    """Aplica migraciones incrementales (ADD COLUMN IF NOT EXISTS)."""
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT")
        cur.execute("ALTER TABLE apuestas ADD COLUMN IF NOT EXISTS intentos INT NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token TEXT")
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP")
        cur.execute("ALTER TABLE partidos ADD COLUMN IF NOT EXISTS grupo TEXT")
        cur.execute("ALTER TABLE partidos ADD COLUMN IF NOT EXISTS imagen_estadio TEXT")
        cur.execute("ALTER TABLE partidos ADD COLUMN IF NOT EXISTS nombre_estadio TEXT")
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[init_db] warning: {e}")
