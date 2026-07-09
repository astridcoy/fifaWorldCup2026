"""
Resetea intentos del podio de 2 → 1 para usuarios afectados por el bug
del botón "Cambiar" que consumía el segundo intento sin cambiar nada.

Ejecutar: railway run python scripts/reset_podio_intentos.py
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ["DATABASE_URL"]
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
cur  = conn.cursor()

cur.execute("""
    SELECT id_usuario, intentos_campeon, intentos_segundo, intentos_tercero
    FROM apuesta_campeon
    WHERE intentos_campeon >= 2 OR intentos_segundo >= 2 OR intentos_tercero >= 2
""")
afectados = cur.fetchall()
print(f"Usuarios afectados: {len(afectados)}")

cur.execute("""
    UPDATE apuesta_campeon
    SET intentos_campeon = LEAST(intentos_campeon, 1),
        intentos_segundo = LEAST(intentos_segundo, 1),
        intentos_tercero = LEAST(intentos_tercero, 1)
    WHERE intentos_campeon >= 2 OR intentos_segundo >= 2 OR intentos_tercero >= 2
""")
print(f"Filas actualizadas: {cur.rowcount}")

conn.commit()
cur.close()
conn.close()
print("Listo. Todos los usuarios recuperaron su segundo intento.")
