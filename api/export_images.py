"""
Exports stadium images from DB to out_images/.
Run with: railway run python export_images.py
"""
import os
import base64
import re
import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur  = conn.cursor()

cur.execute("""
    SELECT DISTINCT ON (nombre_estadio)
        nombre_estadio, imagen_estadio
    FROM partidos
    WHERE imagen_estadio IS NOT NULL
      AND nombre_estadio IS NOT NULL
      AND nombre_estadio != ''
    ORDER BY nombre_estadio
""")
rows = cur.fetchall()
cur.close()
conn.close()

os.makedirs("out_images", exist_ok=True)
print(f"Found {len(rows)} unique stadiums with images.\n")

for nombre, data in rows:
    if not data:
        continue
    if data.startswith("data:"):
        m = re.match(r"data:(image/(\w+));base64,(.*)", data, re.DOTALL)
        if not m:
            print(f"SKIP  {nombre!r}: format not recognized")
            continue
        ext  = "jpg" if m.group(2).lower() == "jpeg" else m.group(2).lower()
        b64  = m.group(3)
    else:
        ext = "jpg"
        b64 = data

    try:
        img_bytes = base64.b64decode(b64)
    except Exception as e:
        print(f"SKIP  {nombre!r}: {e}")
        continue

    slug  = re.sub(r"[^\w]", "_", nombre.lower()).strip("_")
    slug  = re.sub(r"_+", "_", slug)
    fname = f"out_images/{slug}.{ext}"
    with open(fname, "wb") as f:
        f.write(img_bytes)
    print(f"OK    {nombre!r}  ->  {fname}  ({len(img_bytes):,} bytes)")

print("\nDone. Copy out_images/ -> frontend/img/estadios/")
