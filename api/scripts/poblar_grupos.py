"""
Script de carga masiva: Fase de Grupos FIFA World Cup 2026
Ejecutar con: railway run python scripts/poblar_grupos.py
(desde el directorio api/)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from config import DATABASE_URL

PARTIDOS = [
    # ── GRUPO A ────────────────────────────────────────────────────────────
    ("México",        "🇲🇽", "Sudáfrica",       "🇿🇦", "2026-06-11 15:00", "Grupos", "Grupo A", "Estadio Azteca"),
    ("Corea del Sur", "🇰🇷", "Rep. Checa",      "🇨🇿", "2026-06-11 22:00", "Grupos", "Grupo A", "Estadio Akron"),
    ("Rep. Checa",    "🇨🇿", "Sudáfrica",       "🇿🇦", "2026-06-18 12:00", "Grupos", "Grupo A", "Mercedes-Benz Stadium"),
    ("México",        "🇲🇽", "Corea del Sur",   "🇰🇷", "2026-06-18 21:00", "Grupos", "Grupo A", "Estadio Akron"),
    ("Sudáfrica",     "🇿🇦", "Corea del Sur",   "🇰🇷", "2026-06-24 21:00", "Grupos", "Grupo A", "Estadio BBVA"),
    ("Rep. Checa",    "🇨🇿", "México",          "🇲🇽", "2026-06-24 21:00", "Grupos", "Grupo A", "Estadio Azteca"),
    # ── GRUPO B ────────────────────────────────────────────────────────────
    ("Canadá",             "🇨🇦", "Bosnia-Herzegovina", "🇧🇦", "2026-06-12 15:00", "Grupos", "Grupo B", "BMO Field"),
    ("Qatar",              "🇶🇦", "Suiza",              "🇨🇭", "2026-06-13 15:00", "Grupos", "Grupo B", "Levi's Stadium"),
    ("Suiza",              "🇨🇭", "Bosnia-Herzegovina", "🇧🇦", "2026-06-18 15:00", "Grupos", "Grupo B", "SoFi Stadium"),
    ("Canadá",             "🇨🇦", "Qatar",              "🇶🇦", "2026-06-18 18:00", "Grupos", "Grupo B", "BC Place"),
    ("Suiza",              "🇨🇭", "Canadá",             "🇨🇦", "2026-06-24 15:00", "Grupos", "Grupo B", "BC Place"),
    ("Bosnia-Herzegovina", "🇧🇦", "Qatar",              "🇶🇦", "2026-06-24 15:00", "Grupos", "Grupo B", "Lumen Field"),
    # ── GRUPO C ────────────────────────────────────────────────────────────
    ("Brasil",    "🇧🇷", "Marruecos",  "🇲🇦", "2026-06-13 18:00", "Grupos", "Grupo C", "MetLife Stadium"),
    ("Haití",     "🇭🇹", "Escocia",    "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "2026-06-13 21:00", "Grupos", "Grupo C", "Gillette Stadium"),
    ("Escocia",   "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Marruecos",  "🇲🇦", "2026-06-19 18:00", "Grupos", "Grupo C", "Gillette Stadium"),
    ("Brasil",    "🇧🇷", "Haití",      "🇭🇹", "2026-06-19 21:00", "Grupos", "Grupo C", "Lincoln Financial Field"),
    ("Marruecos", "🇲🇦", "Haití",      "🇭🇹", "2026-06-24 18:00", "Grupos", "Grupo C", "Mercedes-Benz Stadium"),
    ("Escocia",   "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Brasil",     "🇧🇷", "2026-06-24 18:00", "Grupos", "Grupo C", "Hard Rock Stadium"),
    # ── GRUPO D ────────────────────────────────────────────────────────────
    ("Estados Unidos", "🇺🇸", "Paraguay",       "🇵🇾", "2026-06-12 21:00", "Grupos", "Grupo D", "SoFi Stadium"),
    ("Australia",      "🇦🇺", "Turquía",        "🇹🇷", "2026-06-14 00:00", "Grupos", "Grupo D", "BC Place"),
    ("Estados Unidos", "🇺🇸", "Australia",      "🇦🇺", "2026-06-19 15:00", "Grupos", "Grupo D", "Lumen Field"),
    ("Turquía",        "🇹🇷", "Paraguay",       "🇵🇾", "2026-06-21 00:00", "Grupos", "Grupo D", "Levi's Stadium"),
    ("Turquía",        "🇹🇷", "Estados Unidos", "🇺🇸", "2026-06-25 22:00", "Grupos", "Grupo D", "SoFi Stadium"),
    ("Paraguay",       "🇵🇾", "Australia",      "🇦🇺", "2026-06-25 22:00", "Grupos", "Grupo D", "Levi's Stadium"),
    # ── GRUPO E ────────────────────────────────────────────────────────────
    ("Alemania",        "🇩🇪", "Curazao",         "🇨🇼", "2026-06-14 13:00", "Grupos", "Grupo E", "NRG Stadium"),
    ("Costa de Marfil", "🇨🇮", "Ecuador",         "🇪🇨", "2026-06-14 19:00", "Grupos", "Grupo E", "Lincoln Financial Field"),
    ("Alemania",        "🇩🇪", "Costa de Marfil", "🇨🇮", "2026-06-20 16:00", "Grupos", "Grupo E", "BMO Field"),
    ("Ecuador",         "🇪🇨", "Curazao",         "🇨🇼", "2026-06-20 20:00", "Grupos", "Grupo E", "Arrowhead Stadium"),
    ("Ecuador",         "🇪🇨", "Alemania",        "🇩🇪", "2026-06-25 16:00", "Grupos", "Grupo E", "MetLife Stadium"),
    ("Curazao",         "🇨🇼", "Costa de Marfil", "🇨🇮", "2026-06-25 16:00", "Grupos", "Grupo E", "Lincoln Financial Field"),
    # ── GRUPO F ────────────────────────────────────────────────────────────
    ("Países Bajos", "🇳🇱", "Japón",        "🇯🇵", "2026-06-14 16:00", "Grupos", "Grupo F", "AT&T Stadium"),
    ("Suecia",       "🇸🇪", "Túnez",        "🇹🇳", "2026-06-14 22:00", "Grupos", "Grupo F", "Estadio BBVA"),
    ("Países Bajos", "🇳🇱", "Suecia",       "🇸🇪", "2026-06-20 13:00", "Grupos", "Grupo F", "NRG Stadium"),
    ("Túnez",        "🇹🇳", "Japón",        "🇯🇵", "2026-06-21 00:00", "Grupos", "Grupo F", "Estadio BBVA"),
    ("Japón",        "🇯🇵", "Suecia",       "🇸🇪", "2026-06-25 19:00", "Grupos", "Grupo F", "AT&T Stadium"),
    ("Túnez",        "🇹🇳", "Países Bajos", "🇳🇱", "2026-06-25 19:00", "Grupos", "Grupo F", "Arrowhead Stadium"),
    # ── GRUPO G ────────────────────────────────────────────────────────────
    ("Bélgica",       "🇧🇪", "Egipto",        "🇪🇬", "2026-06-15 15:00", "Grupos", "Grupo G", "Lumen Field"),
    ("Irán",          "🇮🇷", "Nueva Zelanda", "🇳🇿", "2026-06-15 21:00", "Grupos", "Grupo G", "SoFi Stadium"),
    ("Bélgica",       "🇧🇪", "Irán",          "🇮🇷", "2026-06-21 15:00", "Grupos", "Grupo G", "SoFi Stadium"),
    ("Nueva Zelanda", "🇳🇿", "Egipto",        "🇪🇬", "2026-06-21 21:00", "Grupos", "Grupo G", "BC Place"),
    ("Egipto",        "🇪🇬", "Irán",          "🇮🇷", "2026-06-26 23:00", "Grupos", "Grupo G", "Lumen Field"),
    ("Nueva Zelanda", "🇳🇿", "Bélgica",       "🇧🇪", "2026-06-26 23:00", "Grupos", "Grupo G", "BC Place"),
    # ── GRUPO H ────────────────────────────────────────────────────────────
    ("España",        "🇪🇸", "Cabo Verde",     "🇨🇻", "2026-06-15 12:00", "Grupos", "Grupo H", "Mercedes-Benz Stadium"),
    ("Arabia Saudita","🇸🇦", "Uruguay",        "🇺🇾", "2026-06-15 18:00", "Grupos", "Grupo H", "Hard Rock Stadium"),
    ("España",        "🇪🇸", "Arabia Saudita", "🇸🇦", "2026-06-21 12:00", "Grupos", "Grupo H", "Mercedes-Benz Stadium"),
    ("Uruguay",       "🇺🇾", "Cabo Verde",     "🇨🇻", "2026-06-21 18:00", "Grupos", "Grupo H", "Hard Rock Stadium"),
    ("Cabo Verde",    "🇨🇻", "Arabia Saudita", "🇸🇦", "2026-06-26 20:00", "Grupos", "Grupo H", "NRG Stadium"),
    ("Uruguay",       "🇺🇾", "España",         "🇪🇸", "2026-06-26 20:00", "Grupos", "Grupo H", "Estadio Akron"),
    # ── GRUPO I ────────────────────────────────────────────────────────────
    ("Francia",  "🇫🇷", "Senegal",  "🇸🇳", "2026-06-16 15:00", "Grupos", "Grupo I", "MetLife Stadium"),
    ("Irak",     "🇮🇶", "Noruega",  "🇳🇴", "2026-06-16 18:00", "Grupos", "Grupo I", "Gillette Stadium"),
    ("Francia",  "🇫🇷", "Irak",     "🇮🇶", "2026-06-22 17:00", "Grupos", "Grupo I", "Lincoln Financial Field"),
    ("Noruega",  "🇳🇴", "Senegal",  "🇸🇳", "2026-06-22 20:00", "Grupos", "Grupo I", "BMO Field"),
    ("Noruega",  "🇳🇴", "Francia",  "🇫🇷", "2026-06-26 15:00", "Grupos", "Grupo I", "Gillette Stadium"),
    ("Senegal",  "🇸🇳", "Irak",     "🇮🇶", "2026-06-26 15:00", "Grupos", "Grupo I", "BMO Field"),
    # ── GRUPO J ────────────────────────────────────────────────────────────
    ("Argentina", "🇦🇷", "Argelia",   "🇩🇿", "2026-06-16 21:00", "Grupos", "Grupo J", "Arrowhead Stadium"),
    ("Austria",   "🇦🇹", "Jordania",  "🇯🇴", "2026-06-17 00:00", "Grupos", "Grupo J", "Levi's Stadium"),
    ("Argentina", "🇦🇷", "Austria",   "🇦🇹", "2026-06-22 13:00", "Grupos", "Grupo J", "AT&T Stadium"),
    ("Jordania",  "🇯🇴", "Argelia",   "🇩🇿", "2026-06-22 23:00", "Grupos", "Grupo J", "Levi's Stadium"),
    ("Argelia",   "🇩🇿", "Austria",   "🇦🇹", "2026-06-27 22:00", "Grupos", "Grupo J", "Arrowhead Stadium"),
    ("Jordania",  "🇯🇴", "Argentina", "🇦🇷", "2026-06-27 22:00", "Grupos", "Grupo J", "AT&T Stadium"),
    # ── GRUPO K ────────────────────────────────────────────────────────────
    ("Portugal",   "🇵🇹", "RD Congo",   "🇨🇩", "2026-06-17 13:00", "Grupos", "Grupo K", "NRG Stadium"),
    ("Uzbekistán", "🇺🇿", "Colombia",   "🇨🇴", "2026-06-17 22:00", "Grupos", "Grupo K", "Estadio Azteca"),
    ("Portugal",   "🇵🇹", "Uzbekistán", "🇺🇿", "2026-06-23 13:00", "Grupos", "Grupo K", "NRG Stadium"),
    ("Colombia",   "🇨🇴", "RD Congo",   "🇨🇩", "2026-06-23 22:00", "Grupos", "Grupo K", "Estadio Akron"),
    ("Colombia",   "🇨🇴", "Portugal",   "🇵🇹", "2026-06-27 19:30", "Grupos", "Grupo K", "Hard Rock Stadium"),
    ("RD Congo",   "🇨🇩", "Uzbekistán", "🇺🇿", "2026-06-27 19:30", "Grupos", "Grupo K", "Mercedes-Benz Stadium"),
    # ── GRUPO L ────────────────────────────────────────────────────────────
    ("Inglaterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croacia",    "🇭🇷", "2026-06-17 16:00", "Grupos", "Grupo L", "AT&T Stadium"),
    ("Ghana",      "🇬🇭", "Panamá",    "🇵🇦", "2026-06-17 19:00", "Grupos", "Grupo L", "BMO Field"),
    ("Inglaterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Ghana",      "🇬🇭", "2026-06-23 16:00", "Grupos", "Grupo L", "Gillette Stadium"),
    ("Panamá",     "🇵🇦", "Croacia",    "🇭🇷", "2026-06-23 19:00", "Grupos", "Grupo L", "Gillette Stadium"),
    ("Panamá",     "🇵🇦", "Inglaterra", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "2026-06-27 17:00", "Grupos", "Grupo L", "MetLife Stadium"),
    ("Croacia",    "🇭🇷", "Ghana",      "🇬🇭", "2026-06-27 17:00", "Grupos", "Grupo L", "Lincoln Financial Field"),
]

def main():
    url = DATABASE_URL
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    conn = psycopg2.connect(url)
    cur  = conn.cursor()

    # Fetch existing matches to skip duplicates
    cur.execute("SELECT equipo_local, equipo_visita FROM partidos WHERE fase = 'Grupos'")
    existentes = {(r[0].lower(), r[1].lower()) for r in cur.fetchall()}
    print(f"Ya existen {len(existentes)} partidos de grupos en la DB.")

    nuevos = [p for p in PARTIDOS if (p[0].lower(), p[2].lower()) not in existentes]
    print(f"Por insertar: {len(nuevos)}")

    ok = 0
    for p in nuevos:
        eq_local, fl_local, eq_visita, fl_visita, fecha, fase, grupo, estadio = p
        cur.execute(
            """INSERT INTO partidos
               (equipo_local, bandera_local, equipo_visita, bandera_visita,
                fecha, fase, grupo, nombre_estadio, finalizado, goles_local, goles_visita)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,FALSE,NULL,NULL)""",
            (eq_local, fl_local, eq_visita, fl_visita, fecha, fase, grupo, estadio)
        )
        ok += 1
        print(f"  OK [{grupo}] {eq_local} vs {eq_visita}  {fecha}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nListo — {ok} partidos insertados.")

if __name__ == "__main__":
    main()
