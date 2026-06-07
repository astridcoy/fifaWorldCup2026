/**
 * SCRIPT DE CARGA MASIVA — Fase de Grupos FIFA World Cup 2026
 *
 * Cómo usar:
 *   1. Abre la app en el navegador e inicia sesión como admin.
 *   2. Abre DevTools (F12) → pestaña "Consola".
 *   3. Copia y pega TODO este archivo y presiona Enter.
 *   4. El script detecta los partidos ya existentes y solo crea los faltantes.
 *
 * Todos los horarios están en hora de Chile (CLT = UTC-4, igual que EDT en junio).
 */

(async function poblarGrupos() {
  const API   = "https://polla-api-production.up.railway.app";
  const TOKEN = localStorage.getItem("token");
  if (!TOKEN) { console.error("❌ No hay sesión. Inicia sesión primero."); return; }
  const h = { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` };

  const TODOS = [
    // ── GRUPO A ────────────────────────────────────────────────────────────
    {equipo_local:"México",        bandera_local:"🇲🇽", equipo_visita:"Sudáfrica",       bandera_visita:"🇿🇦", fecha:"2026-06-11T15:00", fase:"Grupos", grupo:"Grupo A", nombre_estadio:"Estadio Azteca"},
    {equipo_local:"Corea del Sur", bandera_local:"🇰🇷", equipo_visita:"Rep. Checa",      bandera_visita:"🇨🇿", fecha:"2026-06-11T22:00", fase:"Grupos", grupo:"Grupo A", nombre_estadio:"Estadio Akron"},
    {equipo_local:"Rep. Checa",    bandera_local:"🇨🇿", equipo_visita:"Sudáfrica",       bandera_visita:"🇿🇦", fecha:"2026-06-18T12:00", fase:"Grupos", grupo:"Grupo A", nombre_estadio:"Mercedes-Benz Stadium"},
    {equipo_local:"México",        bandera_local:"🇲🇽", equipo_visita:"Corea del Sur",   bandera_visita:"🇰🇷", fecha:"2026-06-18T21:00", fase:"Grupos", grupo:"Grupo A", nombre_estadio:"Estadio Akron"},
    {equipo_local:"Sudáfrica",     bandera_local:"🇿🇦", equipo_visita:"Corea del Sur",   bandera_visita:"🇰🇷", fecha:"2026-06-24T21:00", fase:"Grupos", grupo:"Grupo A", nombre_estadio:"Estadio BBVA"},
    {equipo_local:"Rep. Checa",    bandera_local:"🇨🇿", equipo_visita:"México",          bandera_visita:"🇲🇽", fecha:"2026-06-24T21:00", fase:"Grupos", grupo:"Grupo A", nombre_estadio:"Estadio Azteca"},

    // ── GRUPO B ────────────────────────────────────────────────────────────
    {equipo_local:"Canadá",             bandera_local:"🇨🇦", equipo_visita:"Bosnia-Herzegovina", bandera_visita:"🇧🇦", fecha:"2026-06-12T15:00", fase:"Grupos", grupo:"Grupo B", nombre_estadio:"BMO Field"},
    {equipo_local:"Qatar",              bandera_local:"🇶🇦", equipo_visita:"Suiza",              bandera_visita:"🇨🇭", fecha:"2026-06-13T15:00", fase:"Grupos", grupo:"Grupo B", nombre_estadio:"Levi's Stadium"},
    {equipo_local:"Suiza",              bandera_local:"🇨🇭", equipo_visita:"Bosnia-Herzegovina", bandera_visita:"🇧🇦", fecha:"2026-06-18T15:00", fase:"Grupos", grupo:"Grupo B", nombre_estadio:"SoFi Stadium"},
    {equipo_local:"Canadá",             bandera_local:"🇨🇦", equipo_visita:"Qatar",              bandera_visita:"🇶🇦", fecha:"2026-06-18T18:00", fase:"Grupos", grupo:"Grupo B", nombre_estadio:"BC Place"},
    {equipo_local:"Suiza",              bandera_local:"🇨🇭", equipo_visita:"Canadá",             bandera_visita:"🇨🇦", fecha:"2026-06-24T15:00", fase:"Grupos", grupo:"Grupo B", nombre_estadio:"BC Place"},
    {equipo_local:"Bosnia-Herzegovina", bandera_local:"🇧🇦", equipo_visita:"Qatar",              bandera_visita:"🇶🇦", fecha:"2026-06-24T15:00", fase:"Grupos", grupo:"Grupo B", nombre_estadio:"Lumen Field"},

    // ── GRUPO C ────────────────────────────────────────────────────────────
    {equipo_local:"Brasil",    bandera_local:"🇧🇷", equipo_visita:"Marruecos",  bandera_visita:"🇲🇦", fecha:"2026-06-13T18:00", fase:"Grupos", grupo:"Grupo C", nombre_estadio:"MetLife Stadium"},
    {equipo_local:"Haití",     bandera_local:"🇭🇹", equipo_visita:"Escocia",    bandera_visita:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", fecha:"2026-06-13T21:00", fase:"Grupos", grupo:"Grupo C", nombre_estadio:"Gillette Stadium"},
    {equipo_local:"Escocia",   bandera_local:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", equipo_visita:"Marruecos",  bandera_visita:"🇲🇦", fecha:"2026-06-19T18:00", fase:"Grupos", grupo:"Grupo C", nombre_estadio:"Gillette Stadium"},
    {equipo_local:"Brasil",    bandera_local:"🇧🇷", equipo_visita:"Haití",      bandera_visita:"🇭🇹", fecha:"2026-06-19T21:00", fase:"Grupos", grupo:"Grupo C", nombre_estadio:"Lincoln Financial Field"},
    {equipo_local:"Marruecos", bandera_local:"🇲🇦", equipo_visita:"Haití",      bandera_visita:"🇭🇹", fecha:"2026-06-24T18:00", fase:"Grupos", grupo:"Grupo C", nombre_estadio:"Mercedes-Benz Stadium"},
    {equipo_local:"Escocia",   bandera_local:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", equipo_visita:"Brasil",     bandera_visita:"🇧🇷", fecha:"2026-06-24T18:00", fase:"Grupos", grupo:"Grupo C", nombre_estadio:"Hard Rock Stadium"},

    // ── GRUPO D ────────────────────────────────────────────────────────────
    {equipo_local:"Estados Unidos", bandera_local:"🇺🇸", equipo_visita:"Paraguay",        bandera_visita:"🇵🇾", fecha:"2026-06-12T21:00", fase:"Grupos", grupo:"Grupo D", nombre_estadio:"SoFi Stadium"},
    {equipo_local:"Australia",      bandera_local:"🇦🇺", equipo_visita:"Turquía",         bandera_visita:"🇹🇷", fecha:"2026-06-14T00:00", fase:"Grupos", grupo:"Grupo D", nombre_estadio:"BC Place"},
    {equipo_local:"Estados Unidos", bandera_local:"🇺🇸", equipo_visita:"Australia",       bandera_visita:"🇦🇺", fecha:"2026-06-19T15:00", fase:"Grupos", grupo:"Grupo D", nombre_estadio:"Lumen Field"},
    {equipo_local:"Turquía",        bandera_local:"🇹🇷", equipo_visita:"Paraguay",        bandera_visita:"🇵🇾", fecha:"2026-06-21T00:00", fase:"Grupos", grupo:"Grupo D", nombre_estadio:"Levi's Stadium"},
    {equipo_local:"Turquía",        bandera_local:"🇹🇷", equipo_visita:"Estados Unidos",  bandera_visita:"🇺🇸", fecha:"2026-06-25T22:00", fase:"Grupos", grupo:"Grupo D", nombre_estadio:"SoFi Stadium"},
    {equipo_local:"Paraguay",       bandera_local:"🇵🇾", equipo_visita:"Australia",       bandera_visita:"🇦🇺", fecha:"2026-06-25T22:00", fase:"Grupos", grupo:"Grupo D", nombre_estadio:"Levi's Stadium"},

    // ── GRUPO E ────────────────────────────────────────────────────────────
    {equipo_local:"Alemania",        bandera_local:"🇩🇪", equipo_visita:"Curazao",         bandera_visita:"🇨🇼", fecha:"2026-06-14T13:00", fase:"Grupos", grupo:"Grupo E", nombre_estadio:"NRG Stadium"},
    {equipo_local:"Costa de Marfil", bandera_local:"🇨🇮", equipo_visita:"Ecuador",         bandera_visita:"🇪🇨", fecha:"2026-06-14T19:00", fase:"Grupos", grupo:"Grupo E", nombre_estadio:"Lincoln Financial Field"},
    {equipo_local:"Alemania",        bandera_local:"🇩🇪", equipo_visita:"Costa de Marfil", bandera_visita:"🇨🇮", fecha:"2026-06-20T16:00", fase:"Grupos", grupo:"Grupo E", nombre_estadio:"BMO Field"},
    {equipo_local:"Ecuador",         bandera_local:"🇪🇨", equipo_visita:"Curazao",         bandera_visita:"🇨🇼", fecha:"2026-06-20T20:00", fase:"Grupos", grupo:"Grupo E", nombre_estadio:"Arrowhead Stadium"},
    {equipo_local:"Ecuador",         bandera_local:"🇪🇨", equipo_visita:"Alemania",        bandera_visita:"🇩🇪", fecha:"2026-06-25T16:00", fase:"Grupos", grupo:"Grupo E", nombre_estadio:"MetLife Stadium"},
    {equipo_local:"Curazao",         bandera_local:"🇨🇼", equipo_visita:"Costa de Marfil", bandera_visita:"🇨🇮", fecha:"2026-06-25T16:00", fase:"Grupos", grupo:"Grupo E", nombre_estadio:"Lincoln Financial Field"},

    // ── GRUPO F ────────────────────────────────────────────────────────────
    {equipo_local:"Países Bajos", bandera_local:"🇳🇱", equipo_visita:"Japón",        bandera_visita:"🇯🇵", fecha:"2026-06-14T16:00", fase:"Grupos", grupo:"Grupo F", nombre_estadio:"AT&T Stadium"},
    {equipo_local:"Suecia",       bandera_local:"🇸🇪", equipo_visita:"Túnez",        bandera_visita:"🇹🇳", fecha:"2026-06-14T22:00", fase:"Grupos", grupo:"Grupo F", nombre_estadio:"Estadio BBVA"},
    {equipo_local:"Países Bajos", bandera_local:"🇳🇱", equipo_visita:"Suecia",       bandera_visita:"🇸🇪", fecha:"2026-06-20T13:00", fase:"Grupos", grupo:"Grupo F", nombre_estadio:"NRG Stadium"},
    {equipo_local:"Túnez",        bandera_local:"🇹🇳", equipo_visita:"Japón",        bandera_visita:"🇯🇵", fecha:"2026-06-21T00:00", fase:"Grupos", grupo:"Grupo F", nombre_estadio:"Estadio BBVA"},
    {equipo_local:"Japón",        bandera_local:"🇯🇵", equipo_visita:"Suecia",       bandera_visita:"🇸🇪", fecha:"2026-06-25T19:00", fase:"Grupos", grupo:"Grupo F", nombre_estadio:"AT&T Stadium"},
    {equipo_local:"Túnez",        bandera_local:"🇹🇳", equipo_visita:"Países Bajos", bandera_visita:"🇳🇱", fecha:"2026-06-25T19:00", fase:"Grupos", grupo:"Grupo F", nombre_estadio:"Arrowhead Stadium"},

    // ── GRUPO G ────────────────────────────────────────────────────────────
    {equipo_local:"Bélgica",       bandera_local:"🇧🇪", equipo_visita:"Egipto",        bandera_visita:"🇪🇬", fecha:"2026-06-15T15:00", fase:"Grupos", grupo:"Grupo G", nombre_estadio:"Lumen Field"},
    {equipo_local:"Irán",          bandera_local:"🇮🇷", equipo_visita:"Nueva Zelanda", bandera_visita:"🇳🇿", fecha:"2026-06-15T21:00", fase:"Grupos", grupo:"Grupo G", nombre_estadio:"SoFi Stadium"},
    {equipo_local:"Bélgica",       bandera_local:"🇧🇪", equipo_visita:"Irán",          bandera_visita:"🇮🇷", fecha:"2026-06-21T15:00", fase:"Grupos", grupo:"Grupo G", nombre_estadio:"SoFi Stadium"},
    {equipo_local:"Nueva Zelanda", bandera_local:"🇳🇿", equipo_visita:"Egipto",        bandera_visita:"🇪🇬", fecha:"2026-06-21T21:00", fase:"Grupos", grupo:"Grupo G", nombre_estadio:"BC Place"},
    {equipo_local:"Egipto",        bandera_local:"🇪🇬", equipo_visita:"Irán",          bandera_visita:"🇮🇷", fecha:"2026-06-26T23:00", fase:"Grupos", grupo:"Grupo G", nombre_estadio:"Lumen Field"},
    {equipo_local:"Nueva Zelanda", bandera_local:"🇳🇿", equipo_visita:"Bélgica",       bandera_visita:"🇧🇪", fecha:"2026-06-26T23:00", fase:"Grupos", grupo:"Grupo G", nombre_estadio:"BC Place"},

    // ── GRUPO H ────────────────────────────────────────────────────────────
    {equipo_local:"España",        bandera_local:"🇪🇸", equipo_visita:"Cabo Verde",     bandera_visita:"🇨🇻", fecha:"2026-06-15T12:00", fase:"Grupos", grupo:"Grupo H", nombre_estadio:"Mercedes-Benz Stadium"},
    {equipo_local:"Arabia Saudita",bandera_local:"🇸🇦", equipo_visita:"Uruguay",        bandera_visita:"🇺🇾", fecha:"2026-06-15T18:00", fase:"Grupos", grupo:"Grupo H", nombre_estadio:"Hard Rock Stadium"},
    {equipo_local:"España",        bandera_local:"🇪🇸", equipo_visita:"Arabia Saudita", bandera_visita:"🇸🇦", fecha:"2026-06-21T12:00", fase:"Grupos", grupo:"Grupo H", nombre_estadio:"Mercedes-Benz Stadium"},
    {equipo_local:"Uruguay",       bandera_local:"🇺🇾", equipo_visita:"Cabo Verde",     bandera_visita:"🇨🇻", fecha:"2026-06-21T18:00", fase:"Grupos", grupo:"Grupo H", nombre_estadio:"Hard Rock Stadium"},
    {equipo_local:"Cabo Verde",    bandera_local:"🇨🇻", equipo_visita:"Arabia Saudita", bandera_visita:"🇸🇦", fecha:"2026-06-26T20:00", fase:"Grupos", grupo:"Grupo H", nombre_estadio:"NRG Stadium"},
    {equipo_local:"Uruguay",       bandera_local:"🇺🇾", equipo_visita:"España",         bandera_visita:"🇪🇸", fecha:"2026-06-26T20:00", fase:"Grupos", grupo:"Grupo H", nombre_estadio:"Estadio Akron"},

    // ── GRUPO I ────────────────────────────────────────────────────────────
    {equipo_local:"Francia",  bandera_local:"🇫🇷", equipo_visita:"Senegal",  bandera_visita:"🇸🇳", fecha:"2026-06-16T15:00", fase:"Grupos", grupo:"Grupo I", nombre_estadio:"MetLife Stadium"},
    {equipo_local:"Irak",     bandera_local:"🇮🇶", equipo_visita:"Noruega",  bandera_visita:"🇳🇴", fecha:"2026-06-16T18:00", fase:"Grupos", grupo:"Grupo I", nombre_estadio:"Gillette Stadium"},
    {equipo_local:"Francia",  bandera_local:"🇫🇷", equipo_visita:"Irak",     bandera_visita:"🇮🇶", fecha:"2026-06-22T17:00", fase:"Grupos", grupo:"Grupo I", nombre_estadio:"Lincoln Financial Field"},
    {equipo_local:"Noruega",  bandera_local:"🇳🇴", equipo_visita:"Senegal",  bandera_visita:"🇸🇳", fecha:"2026-06-22T20:00", fase:"Grupos", grupo:"Grupo I", nombre_estadio:"BMO Field"},
    {equipo_local:"Noruega",  bandera_local:"🇳🇴", equipo_visita:"Francia",  bandera_visita:"🇫🇷", fecha:"2026-06-26T15:00", fase:"Grupos", grupo:"Grupo I", nombre_estadio:"Gillette Stadium"},
    {equipo_local:"Senegal",  bandera_local:"🇸🇳", equipo_visita:"Irak",     bandera_visita:"🇮🇶", fecha:"2026-06-26T15:00", fase:"Grupos", grupo:"Grupo I", nombre_estadio:"BMO Field"},

    // ── GRUPO J ────────────────────────────────────────────────────────────
    {equipo_local:"Argentina", bandera_local:"🇦🇷", equipo_visita:"Argelia",   bandera_visita:"🇩🇿", fecha:"2026-06-16T21:00", fase:"Grupos", grupo:"Grupo J", nombre_estadio:"Arrowhead Stadium"},
    {equipo_local:"Austria",   bandera_local:"🇦🇹", equipo_visita:"Jordania",  bandera_visita:"🇯🇴", fecha:"2026-06-17T00:00", fase:"Grupos", grupo:"Grupo J", nombre_estadio:"Levi's Stadium"},
    {equipo_local:"Argentina", bandera_local:"🇦🇷", equipo_visita:"Austria",   bandera_visita:"🇦🇹", fecha:"2026-06-22T13:00", fase:"Grupos", grupo:"Grupo J", nombre_estadio:"AT&T Stadium"},
    {equipo_local:"Jordania",  bandera_local:"🇯🇴", equipo_visita:"Argelia",   bandera_visita:"🇩🇿", fecha:"2026-06-22T23:00", fase:"Grupos", grupo:"Grupo J", nombre_estadio:"Levi's Stadium"},
    {equipo_local:"Argelia",   bandera_local:"🇩🇿", equipo_visita:"Austria",   bandera_visita:"🇦🇹", fecha:"2026-06-27T22:00", fase:"Grupos", grupo:"Grupo J", nombre_estadio:"Arrowhead Stadium"},
    {equipo_local:"Jordania",  bandera_local:"🇯🇴", equipo_visita:"Argentina", bandera_visita:"🇦🇷", fecha:"2026-06-27T22:00", fase:"Grupos", grupo:"Grupo J", nombre_estadio:"AT&T Stadium"},

    // ── GRUPO K ────────────────────────────────────────────────────────────
    {equipo_local:"Portugal",    bandera_local:"🇵🇹", equipo_visita:"RD Congo",    bandera_visita:"🇨🇩", fecha:"2026-06-17T13:00", fase:"Grupos", grupo:"Grupo K", nombre_estadio:"NRG Stadium"},
    {equipo_local:"Uzbekistán",  bandera_local:"🇺🇿", equipo_visita:"Colombia",    bandera_visita:"🇨🇴", fecha:"2026-06-17T22:00", fase:"Grupos", grupo:"Grupo K", nombre_estadio:"Estadio Azteca"},
    {equipo_local:"Portugal",    bandera_local:"🇵🇹", equipo_visita:"Uzbekistán",  bandera_visita:"🇺🇿", fecha:"2026-06-23T13:00", fase:"Grupos", grupo:"Grupo K", nombre_estadio:"NRG Stadium"},
    {equipo_local:"Colombia",    bandera_local:"🇨🇴", equipo_visita:"RD Congo",    bandera_visita:"🇨🇩", fecha:"2026-06-23T22:00", fase:"Grupos", grupo:"Grupo K", nombre_estadio:"Estadio Akron"},
    {equipo_local:"Colombia",    bandera_local:"🇨🇴", equipo_visita:"Portugal",    bandera_visita:"🇵🇹", fecha:"2026-06-27T19:30", fase:"Grupos", grupo:"Grupo K", nombre_estadio:"Hard Rock Stadium"},
    {equipo_local:"RD Congo",    bandera_local:"🇨🇩", equipo_visita:"Uzbekistán",  bandera_visita:"🇺🇿", fecha:"2026-06-27T19:30", fase:"Grupos", grupo:"Grupo K", nombre_estadio:"Mercedes-Benz Stadium"},

    // ── GRUPO L ────────────────────────────────────────────────────────────
    {equipo_local:"Inglaterra", bandera_local:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", equipo_visita:"Croacia",    bandera_visita:"🇭🇷", fecha:"2026-06-17T16:00", fase:"Grupos", grupo:"Grupo L", nombre_estadio:"AT&T Stadium"},
    {equipo_local:"Ghana",      bandera_local:"🇬🇭", equipo_visita:"Panamá",    bandera_visita:"🇵🇦", fecha:"2026-06-17T19:00", fase:"Grupos", grupo:"Grupo L", nombre_estadio:"BMO Field"},
    {equipo_local:"Inglaterra", bandera_local:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", equipo_visita:"Ghana",      bandera_visita:"🇬🇭", fecha:"2026-06-23T16:00", fase:"Grupos", grupo:"Grupo L", nombre_estadio:"Gillette Stadium"},
    {equipo_local:"Panamá",     bandera_local:"🇵🇦", equipo_visita:"Croacia",    bandera_visita:"🇭🇷", fecha:"2026-06-23T19:00", fase:"Grupos", grupo:"Grupo L", nombre_estadio:"Gillette Stadium"},
    {equipo_local:"Panamá",     bandera_local:"🇵🇦", equipo_visita:"Inglaterra", bandera_visita:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", fecha:"2026-06-27T17:00", fase:"Grupos", grupo:"Grupo L", nombre_estadio:"MetLife Stadium"},
    {equipo_local:"Croacia",    bandera_local:"🇭🇷", equipo_visita:"Ghana",      bandera_visita:"🇬🇭", fecha:"2026-06-27T17:00", fase:"Grupos", grupo:"Grupo L", nombre_estadio:"Lincoln Financial Field"},
  ];

  console.log(`📋 Cargando ${TODOS.length} partidos de fase de grupos...`);

  // Obtener partidos existentes para evitar duplicados
  let existentes = [];
  try {
    const r = await fetch(`${API}/partidos`, { headers: h });
    existentes = await r.json();
  } catch (_) {}
  const yaExiste = new Set(
    existentes.map(p => `${p.equipo_local.toLowerCase()}|${p.equipo_visita.toLowerCase()}`)
  );

  const nuevos = TODOS.filter(p =>
    !yaExiste.has(`${p.equipo_local.toLowerCase()}|${p.equipo_visita.toLowerCase()}`)
  );
  console.log(`✅ Ya existen: ${existentes.length}  |  📥 Por crear: ${nuevos.length}`);
  if (!nuevos.length) { console.log("🏁 Nada nuevo que agregar."); return; }

  let ok = 0, err = 0;
  for (const p of nuevos) {
    try {
      const res  = await fetch(`${API}/admin/partido`, {
        method: "POST", headers: h,
        body: JSON.stringify({ ...p, imagen_estadio: null })
      });
      const data = await res.json();
      if (res.ok) {
        ok++;
        console.log(`✅ [${p.grupo}] ${p.bandera_local} ${p.equipo_local} vs ${p.equipo_visita} ${p.bandera_visita}  — ${p.fecha}`);
      } else {
        err++;
        console.warn(`❌ ${p.equipo_local} vs ${p.equipo_visita}: ${data.error || res.status}`);
      }
    } catch (e) {
      err++;
      console.warn(`❌ ${p.equipo_local} vs ${p.equipo_visita}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 120)); // evita saturar la API
  }
  console.log(`\n🏁 Listo — ✅ ${ok} creados  ❌ ${err} errores`);
  if (ok > 0) console.log("🔄 Recarga la página para ver los partidos.");
})();
