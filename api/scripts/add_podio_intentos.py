"""
Agrega columnas intentos_campeon/segundo/tercero a apuesta_campeon
y asigna intentos=1 a todos los usuarios que ya votaron.
Ejecutar: railway run python scripts/add_podio_intentos.py
"""
import os
import psycopg2

DATABASE_URL = os.environ["DATABASE_URL"]

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

cur.execute("""
    ALTER TABLE apuesta_campeon
    ADD COLUMN IF NOT EXISTS intentos_campeon SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS intentos_segundo SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS intentos_tercero SMALLINT NOT NULL DEFAULT 0
""")
print("  OK  columnas agregadas (o ya existian)")

cur.execute("""
    UPDATE apuesta_campeon SET
        intentos_campeon = CASE WHEN campeon       IS NOT NULL AND campeon       <> '' THEN 1 ELSE 0 END,
        intentos_segundo = CASE WHEN segundo_lugar IS NOT NULL AND segundo_lugar <> '' THEN 1 ELSE 0 END,
        intentos_tercero = CASE WHEN tercer_lugar  IS NOT NULL AND tercer_lugar  <> '' THEN 1 ELSE 0 END
""")
print(f"  OK  {cur.rowcount} filas actualizadas (intentos inicializados)")

conn.commit()
cur.close()
conn.close()
print("\nMigracion completada.")
