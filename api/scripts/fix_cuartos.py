"""
Corrige equipos, fechas y horas de los partidos de Cuartos de Final.
Ejecutar: railway run python scripts/fix_cuartos.py
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ["DATABASE_URL"]
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Datos confirmados del bracket oficial (hora Chile CLT = UTC-4)
CUARTOS = [
    # (estadio,            eq_local,    fl,   eq_visita,    fv,   fecha_chile)
    ("Gillette Stadium",  "Marruecos", "🇲🇦", "Francia",    "🇫🇷", "2026-07-09 16:00"),
    ("SoFi Stadium",      "España",    "🇪🇸", "Bélgica",    "🇧🇪", "2026-07-10 15:00"),
    ("Hard Rock Stadium", "Noruega",   "🇳🇴", "Inglaterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "2026-07-11 17:00"),
    ("Arrowhead Stadium", "Argentina", "🇦🇷", "Suiza",      "🇨🇭", "2026-07-11 21:00"),
]

conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
cur  = conn.cursor()

for estadio, eq_l, fl, eq_v, fv, fecha in CUARTOS:
    cur.execute(
        "SELECT id, equipo_local, equipo_visita, fecha FROM partidos WHERE nombre_estadio = %s AND fase = 'Cuartos'",
        (estadio,)
    )
    row = cur.fetchone()
    if row:
        cur.execute("""
            UPDATE partidos
               SET equipo_local=%s, bandera_local=%s,
                   equipo_visita=%s, bandera_visita=%s,
                   fecha=%s
             WHERE id=%s
        """, (eq_l, fl, eq_v, fv, fecha, row["id"]))
        print(f"  OK [{row['id']}] {row['equipo_local']} vs {row['equipo_visita']}  {row['fecha']}  ->  {eq_l} vs {eq_v}  {fecha}")
    else:
        cur.execute("""
            INSERT INTO partidos (equipo_local, bandera_local, equipo_visita, bandera_visita,
                                  fecha, fase, nombre_estadio)
            VALUES (%s,%s,%s,%s,%s,'Cuartos',%s)
        """, (eq_l, fl, eq_v, fv, fecha, estadio))
        print(f"  INSERTADO: {eq_l} vs {eq_v}  {fecha}  ({estadio})")

conn.commit()
cur.close()
conn.close()
print("\nListo.")
