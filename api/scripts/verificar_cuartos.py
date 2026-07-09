"""
Verifica y corrige los partidos de Cuartos de Final en la DB.
Ejecutar: railway run python scripts/verificar_cuartos.py

Primero muestra los partidos actuales, luego inserta/actualiza según
los equipos definidos en QF_ESPERADOS.

⚠️  EDITAR los equipos de QF2 y QF4 si los resultados de R16 (7 jul)
    fueron diferentes a los provisionales.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ["DATABASE_URL"]
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ── EDITAR AQUÍ si los equipos cambiaron ──────────────────────────────────────
# Formato: (equipo_local, bandera_local, equipo_visita, bandera_visita, fecha, estadio)
QF_ESPERADOS = [
    ("Marruecos",  "🇲🇦", "Francia",     "🇫🇷",   "2026-07-09 16:00", "Cuartos", "Gillette Stadium"),
    ("España",     "🇪🇸", "Bélgica",     "🇧🇪",   "2026-07-10 12:00", "Cuartos", "SoFi Stadium"),
    ("Noruega",    "🇳🇴", "Inglaterra",  "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "2026-07-11 17:00", "Cuartos", "Hard Rock Stadium"),
    ("Argentina",  "🇦🇷", "Colombia",    "🇨🇴",   "2026-07-12 20:00", "Cuartos", "Arrowhead Stadium"),
]
# ─────────────────────────────────────────────────────────────────────────────

conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
cur  = conn.cursor()

print("\n── Cuartos en DB actualmente ─────────────────────────────────")
cur.execute("""
    SELECT id, equipo_local, equipo_visita, fecha, nombre_estadio, finalizado
    FROM partidos WHERE fase = 'Cuartos' ORDER BY fecha
""")
en_db = cur.fetchall()
for p in en_db:
    fin = "✅ finalizado" if p["finalizado"] else "⏳ pendiente"
    print(f"  [{p['id']}] {p['equipo_local']} vs {p['equipo_visita']}  |  {p['fecha']}  |  {p['nombre_estadio']}  {fin}")
print()

if not en_db:
    print("⚠️  No hay partidos de Cuartos. Se insertarán todos.")

# Indexar los existentes por estadio (clave única dentro de la fase)
por_estadio = {p["nombre_estadio"]: p for p in en_db}

insertados = 0
actualizados = 0

for eq_l, fl, eq_v, fv, fecha, fase, estadio in QF_ESPERADOS:
    existente = por_estadio.get(estadio)

    if existente is None:
        # No existe → insertar
        cur.execute("""
            INSERT INTO partidos
              (equipo_local, bandera_local, equipo_visita, bandera_visita,
               fecha, fase, nombre_estadio)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (eq_l, fl, eq_v, fv, fecha, fase, estadio))
        print(f"  ✅ INSERTADO: {eq_l} vs {eq_v}  ({estadio})")
        insertados += 1
    else:
        pid = existente["id"]
        cambios = []
        if existente["equipo_local"]  != eq_l: cambios.append(f"local: {existente['equipo_local']} → {eq_l}")
        if existente["equipo_visita"] != eq_v: cambios.append(f"visita: {existente['equipo_visita']} → {eq_v}")
        if cambios:
            cur.execute("""
                UPDATE partidos
                   SET equipo_local=%s, bandera_local=%s, equipo_visita=%s, bandera_visita=%s
                 WHERE id=%s
            """, (eq_l, fl, eq_v, fv, pid))
            print(f"  🔄 ACTUALIZADO [{pid}] {estadio}: {', '.join(cambios)}")
            actualizados += 1
        else:
            print(f"  ✓  SIN CAMBIOS [{pid}] {eq_l} vs {eq_v}  ({estadio})")

conn.commit()
cur.close()
conn.close()
print(f"\nResumen: {insertados} insertados, {actualizados} actualizados.")
