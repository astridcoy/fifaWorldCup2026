import os, psycopg2

# IDs of old English-named duplicates (superseded by new Spanish records)
OLD_IDS = [2, 3, 5, 8, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23]

url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
conn = psycopg2.connect(url)
cur  = conn.cursor()

# Show what we're about to delete
cur.execute("SELECT id,grupo,equipo_local,equipo_visita FROM partidos WHERE id=ANY(%s) ORDER BY grupo,id", (OLD_IDS,))
for r in cur.fetchall():
    print(f"  DELETE id={r[0]} [{r[1]}] {r[2]} vs {r[3]}")

cur.execute("DELETE FROM partidos WHERE id=ANY(%s)", (OLD_IDS,))
conn.commit()
print(f"\nEliminados {len(OLD_IDS)} registros.")

# Verify
cur.execute("SELECT grupo, COUNT(*) FROM partidos WHERE fase='Grupos' GROUP BY grupo ORDER BY grupo")
total = 0
for g, c in cur.fetchall():
    flag = " <-- MAL" if c != 6 else ""
    print(f"  {g}: {c}{flag}")
    total += c
print(f"  TOTAL: {total} (esperado 72)")

cur.close()
conn.close()
