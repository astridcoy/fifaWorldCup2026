"""
Recalcula puntos de todas las apuestas en fases QF+ (Cuartos, Semifinal,
Tercer puesto, Final) usando el esquema de puntaje actualizado:
  - Ganador correcto (no exacto) = 3 pts
  - Marcador exacto al 90 min   = 6 pts
  - Penales acertados           = +2 pts

Ejecutar: railway run python scripts/recalcular_cuartos_puntos.py
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

WINNER_POINTS = 3
EXACT_POINTS  = 6
PENALTY_BONUS = 2
FASES_EXACTO  = ("Cuartos", "Semifinal", "Final", "Tercer puesto")

DATABASE_URL = os.environ["DATABASE_URL"]
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
cur  = conn.cursor()

cur.execute("""
    SELECT id, equipo_local, equipo_visita, goles_local, goles_visita,
           fue_penales, equipo_ganador_penales, fase
    FROM partidos
    WHERE fase = ANY(%s) AND finalizado = TRUE
    ORDER BY fecha
""", (list(FASES_EXACTO),))
partidos = cur.fetchall()
print(f"Partidos finalizados en QF+: {len(partidos)}\n")

total_apuestas = 0

for p in partidos:
    pid   = p["id"]
    gl    = p["goles_local"]
    gv    = p["goles_visita"]
    fue_p = p["fue_penales"]
    gan_p = p["equipo_ganador_penales"]
    eq_l  = p["equipo_local"]

    # Ganador real
    if gl > gv:
        ganador_real = "local"
    elif gv > gl:
        ganador_real = "visita"
    else:
        ganador_real = "local" if (fue_p and gan_p == eq_l) else "visita"

    cur.execute("""
        SELECT id, prediccion,
               goles_local_apostado, goles_visita_apostado,
               predice_penales, equipo_penales_pred
        FROM apuestas WHERE id_partido = %s
    """, (pid,))
    apuestas = cur.fetchall()

    for ap in apuestas:
        gl_ap = ap["goles_local_apostado"]
        gv_ap = ap["goles_visita_apostado"]

        # Ganador apostado
        if gl_ap is not None and gv_ap is not None:
            if gl_ap > gv_ap:
                ganador_ap = "local"
            elif gv_ap > gl_ap:
                ganador_ap = "visita"
            else:
                ganador_ap = "local" if ap["equipo_penales_pred"] == eq_l else "visita"
        else:
            # Apuesta vieja (solo prediccion L/V)
            ganador_ap = "local" if ap["prediccion"] == "L" else "visita"

        pts = 0
        if ganador_ap == ganador_real:
            if gl_ap == gl and gv_ap == gv:
                pts = EXACT_POINTS
            else:
                pts = WINNER_POINTS

        # Bonus penales
        if fue_p and ap["predice_penales"] and ap["equipo_penales_pred"] == gan_p:
            pts += PENALTY_BONUS

        cur.execute("UPDATE apuestas SET puntos=%s WHERE id=%s", (pts, ap["id"]))

    print(f"  [{pid}] {p['equipo_local']} {gl}-{gv} {p['equipo_visita']}"
          f"{'  (pens: '+gan_p+')' if fue_p else ''}  "
          f"| ganador={ganador_real}  | {len(apuestas)} apuesta(s) actualizadas")
    total_apuestas += len(apuestas)

conn.commit()
cur.close()
conn.close()
print(f"\nTotal: {total_apuestas} apuestas recalculadas en {len(partidos)} partido(s).")
