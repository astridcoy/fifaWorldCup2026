import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool
from datetime import datetime
from zoneinfo import ZoneInfo
from config import DATABASE_URL, SANTIAGO


def chile_now():
    """Hora actual en Santiago (naive, sin tzinfo), para comparar con fechas en DB."""
    return datetime.now(SANTIAGO).replace(tzinfo=None)


# ── Connection pool ───────────────────────────────────────────────
# Shared across all threads in a worker process.
# Each Gunicorn worker gets its own pool instance (separate process).
# minconn=2  → connections kept warm between requests
# maxconn=10 → max concurrent DB connections per worker
#              (3 workers × 10 = 30 total, well within Railway's default 100)
_pool: pg_pool.ThreadedConnectionPool | None = None


def init_pool() -> None:
    global _pool
    _pool = pg_pool.ThreadedConnectionPool(
        minconn=2,
        maxconn=10,
        dsn=DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


class _PooledConn:
    """Proxy around a psycopg2 connection. close() returns it to the pool instead of terminating."""
    __slots__ = ('_conn', '_pool', '_returned')

    def __init__(self, conn, pool):
        self._conn     = conn
        self._pool     = pool
        self._returned = False

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        if not self._returned:
            self._returned = True
            try:
                if not self._conn.closed:
                    self._conn.rollback()
            except Exception:
                pass
            self._pool.putconn(self._conn)

    @property
    def closed(self):
        return self._conn.closed

    def __getattr__(self, name):
        return getattr(self._conn, name)


def get_db():
    return _PooledConn(_pool.getconn(), _pool)


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
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado VARCHAR(150)")
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS biografia TEXT")
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cancion_url VARCHAR(300)")
        cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado_animo VARCHAR(20)")
        cur.execute("ALTER TABLE apuestas ADD COLUMN IF NOT EXISTS prediccion VARCHAR(1)")
        cur.execute("ALTER TABLE apuestas ALTER COLUMN goles_local_apostado DROP NOT NULL")
        cur.execute("ALTER TABLE apuestas ALTER COLUMN goles_visita_apostado DROP NOT NULL")
        cur.execute("""
            UPDATE apuestas SET prediccion =
                CASE
                    WHEN goles_local_apostado > goles_visita_apostado THEN 'L'
                    WHEN goles_local_apostado < goles_visita_apostado THEN 'V'
                    ELSE 'E'
                END
            WHERE goles_local_apostado IS NOT NULL AND prediccion IS NULL
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notificaciones (
                id          SERIAL PRIMARY KEY,
                id_usuario  INT  NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                id_partido  INT  NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
                tipo        VARCHAR(50) NOT NULL,
                enviado_en  TIMESTAMP DEFAULT NOW(),
                UNIQUE (id_usuario, id_partido, tipo)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id          SERIAL PRIMARY KEY,
                id_usuario  INT  NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                mensaje     VARCHAR(300) NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[init_db] warning: {e}")
