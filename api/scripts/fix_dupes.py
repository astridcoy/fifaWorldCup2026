"""
Detecta y elimina duplicados en la fase de grupos.
Estrategia: para cada par (equipo_local, equipo_visita) con múltiples filas,
conserva el registro con nombre_estadio correcto (no nulo/vacío) o el más reciente;
elimina los demás.
"""
import os, psycopg2, unicodedata, re

def norm(s):
    s = s.lower().strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s

url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
conn = psycopg2.connect(url)
cur  = conn.cursor()

cur.execute("""
    SELECT id, grupo, equipo_local, equipo_visita, fecha, nombre_estadio
    FROM partidos WHERE fase = 'Grupos'
    ORDER BY grupo, fecha, id
""")
rows = cur.fetchall()

# Grupo normalizado → lista de registros
from collections import defaultdict
grupos = defaultdict(list)
for r in rows:
    key = (norm(r[2]), norm(r[3]))   # (local_norm, visita_norm)
    grupos[key].append(r)

ids_borrar = []
for key, recs in grupos.items():
    if len(recs) <= 1:
        continue
    # Preferir el que tenga nombre_estadio con valor real
    con_estadio = [r for r in recs if r[5] and r[5].strip()]
    if con_estadio:
        keeper = con_estadio[-1]   # más reciente con estadio
    else:
        keeper = recs[-1]          # más reciente
    for r in recs:
        if r[0] != keeper[0]:
            ids_borrar.append(r[0])
            print(f"  BORRAR id={r[0]:4d}  [{r[1]}] {r[2]} vs {r[3]}  estadio={r[5]!r}")
    print(f"  KEEPER id={keeper[0]:4d}  [{keeper[1]}] {keeper[2]} vs {keeper[3]}  estadio={keeper[5]!r}")

print(f"\nTotal a borrar: {len(ids_borrar)}")
if ids_borrar:
    cur.execute("DELETE FROM partidos WHERE id = ANY(%s)", (ids_borrar,))
    conn.commit()
    print("Duplicados eliminados.")
else:
    print("Sin duplicados.")

# Verificar
cur.execute("SELECT grupo, COUNT(*) FROM partidos WHERE fase='Grupos' GROUP BY grupo ORDER BY grupo")
print()
total = 0
for g, c in cur.fetchall():
    flag = " <-- MAL" if c != 6 else ""
    print(f"  {g}: {c}{flag}")
    total += c
print(f"  TOTAL: {total} (esperado 72)")

cur.close()
conn.close()
