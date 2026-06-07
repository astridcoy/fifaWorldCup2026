import os, psycopg2
url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
conn = psycopg2.connect(url)
cur  = conn.cursor()
cur.execute(
    "SELECT id,grupo,equipo_local,equipo_visita FROM partidos "
    "WHERE fase='Grupos' ORDER BY grupo,id"
)
rows = cur.fetchall()
for r in rows:
    print(r[0], r[1], "|", r[2], "vs", r[3])
print("TOTAL:", len(rows))
conn.close()
