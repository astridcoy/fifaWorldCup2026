const EQUIPOS = [
  // Grupo A
  "🇲🇽 México","🇿🇦 Sudáfrica","🇰🇷 Corea del Sur","🇨🇿 Rep. Checa",
  // Grupo B
  "🇨🇦 Canadá","🇧🇦 Bosnia-Herzegovina","🇶🇦 Qatar","🇨🇭 Suiza",
  // Grupo C
  "🇧🇷 Brasil","🇲🇦 Marruecos","🇭🇹 Haití","🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia",
  // Grupo D
  "🇺🇸 Estados Unidos","🇵🇾 Paraguay","🇦🇺 Australia","🇹🇷 Turquía",
  // Grupo E
  "🇩🇪 Alemania","🇨🇼 Curazao","🇨🇮 Costa de Marfil","🇪🇨 Ecuador",
  // Grupo F
  "🇳🇱 Países Bajos","🇯🇵 Japón","🇸🇪 Suecia","🇹🇳 Túnez",
  // Grupo G
  "🇧🇪 Bélgica","🇪🇬 Egipto","🇮🇷 Irán","🇳🇿 Nueva Zelanda",
  // Grupo H
  "🇪🇸 España","🇨🇻 Cabo Verde","🇸🇦 Arabia Saudita","🇺🇾 Uruguay",
  // Grupo I
  "🇫🇷 Francia","🇸🇳 Senegal","🇮🇶 Irak","🇳🇴 Noruega",
  // Grupo J
  "🇦🇷 Argentina","🇩🇿 Argelia","🇦🇹 Austria","🇯🇴 Jordania",
  // Grupo K
  "🇵🇹 Portugal","🇨🇩 RD Congo","🇺🇿 Uzbekistán","🇨🇴 Colombia",
  // Grupo L
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra","🇭🇷 Croacia","🇬🇭 Ghana","🇵🇦 Panamá"
];

const selCampeon = document.getElementById("sel-campeon");
EQUIPOS.forEach(eq => {
  const opt = document.createElement("option");
  opt.value = eq; opt.textContent = eq;
  selCampeon.appendChild(opt);
});

function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatFecha(fechaStr) {
  return new Date(fechaStr).toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago"
  });
}

function estaAbierto(partido) {
  const deadline = new Date(partido.fecha).getTime() - 24 * 60 * 60 * 1000;
  return !partido.finalizado && Date.now() < deadline;
}

async function cargarMiCampeon() {
  try {
    const res  = await fetch(`${API}/mi-campeon`, { headers: headers() });
    const data = await res.json();
    if (data.campeon) selCampeon.value = data.campeon;
  } catch (_) {}
}

document.getElementById("btn-campeon").addEventListener("click", async () => {
  const campeon = selCampeon.value;
  if (!campeon) { toast("Selecciona un equipo primero", "error"); return; }
  try {
    const res  = await fetch(`${API}/campeon`, { method: "POST", headers: headers(), body: JSON.stringify({ campeon }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Error al apostar campeón", "error"); return; }
    toast(`✅ Campeón apostado: ${campeon}`);
  } catch (_) { toast("Error de conexión", "error"); }
});

let partidos       = [];
let faseActiva     = "";
let soloSinApostar = false;

function mostrarSkeleton() {
  document.getElementById("partidos-grid").innerHTML = Array(6).fill(0).map(() => `
    <div class="match-card placeholder-glow" style="cursor:default">
      <div class="placeholder w-100" style="height:130px;border-radius:10px;margin-bottom:.85rem"></div>
      <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
        <span class="placeholder rounded-circle" style="width:44px;height:44px;flex-shrink:0"></span>
        <span class="placeholder" style="width:52px;height:30px;border-radius:8px"></span>
        <span class="placeholder rounded-circle" style="width:44px;height:44px;flex-shrink:0"></span>
      </div>
      <span class="placeholder col-7 mx-auto d-block mb-3" style="height:13px;border-radius:4px"></span>
      <span class="placeholder col-12" style="height:44px;border-radius:8px"></span>
    </div>`).join("");
}

function updateStatsBar() {
  const total       = partidos.length;
  const apostados   = partidos.filter(p => p.goles_local_apostado !== null && p.goles_local_apostado !== undefined).length;
  const abiertos    = partidos.filter(p => estaAbierto(p));
  const pendientes  = abiertos.filter(p => p.goles_local_apostado === null || p.goles_local_apostado === undefined).length;
  const finalizados = partidos.filter(p => p.finalizado && p.goles_local_apostado !== null && p.goles_local_apostado !== undefined);
  const pts         = finalizados.reduce((acc, p) => acc + calcularPuntosLocal(p), 0);
  const pct         = total > 0 ? Math.round(apostados / total * 100) : 0;
  const barColor    = pct === 100 ? "var(--green)" : pct >= 50 ? "var(--gold)" : "#fb923c";
  document.getElementById("stats-bar").innerHTML = `
    <div class="stats-bar-item"><span class="stats-bar-num">${apostados}</span><span class="stats-bar-label">apostados</span></div>
    <div class="stats-bar-divider"></div>
    <div class="stats-bar-item"><span class="stats-bar-num amber">${pendientes}</span><span class="stats-bar-label">pendientes</span></div>
    <div class="stats-bar-divider"></div>
    <div class="stats-bar-item"><span class="stats-bar-num gold">${pts}</span><span class="stats-bar-label">pts ganados</span></div>
    <div class="stats-bar-progress-wrap">
      <span class="stats-bar-progress-label">${apostados} / ${total} partidos · ${pct}%</span>
      <div class="stats-progress"><div class="stats-progress-bar" style="width:${pct}%;background:${barColor}"></div></div>
    </div>`;
}

async function cargarPartidos() {
  mostrarSkeleton();
  try {
    const res = await fetch(`${API}/partidos`, { headers: headers() });
    partidos  = await res.json();
    construirTabs();
    renderPartidos();
    updateStatsBar();
  } catch (_) {
    document.getElementById("partidos-grid").innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>No se pudo cargar los partidos</h3>
        <p>Verifica que el servidor esté activo</p>
      </div>`;
  }
}

function construirTabs() {
  const fases = [...new Set(partidos.map(p => p.fase))];
  faseActiva  = fases[0] || "";
  const cont  = document.getElementById("tabs-fases");
  cont.innerHTML = "";
  fases.forEach(fase => {
    const pend = partidos.filter(p =>
      p.fase === fase && estaAbierto(p) &&
      (p.goles_local_apostado === null || p.goles_local_apostado === undefined)
    ).length;
    const badgeVal = fase === "Grupos"
      ? new Set(partidos.filter(p => p.fase === "Grupos" && p.grupo).map(p => p.grupo)).size
      : pend;
    const btn = document.createElement("button");
    btn.className = "phase-tab" + (fase === faseActiva ? " active" : "");
    btn.innerHTML  = fase + (badgeVal > 0 ? ` <span class="tab-badge">${badgeVal}</span>` : "");
    btn.addEventListener("click", () => {
      faseActiva = fase;
      cont.querySelectorAll(".phase-tab:not(.filter-tab)").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderPartidos();
    });
    cont.appendChild(btn);
  });
  const filterBtn = document.createElement("button");
  filterBtn.className = "phase-tab filter-tab ms-auto" + (soloSinApostar ? " active" : "");
  filterBtn.innerHTML = `<i class="bi bi-funnel${soloSinApostar ? "-fill" : ""} me-1"></i>Sin apostar`;
  filterBtn.addEventListener("click", () => {
    soloSinApostar = !soloSinApostar;
    filterBtn.classList.toggle("active", soloSinApostar);
    filterBtn.innerHTML = `<i class="bi bi-funnel${soloSinApostar ? "-fill" : ""} me-1"></i>Sin apostar`;
    renderPartidos();
  });
  cont.appendChild(filterBtn);
}

function renderPartidos() {
  const grid = document.getElementById("partidos-grid");
  let lista  = partidos.filter(p => p.fase === faseActiva).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  if (soloSinApostar) lista = lista.filter(p => estaAbierto(p) && (p.goles_local_apostado === null || p.goles_local_apostado === undefined));
  if (!lista.length) {
    grid.innerHTML = soloSinApostar
      ? `<div class="empty-state"><span class="empty-icon">✅</span><h3>¡Todo apostado en esta fase!</h3><p>Ya registraste apuesta en todos los partidos abiertos.</p></div>`
      : `<div class="empty-state"><span class="empty-icon">📭</span><h3>No hay partidos en esta fase</h3></div>`;
    return;
  }
  if (faseActiva === "Grupos" && !soloSinApostar) {
    renderGruposAccordion(grid, lista);
    return;
  }
  grid.innerHTML = lista.map(p => tarjetaPartido(p)).join("");
  lista.forEach(p => {
    const btn = document.getElementById(`btn-apostar-${p.id}`);
    if (btn) btn.addEventListener("click", () => registrarApuesta(p.id));
  });
}

function renderGruposAccordion(grid, lista) {
  const featured  = lista.slice(0, 3);
  const rest      = lista.slice(3);

  const grupos = {};
  rest.forEach(p => {
    const g = p.grupo || "Sin grupo";
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(p);
  });

  const featuredHTML = `
    <div class="grupos-featured-label"><i class="bi bi-star-fill me-2" style="color:var(--gold)"></i>Primeros partidos del Mundial</div>
    <div class="grupos-featured-grid">
      ${featured.map(p => tarjetaPartido(p)).join("")}
    </div>
    <div class="grupos-section-label"><i class="bi bi-grid-3x3-gap-fill me-2"></i>Partidos por grupo</div>`;

  const accordionId = "accordion-grupos";
  const accordionItems = Object.entries(grupos)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([grupo, ps], idx) => {
      const collapseId  = `collapse-grupo-${idx}`;
      const isFirst     = idx === 0;
      const pendientes  = ps.filter(p => estaAbierto(p) && (p.goles_local_apostado === null || p.goles_local_apostado === undefined)).length;
      return `
        <div class="accordion-item" style="background:var(--card-bg);border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:.6rem;overflow:hidden">
          <h2 class="accordion-header">
            <button class="accordion-button ${isFirst ? "" : "collapsed"}" type="button"
              data-bs-toggle="collapse" data-bs-target="#${collapseId}"
              style="background:var(--card-bg);color:#e8eef7;box-shadow:none;padding:.85rem 1.1rem;gap:.6rem;font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.5px">
              <i class="bi bi-grid-3x3-gap-fill" style="color:var(--gold);font-size:.9rem"></i>
              ${escHtml(grupo)}
              <span style="font-family:system-ui,sans-serif;font-size:.75rem;font-weight:400;color:var(--text-sub);margin-left:.2rem">${ps.length} partidos</span>
              ${pendientes > 0 ? `<span class="tab-badge">${pendientes}</span>` : ""}
            </button>
          </h2>
          <div id="${collapseId}" class="accordion-collapse collapse ${isFirst ? "show" : ""}">
            <div class="accordion-body" style="padding:.75rem .75rem 1rem;background:rgba(0,0,0,.12)">
              <div class="grupos-mini-grid">
                ${ps.map(p => tarjetaPartido(p)).join("")}
              </div>
            </div>
          </div>
        </div>`;
    }).join("");

  grid.innerHTML = `<div style="grid-column:1/-1;width:100%">${featuredHTML}<div class="accordion accordion-flush" id="${accordionId}">${accordionItems}</div></div>`;

  lista.forEach(p => {
    const btn = document.getElementById(`btn-apostar-${p.id}`);
    if (btn) btn.addEventListener("click", () => registrarApuesta(p.id));
  });
}

// ── Lookup tables ──────────────────────────────────────────────
const STADIUM_DB = {
  "azteca":       {city:"Ciudad de México",    country:"🇲🇽 México",  capacity:"87,523", maps:"https://maps.google.com/?q=Estadio+Azteca+Mexico+City"},
  "mexico city":  {city:"Ciudad de México",    country:"🇲🇽 México",  capacity:"87,523", maps:"https://maps.google.com/?q=Estadio+Azteca+Mexico+City"},
  "guadalajara":  {city:"Guadalajara, Jalisco",country:"🇲🇽 México",  capacity:"49,850", maps:"https://maps.google.com/?q=Estadio+Akron+Guadalajara"},
  "akron":        {city:"Guadalajara, Jalisco",country:"🇲🇽 México",  capacity:"49,850", maps:"https://maps.google.com/?q=Estadio+Akron+Guadalajara"},
  "bbva":         {city:"Monterrey, N.L.",     country:"🇲🇽 México",  capacity:"51,350", maps:"https://maps.google.com/?q=Estadio+BBVA+Monterrey"},
  "monterrey":    {city:"Monterrey, N.L.",     country:"🇲🇽 México",  capacity:"51,350", maps:"https://maps.google.com/?q=Estadio+BBVA+Monterrey"},
  "bmo":          {city:"Toronto, Ontario",    country:"🇨🇦 Canadá",  capacity:"45,736", maps:"https://maps.google.com/?q=BMO+Field+Toronto"},
  "toronto":      {city:"Toronto, Ontario",    country:"🇨🇦 Canadá",  capacity:"45,736", maps:"https://maps.google.com/?q=BMO+Field+Toronto"},
  "bc place":     {city:"Vancouver, BC",       country:"🇨🇦 Canadá",  capacity:"54,500", maps:"https://maps.google.com/?q=BC+Place+Vancouver"},
  "vancouver":    {city:"Vancouver, BC",       country:"🇨🇦 Canadá",  capacity:"54,500", maps:"https://maps.google.com/?q=BC+Place+Vancouver"},
  "metlife":      {city:"East Rutherford, NJ", country:"🇺🇸 EE.UU.", capacity:"82,500", maps:"https://maps.google.com/?q=MetLife+Stadium+East+Rutherford"},
  "new york":     {city:"East Rutherford, NJ", country:"🇺🇸 EE.UU.", capacity:"82,500", maps:"https://maps.google.com/?q=MetLife+Stadium+East+Rutherford"},
  "at&t":         {city:"Arlington, TX",       country:"🇺🇸 EE.UU.", capacity:"80,000", maps:"https://maps.google.com/?q=AT%26T+Stadium+Arlington+Texas"},
  "arlington":    {city:"Arlington, TX",       country:"🇺🇸 EE.UU.", capacity:"80,000", maps:"https://maps.google.com/?q=AT%26T+Stadium+Arlington+Texas"},
  "dallas":       {city:"Arlington, TX",       country:"🇺🇸 EE.UU.", capacity:"80,000", maps:"https://maps.google.com/?q=AT%26T+Stadium+Arlington+Texas"},
  "sofi":         {city:"Inglewood, CA",       country:"🇺🇸 EE.UU.", capacity:"70,240", maps:"https://maps.google.com/?q=SoFi+Stadium+Inglewood"},
  "angeles":      {city:"Inglewood, CA",       country:"🇺🇸 EE.UU.", capacity:"70,240", maps:"https://maps.google.com/?q=SoFi+Stadium+Inglewood"},
  "levi":         {city:"Santa Clara, CA",     country:"🇺🇸 EE.UU.", capacity:"68,500", maps:"https://maps.google.com/?q=Levi%27s+Stadium+Santa+Clara"},
  "santa clara":  {city:"Santa Clara, CA",     country:"🇺🇸 EE.UU.", capacity:"68,500", maps:"https://maps.google.com/?q=Levi%27s+Stadium+Santa+Clara"},
  "arrowhead":    {city:"Kansas City, MO",     country:"🇺🇸 EE.UU.", capacity:"76,416", maps:"https://maps.google.com/?q=Arrowhead+Stadium+Kansas+City"},
  "kansas":       {city:"Kansas City, MO",     country:"🇺🇸 EE.UU.", capacity:"76,416", maps:"https://maps.google.com/?q=Arrowhead+Stadium+Kansas+City"},
  "lincoln":      {city:"Philadelphia, PA",    country:"🇺🇸 EE.UU.", capacity:"69,796", maps:"https://maps.google.com/?q=Lincoln+Financial+Field+Philadelphia"},
  "philadelphia": {city:"Philadelphia, PA",    country:"🇺🇸 EE.UU.", capacity:"69,796", maps:"https://maps.google.com/?q=Lincoln+Financial+Field+Philadelphia"},
  "hard rock":    {city:"Miami Gardens, FL",   country:"🇺🇸 EE.UU.", capacity:"65,326", maps:"https://maps.google.com/?q=Hard+Rock+Stadium+Miami"},
  "miami":        {city:"Miami Gardens, FL",   country:"🇺🇸 EE.UU.", capacity:"65,326", maps:"https://maps.google.com/?q=Hard+Rock+Stadium+Miami"},
  "gillette":     {city:"Foxborough, MA",      country:"🇺🇸 EE.UU.", capacity:"65,878", maps:"https://maps.google.com/?q=Gillette+Stadium+Foxborough"},
  "boston":       {city:"Foxborough, MA",      country:"🇺🇸 EE.UU.", capacity:"65,878", maps:"https://maps.google.com/?q=Gillette+Stadium+Foxborough"},
  "empower":      {city:"Denver, CO",          country:"🇺🇸 EE.UU.", capacity:"76,125", maps:"https://maps.google.com/?q=Empower+Field+Denver"},
  "denver":       {city:"Denver, CO",          country:"🇺🇸 EE.UU.", capacity:"76,125", maps:"https://maps.google.com/?q=Empower+Field+Denver"},
  "lumen":        {city:"Seattle, WA",         country:"🇺🇸 EE.UU.", capacity:"68,740", maps:"https://maps.google.com/?q=Lumen+Field+Seattle"},
  "seattle":      {city:"Seattle, WA",         country:"🇺🇸 EE.UU.", capacity:"68,740", maps:"https://maps.google.com/?q=Lumen+Field+Seattle"},
  "nrg":          {city:"Houston, TX",         country:"🇺🇸 EE.UU.", capacity:"72,220", maps:"https://maps.google.com/?q=NRG+Stadium+Houston"},
  "houston":      {city:"Houston, TX",         country:"🇺🇸 EE.UU.", capacity:"72,220", maps:"https://maps.google.com/?q=NRG+Stadium+Houston"},
  "mercedes":     {city:"Atlanta, GA",         country:"🇺🇸 EE.UU.", capacity:"71,000", maps:"https://maps.google.com/?q=Mercedes-Benz+Stadium+Atlanta"},
  "atlanta":      {city:"Atlanta, GA",         country:"🇺🇸 EE.UU.", capacity:"71,000", maps:"https://maps.google.com/?q=Mercedes-Benz+Stadium+Atlanta"},
};

const TEAM_DB = {
  "argentina":            {conf:"CONMEBOL",titles:3,best:"Campeón 1978, 1986, 2022",       nickname:"La Albiceleste",         confColor:"#4fc3f7", website:"https://www.afa.com.ar"},
  "brasil":               {conf:"CONMEBOL",titles:5,best:"Campeón 1958, 62, 70, 94, 2002", nickname:"A Seleção / La Canarinha",confColor:"#4fc3f7", website:"https://www.cbf.com.br"},
  "brazil":               {conf:"CONMEBOL",titles:5,best:"Campeón 1958, 62, 70, 94, 2002", nickname:"La Canarinha",           confColor:"#4fc3f7", website:"https://www.cbf.com.br"},
  "francia":              {conf:"UEFA",    titles:2,best:"Campeón 1998, 2018",              nickname:"Les Bleus",              confColor:"#7fb3f5", website:"https://www.fff.fr"},
  "france":               {conf:"UEFA",    titles:2,best:"Campeón 1998, 2018",              nickname:"Les Bleus",              confColor:"#7fb3f5", website:"https://www.fff.fr"},
  "españa":               {conf:"UEFA",    titles:1,best:"Campeón 2010",                    nickname:"La Roja",                confColor:"#7fb3f5", website:"https://www.rfef.es"},
  "spain":                {conf:"UEFA",    titles:1,best:"Campeón 2010",                    nickname:"La Roja",                confColor:"#7fb3f5", website:"https://www.rfef.es"},
  "alemania":             {conf:"UEFA",    titles:4,best:"Campeón 1954, 74, 90, 2014",      nickname:"Die Mannschaft",         confColor:"#7fb3f5", website:"https://www.dfb.de"},
  "germany":              {conf:"UEFA",    titles:4,best:"Campeón 1954, 74, 90, 2014",      nickname:"Die Mannschaft",         confColor:"#7fb3f5", website:"https://www.dfb.de"},
  "portugal":             {conf:"UEFA",    titles:0,best:"3er lugar 1966",                  nickname:"A Seleção das Quinas",   confColor:"#7fb3f5", website:"https://www.fpf.pt"},
  "inglaterra":           {conf:"UEFA",    titles:1,best:"Campeón 1966",                    nickname:"The Three Lions",        confColor:"#7fb3f5", website:"https://www.thefa.com"},
  "england":              {conf:"UEFA",    titles:1,best:"Campeón 1966",                    nickname:"The Three Lions",        confColor:"#7fb3f5", website:"https://www.thefa.com"},
  "países bajos":         {conf:"UEFA",    titles:0,best:"Finalista 1974, 1978, 2010",      nickname:"La Naranja Mecánica",    confColor:"#7fb3f5", website:"https://www.knvb.nl"},
  "netherlands":          {conf:"UEFA",    titles:0,best:"Finalista 1974, 1978, 2010",      nickname:"La Naranja Mecánica",    confColor:"#7fb3f5", website:"https://www.knvb.nl"},
  "bélgica":              {conf:"UEFA",    titles:0,best:"3er lugar 2018",                  nickname:"Los Diablos Rojos",      confColor:"#7fb3f5", website:"https://www.rbfa.be"},
  "belgium":              {conf:"UEFA",    titles:0,best:"3er lugar 2018",                  nickname:"Los Diablos Rojos",      confColor:"#7fb3f5", website:"https://www.rbfa.be"},
  "uruguay":              {conf:"CONMEBOL",titles:2,best:"Campeón 1930, 1950",              nickname:"La Celeste",             confColor:"#4fc3f7", website:"https://www.auf.org.uy"},
  "méxico":               {conf:"CONCACAF",titles:0,best:"Cuartos de final 1970, 1986",     nickname:"El Tri",                 confColor:"#4ade80", website:"https://www.miseleccion.mx"},
  "mexico":               {conf:"CONCACAF",titles:0,best:"Cuartos de final 1970, 1986",     nickname:"El Tri",                 confColor:"#4ade80", website:"https://www.miseleccion.mx"},
  "estados unidos":       {conf:"CONCACAF",titles:0,best:"3er lugar 1930",                  nickname:"The Stars & Stripes",    confColor:"#4ade80", website:"https://www.ussoccer.com"},
  "united states":        {conf:"CONCACAF",titles:0,best:"3er lugar 1930",                  nickname:"The Stars & Stripes",    confColor:"#4ade80", website:"https://www.ussoccer.com"},
  "canadá":               {conf:"CONCACAF",titles:0,best:"Fase de grupos 1986",             nickname:"The Canucks",            confColor:"#4ade80", website:"https://www.canadasoccer.com"},
  "canada":               {conf:"CONCACAF",titles:0,best:"Fase de grupos 1986",             nickname:"The Canucks",            confColor:"#4ade80", website:"https://www.canadasoccer.com"},
  "japón":                {conf:"AFC",     titles:0,best:"Octavos de final 2002, 10, 22",   nickname:"Los Samurais Azules",    confColor:"#f87171", website:"https://www.jfa.jp"},
  "japan":                {conf:"AFC",     titles:0,best:"Octavos de final 2002, 10, 22",   nickname:"Los Samurais Azules",    confColor:"#f87171", website:"https://www.jfa.jp"},
  "corea del sur":        {conf:"AFC",     titles:0,best:"4to lugar 2002",                  nickname:"Los Guerreros Taeguk",   confColor:"#f87171", website:"https://www.kfa.or.kr"},
  "south korea":          {conf:"AFC",     titles:0,best:"4to lugar 2002",                  nickname:"Los Guerreros Taeguk",   confColor:"#f87171", website:"https://www.kfa.or.kr"},
  "marruecos":            {conf:"CAF",     titles:0,best:"4to lugar 2022",                  nickname:"Los Leones del Atlas",   confColor:"#fbbf24", website:"https://www.frmf.ma"},
  "morocco":              {conf:"CAF",     titles:0,best:"4to lugar 2022",                  nickname:"Los Leones del Atlas",   confColor:"#fbbf24", website:"https://www.frmf.ma"},
  "senegal":              {conf:"CAF",     titles:0,best:"Cuartos de final 2002",           nickname:"Los Leones de Teranga",  confColor:"#fbbf24", website:"https://www.fsf.sn"},
  "colombia":             {conf:"CONMEBOL",titles:0,best:"Cuartos de final 2014",           nickname:"Los Cafeteros",          confColor:"#4fc3f7", website:"https://fcf.com.co"},
  "chile":                {conf:"CONMEBOL",titles:0,best:"3er lugar 1962",                  nickname:"La Roja",                confColor:"#4fc3f7", website:"https://www.anfp.cl"},
  "costa rica":           {conf:"CONCACAF",titles:0,best:"Cuartos de final 2014",           nickname:"Los Ticos",              confColor:"#4ade80", website:"https://www.fedefutbol.com"},
  "polonia":              {conf:"UEFA",    titles:0,best:"3er lugar 1974, 1982",            nickname:"Los Águilas Blancas",    confColor:"#7fb3f5", website:"https://www.pzpn.pl"},
  "poland":               {conf:"UEFA",    titles:0,best:"3er lugar 1974, 1982",            nickname:"Los Águilas Blancas",    confColor:"#7fb3f5", website:"https://www.pzpn.pl"},
  "serbia":               {conf:"UEFA",    titles:0,best:"Finalista (Yugoslavia) 1954",     nickname:"Las Águilas",            confColor:"#7fb3f5", website:"https://www.fss.rs"},
  "australia":            {conf:"AFC",     titles:0,best:"Cuartos de final 2022",           nickname:"Los Socceroos",          confColor:"#f87171", website:"https://www.footballaustralia.com.au"},
  "ghana":                {conf:"CAF",     titles:0,best:"Cuartos de final 2010",           nickname:"Las Estrellas Negras",   confColor:"#fbbf24", website:"https://gfa.com.gh"},
  "arabia saudita":       {conf:"AFC",     titles:0,best:"Octavos de final 1994",           nickname:"Las Águilas Verdes",     confColor:"#f87171", website:"https://www.saff.com.sa"},
  "saudi arabia":         {conf:"AFC",     titles:0,best:"Octavos de final 1994",           nickname:"Las Águilas Verdes",     confColor:"#f87171", website:"https://www.saff.com.sa"},
  "sudáfrica":            {conf:"CAF",     titles:0,best:"Fase de grupos (local) 2010",     nickname:"Bafana Bafana",          confColor:"#fbbf24", website:"https://www.safa.net"},
  "south africa":         {conf:"CAF",     titles:0,best:"Fase de grupos (local) 2010",     nickname:"Bafana Bafana",          confColor:"#fbbf24", website:"https://www.safa.net"},
  "czech republic":       {conf:"UEFA",    titles:0,best:"Finalista (Checoslov.) 1934",     nickname:"Los Leones",             confColor:"#7fb3f5", website:"https://www.fotbal.cz"},
  "república checa":      {conf:"UEFA",    titles:0,best:"Finalista (Checoslov.) 1934",     nickname:"Los Leones",             confColor:"#7fb3f5", website:"https://www.fotbal.cz"},
  "bosnia":               {conf:"UEFA",    titles:0,best:"Fase de grupos 2014",             nickname:"Los Zmajevi (Dragones)", confColor:"#7fb3f5", website:"https://www.nfsbih.ba"},
  "bosnia & herzegovina": {conf:"UEFA",    titles:0,best:"Fase de grupos 2014",             nickname:"Los Zmajevi (Dragones)", confColor:"#7fb3f5", website:"https://www.nfsbih.ba"},
  "croacia":              {conf:"UEFA",    titles:0,best:"3er lugar 1998, 2022",            nickname:"Los Vatreni (Llamas)",   confColor:"#7fb3f5", website:"https://www.hns-cff.hr"},
  "croatia":              {conf:"UEFA",    titles:0,best:"3er lugar 1998, 2022",            nickname:"Los Vatreni (Llamas)",   confColor:"#7fb3f5", website:"https://www.hns-cff.hr"},
  "nigeria":              {conf:"CAF",     titles:0,best:"Octavos de final 1994, 1998",     nickname:"Las Súper Águilas",      confColor:"#fbbf24", website:"https://thenff.com"},
  "ecuador":              {conf:"CONMEBOL",titles:0,best:"Octavos de final 2006",           nickname:"La Tricolor",            confColor:"#4fc3f7", website:"https://www.fef.ec"},
  "perú":                 {conf:"CONMEBOL",titles:0,best:"Cuartos de final 1970",           nickname:"La Blanquirroja",        confColor:"#4fc3f7", website:"https://www.fpf.com.pe"},
  "venezuela":            {conf:"CONMEBOL",titles:0,best:"Debutante en 2026",               nickname:"La Vinotinto",           confColor:"#4fc3f7", website:"https://www.federacionvenezolanadefutbol.org"},
  "suiza":                {conf:"UEFA",    titles:0,best:"Cuartos de final 1934, 38, 54",   nickname:"La Nati",                confColor:"#7fb3f5", website:"https://www.sfl.ch"},
  "switzerland":          {conf:"UEFA",    titles:0,best:"Cuartos de final 1934, 38, 54",   nickname:"La Nati",                confColor:"#7fb3f5", website:"https://www.sfl.ch"},
  "dinamarca":            {conf:"UEFA",    titles:0,best:"Cuartos de final 1998",           nickname:"Los Dinamitas",          confColor:"#7fb3f5", website:"https://www.dbu.dk"},
  "denmark":              {conf:"UEFA",    titles:0,best:"Cuartos de final 1998",           nickname:"Los Dinamitas",          confColor:"#7fb3f5", website:"https://www.dbu.dk"},
  "turquía":              {conf:"UEFA",    titles:0,best:"3er lugar 2002",                  nickname:"La Media Luna",          confColor:"#7fb3f5", website:"https://www.tff.org"},
  "turkey":               {conf:"UEFA",    titles:0,best:"3er lugar 2002",                  nickname:"La Media Luna",          confColor:"#7fb3f5", website:"https://www.tff.org"},
  "ucrania":              {conf:"UEFA",    titles:0,best:"Cuartos de final 2006",           nickname:"La Zbirna",              confColor:"#7fb3f5", website:"https://uaf.ua"},
  "ukraine":              {conf:"UEFA",    titles:0,best:"Cuartos de final 2006",           nickname:"La Zbirna",              confColor:"#7fb3f5", website:"https://uaf.ua"},
  // ── Nuevos equipos WC 2026 ──────────────────────────────────────────────
  "qatar":                {conf:"AFC",     titles:0,best:"Fase de grupos 2022 (local)",     nickname:"Los Maroon",             confColor:"#f87171", website:"https://www.qfa.qa"},
  "haití":                {conf:"CONCACAF",titles:0,best:"Cuartos de final 1974",           nickname:"Les Grenadiers",         confColor:"#4ade80", website:"https://www.fhf.ht"},
  "haiti":                {conf:"CONCACAF",titles:0,best:"Cuartos de final 1974",           nickname:"Les Grenadiers",         confColor:"#4ade80", website:"https://www.fhf.ht"},
  "escocia":              {conf:"UEFA",    titles:0,best:"Fase de grupos (múltiples)",      nickname:"The Tartan Army",        confColor:"#7fb3f5", website:"https://www.scottishfa.co.uk"},
  "scotland":             {conf:"UEFA",    titles:0,best:"Fase de grupos (múltiples)",      nickname:"The Tartan Army",        confColor:"#7fb3f5", website:"https://www.scottishfa.co.uk"},
  "curazao":              {conf:"CONCACAF",titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Djou Bèrdènan",      confColor:"#4ade80", website:"https://www.knvbcuracao.com"},
  "curacao":              {conf:"CONCACAF",titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Djou Bèrdènan",      confColor:"#4ade80", website:"https://www.knvbcuracao.com"},
  "costa de marfil":      {conf:"CAF",     titles:0,best:"Cuartos de final 2006",           nickname:"Los Elefantes",          confColor:"#fbbf24", website:"https://www.fif.ci"},
  "ivory coast":          {conf:"CAF",     titles:0,best:"Cuartos de final 2006",           nickname:"Los Elefantes",          confColor:"#fbbf24", website:"https://www.fif.ci"},
  "suecia":               {conf:"UEFA",    titles:0,best:"3er lugar 1994",                  nickname:"Blågult (Az.-Amarillo)", confColor:"#7fb3f5", website:"https://www.svenskfotboll.se"},
  "sweden":               {conf:"UEFA",    titles:0,best:"3er lugar 1994",                  nickname:"Blågult (Az.-Amarillo)", confColor:"#7fb3f5", website:"https://www.svenskfotboll.se"},
  "túnez":                {conf:"CAF",     titles:0,best:"Octavos de final 1978",           nickname:"Los Águilas de Cartago", confColor:"#fbbf24", website:"https://www.ftf.org.tn"},
  "tunisia":              {conf:"CAF",     titles:0,best:"Octavos de final 1978",           nickname:"Los Águilas de Cartago", confColor:"#fbbf24", website:"https://www.ftf.org.tn"},
  "irán":                 {conf:"AFC",     titles:0,best:"Fase de grupos (múltiples)",      nickname:"Team Melli",             confColor:"#f87171", website:"https://www.ffiri.ir"},
  "iran":                 {conf:"AFC",     titles:0,best:"Fase de grupos (múltiples)",      nickname:"Team Melli",             confColor:"#f87171", website:"https://www.ffiri.ir"},
  "nueva zelanda":        {conf:"OFC",     titles:0,best:"Fase de grupos 1982, 2010",       nickname:"Los All Whites",         confColor:"#f87171", website:"https://www.nzfootball.co.nz"},
  "new zealand":          {conf:"OFC",     titles:0,best:"Fase de grupos 1982, 2010",       nickname:"Los All Whites",         confColor:"#f87171", website:"https://www.nzfootball.co.nz"},
  "cabo verde":           {conf:"CAF",     titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Tubarões Azuis",     confColor:"#fbbf24", website:"https://www.fcv.cv"},
  "cape verde":           {conf:"CAF",     titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Tubarões Azuis",     confColor:"#fbbf24", website:"https://www.fcv.cv"},
  "irak":                 {conf:"AFC",     titles:0,best:"Fase de grupos 1986",             nickname:"Los Leones de Mesopot.", confColor:"#f87171", website:"https://www.ifo.iq"},
  "iraq":                 {conf:"AFC",     titles:0,best:"Fase de grupos 1986",             nickname:"Los Leones de Mesopot.", confColor:"#f87171", website:"https://www.ifo.iq"},
  "noruega":              {conf:"UEFA",    titles:0,best:"Cuartos de final 1938",           nickname:"Løvene (Los Leones)",    confColor:"#7fb3f5", website:"https://www.fotball.no"},
  "norway":               {conf:"UEFA",    titles:0,best:"Cuartos de final 1938",           nickname:"Løvene (Los Leones)",    confColor:"#7fb3f5", website:"https://www.fotball.no"},
  "argelia":              {conf:"CAF",     titles:0,best:"Octavos de final 2014",           nickname:"Los Zorros del Desierto",confColor:"#fbbf24", website:"https://www.faf.dz"},
  "algeria":              {conf:"CAF",     titles:0,best:"Octavos de final 2014",           nickname:"Los Zorros del Desierto",confColor:"#fbbf24", website:"https://www.faf.dz"},
  "austria":              {conf:"UEFA",    titles:0,best:"3er lugar 1954",                  nickname:"Das Team",               confColor:"#7fb3f5", website:"https://www.oefb.at"},
  "jordania":             {conf:"AFC",     titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Nashama",            confColor:"#f87171", website:"https://www.jfa.jo"},
  "jordan":               {conf:"AFC",     titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Nashama",            confColor:"#f87171", website:"https://www.jfa.jo"},
  "rd congo":             {conf:"CAF",     titles:0,best:"Cuartos de final 1974 (Zaire)",   nickname:"Los Leopardos",          confColor:"#fbbf24", website:"https://www.fecofa.org"},
  "dr congo":             {conf:"CAF",     titles:0,best:"Cuartos de final 1974 (Zaire)",   nickname:"Los Leopardos",          confColor:"#fbbf24", website:"https://www.fecofa.org"},
  "uzbekistán":           {conf:"AFC",     titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Lobos Blancos",      confColor:"#f87171", website:"https://www.ufa.uz"},
  "uzbekistan":           {conf:"AFC",     titles:0,best:"Debut Copa Mundial 2026",         nickname:"Los Lobos Blancos",      confColor:"#f87171", website:"https://www.ufa.uz"},
  "panamá":               {conf:"CONCACAF",titles:0,best:"Fase de grupos 2018",             nickname:"Los Canaleros",          confColor:"#4ade80", website:"https://www.fepafut.com"},
  "panama":               {conf:"CONCACAF",titles:0,best:"Fase de grupos 2018",             nickname:"Los Canaleros",          confColor:"#4ade80", website:"https://www.fepafut.com"},
  "paraguay":             {conf:"CONMEBOL",titles:0,best:"Cuartos de final 1954, 2010",     nickname:"La Albirroja",           confColor:"#4fc3f7", website:"https://www.apf.org.py"},
  "rep. checa":           {conf:"UEFA",    titles:0,best:"Finalista (Checoslov.) 1934",     nickname:"Los Leones",             confColor:"#7fb3f5", website:"https://www.fotbal.cz"},
  "república checa":      {conf:"UEFA",    titles:0,best:"Finalista (Checoslov.) 1934",     nickname:"Los Leones",             confColor:"#7fb3f5", website:"https://www.fotbal.cz"},
  "bosnia-herzegovina":   {conf:"UEFA",    titles:0,best:"Fase de grupos 2014",             nickname:"Los Zmajevi (Dragones)", confColor:"#7fb3f5", website:"https://www.nfsbih.ba"},
  "egipto":               {conf:"CAF",     titles:0,best:"Fase de grupos 1990",             nickname:"Los Faraones",           confColor:"#fbbf24", website:"https://www.efa.com.eg"},
  "egypt":                {conf:"CAF",     titles:0,best:"Fase de grupos 1990",             nickname:"Los Faraones",           confColor:"#fbbf24", website:"https://www.efa.com.eg"},
};

function getStadiumInfo(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const key of Object.keys(STADIUM_DB)) { if (lower.includes(key)) return STADIUM_DB[key]; }
  return null;
}

function getTeamInfo(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  if (TEAM_DB[lower]) return TEAM_DB[lower];
  for (const key of Object.keys(TEAM_DB)) { if (lower.includes(key) || key.includes(lower)) return TEAM_DB[key]; }
  return null;
}

function buildEquipoCardHTML(flag, name, info) {
  if (!info) return `<div class="modal-equipo-card"><span class="modal-equipo-flag">${flag}</span><span class="modal-equipo-name">${escHtml(name)}</span><span class="modal-equipo-nickname" style="margin-top:.5rem">Datos no disponibles</span></div>`;
  return `
    <div class="modal-equipo-card">
      <span class="modal-equipo-flag">${flag}</span>
      <span class="modal-equipo-name">${escHtml(name)}</span>
      <span class="modal-conf-badge" style="background:${info.confColor}18;border-color:${info.confColor}44;color:${info.confColor}">${info.conf}</span>
      <span class="modal-equipo-nickname">"${info.nickname}"</span>
      <div class="modal-equipo-stats">
        <div class="modal-equipo-stat">
          <span>🏆 Títulos Mundiales</span>
          <span class="${info.titles > 0 ? "modal-equipo-titles" : ""}">${info.titles > 0 ? info.titles + " Copa" + (info.titles > 1 ? "s" : "") : "Sin títulos"}</span>
        </div>
        <div class="modal-equipo-stat">
          <span>🌟 Mejor resultado</span>
          <span>${info.best}</span>
        </div>
      </div>
      ${info.website ? `<a href="${info.website}" target="_blank" rel="noopener" class="modal-team-btn"><i class="bi bi-globe2"></i> Sitio Oficial</a>` : ""}
    </div>`;
}

function _setModalBetArea(p) {
  const abierto    = estaAbierto(p);
  const yaApostado = p.goles_local_apostado !== null && p.goles_local_apostado !== undefined;
  const intentos   = p.intentos || 0;
  const bloqueado  = yaApostado && intentos >= 2;
  const betEl      = document.getElementById("modal-bet-area");

  if (abierto && !bloqueado) {
    const attemptDots = yaApostado ? `
      <div class="attempt-dots" style="justify-content:center;margin-bottom:.6rem">
        <span class="adot ${intentos >= 1 ? "used" : ""}"></span>
        <span class="adot ${intentos >= 2 ? "used" : ""}"></span>
        <span style="font-size:.7rem;color:var(--text-sub);margin-left:.3rem">${intentos}/2 usados</span>
      </div>` : "";
    betEl.innerHTML = `
      <div class="modal-bet-inner">
        <span class="modal-bet-label">
          <i class="bi bi-${yaApostado ? "pencil-fill" : "check-circle"}"></i>
          ${yaApostado ? "Actualizar apuesta" : "Registrar apuesta"}
        </span>
        ${attemptDots}
        <div class="bet-inputs" style="justify-content:center;gap:1.2rem;margin:.75rem 0">
          <input type="number" class="bet-input" min="0" max="10"
            value="${yaApostado ? p.goles_local_apostado : 0}"
            id="modal-gl-${p.id}"
            style="width:60px;font-size:1.4rem;text-align:center;padding:.35rem" />
          <span class="bet-separator" style="font-size:1.4rem;line-height:1">–</span>
          <input type="number" class="bet-input" min="0" max="10"
            value="${yaApostado ? p.goles_visita_apostado : 0}"
            id="modal-gv-${p.id}"
            style="width:60px;font-size:1.4rem;text-align:center;padding:.35rem" />
        </div>
        <button class="btn-fifa-green w-100" id="modal-btn-apostar-${p.id}">
          <i class="bi bi-${yaApostado ? "pencil" : "check-circle"} me-1"></i>
          ${yaApostado ? "Actualizar apuesta" : "Apostar"}
        </button>
      </div>`;
    document.getElementById(`modal-btn-apostar-${p.id}`)
      .addEventListener("click", () => registrarApuestaModal(p.id));
  } else if (abierto && bloqueado) {
    betEl.innerHTML = `
      <div class="modal-bet-inner">
        <span class="modal-bet-label"><i class="bi bi-pencil-fill"></i>Tu apuesta</span>
        <div class="modal-bet-score">${p.goles_local_apostado} – ${p.goles_visita_apostado}</div>
        <div class="attempt-dots" style="justify-content:center;margin-top:.6rem">
          <span class="adot used"></span><span class="adot used"></span>
          <span style="font-size:.7rem;color:var(--red);margin-left:.3rem">
            <i class="bi bi-lock-fill me-1"></i>Límite de 2 intentos alcanzado
          </span>
        </div>
      </div>`;
  } else if (yaApostado) {
    const pts = p.finalizado ? calcularPuntosLocal(p) : null;
    const ptsBadge = pts !== null
      ? `<span class="pts-badge ${pts===3?"pts-3":pts===1?"pts-1":"pts-0"}" style="font-size:.82rem">${pts===3?"⭐":pts===1?"✓":"✗"} ${pts} pts</span>`
      : "";
    betEl.innerHTML = `
      <div class="modal-bet-inner">
        <span class="modal-bet-label"><i class="bi bi-pencil-fill"></i>Tu apuesta</span>
        <div class="modal-bet-score">${p.goles_local_apostado} – ${p.goles_visita_apostado}</div>
        ${ptsBadge}
        <span class="modal-intentos"><i class="bi bi-arrow-repeat"></i>${intentos}/2 intentos</span>
      </div>`;
  } else {
    betEl.innerHTML = `
      <div class="modal-no-bet" style="opacity:.6">
        <i class="bi bi-slash-circle"></i>No apostaste en este partido
      </div>`;
  }
}

function showModalPartido(p) {
  const abierto    = estaAbierto(p);
  const yaApostado = p.goles_local_apostado !== null && p.goles_local_apostado !== undefined;
  const intentos   = p.intentos || 0;
  bootstrap.Tab.getOrCreateInstance(document.querySelector("#modalTabs .nav-link")).show();
  document.getElementById("modal-hero").style.backgroundImage = p.imagen_estadio ? `url(${p.imagen_estadio})` : "";
  document.getElementById("modal-phase-chip").textContent = `${p.fase}${p.grupo ? " · Grupo " + p.grupo : ""}`;
  document.getElementById("modal-venue").textContent      = p.nombre_estadio || "";
  document.getElementById("modal-flag-l").textContent = p.bandera_local;
  document.getElementById("modal-name-l").textContent = p.equipo_local;
  document.getElementById("modal-flag-v").textContent = p.bandera_visita;
  document.getElementById("modal-name-v").textContent = p.equipo_visita;
  document.getElementById("modal-center-score").innerHTML = p.finalizado
    ? `<div class="modal-final-score">${p.goles_local}<span style="color:var(--text-sub);margin:0 .2rem">–</span>${p.goles_visita}</div><div class="modal-final-label">Resultado final</div>`
    : `<div class="modal-vs-big">VS</div>`;
  document.getElementById("modal-date-str").innerHTML = `<i class="bi bi-calendar3 me-1"></i>${formatFecha(p.fecha)}`;
  const statusEl = document.getElementById("modal-status-block");
  const now = new Date(), kickoff = new Date(p.fecha);
  if (p.finalizado) {
    statusEl.innerHTML = `<span class="modal-finished-tag"><i class="bi bi-check-circle-fill me-1"></i>Partido finalizado</span>`;
  } else if (now >= kickoff) {
    statusEl.innerHTML = `<span class="modal-live-tag"><i class="bi bi-circle-fill me-1"></i>En curso</span>`;
  } else {
    const diff = kickoff - now;
    const days = Math.floor(diff / 86400000), hours = Math.floor((diff % 86400000) / 3600000), mins = Math.floor((diff % 3600000) / 60000);
    statusEl.innerHTML = `<div class="modal-countdown"><span class="countdown-label">Faltan</span>${days > 0 ? `<span class="countdown-unit">${days}<small>d</small></span>` : ""}${(hours > 0 || days > 0) ? `<span class="countdown-unit">${hours}<small>h</small></span>` : ""}<span class="countdown-unit">${mins}<small>m</small></span></div>`;
  }
  _setModalBetArea(p);
  const st = getStadiumInfo(p.nombre_estadio);
  const mapsUrl = st?.maps || `https://maps.google.com/?q=${encodeURIComponent(p.nombre_estadio || "FIFA 2026 Stadium")}`;
  document.getElementById("modal-estadio-content").innerHTML = `
    <div class="modal-estadio-stats">
      <div class="modal-stat-tile"><i class="bi bi-building"></i><span class="modal-stat-label">Estadio</span><span class="modal-stat-value">${escHtml(p.nombre_estadio) || "—"}</span></div>
      <div class="modal-stat-tile"><i class="bi bi-geo-alt-fill"></i><span class="modal-stat-label">Ciudad</span><span class="modal-stat-value">${st?.city || "—"}</span></div>
      <div class="modal-stat-tile"><i class="bi bi-flag-fill"></i><span class="modal-stat-label">País sede</span><span class="modal-stat-value">${st?.country || "—"}</span></div>
      <div class="modal-stat-tile"><i class="bi bi-people-fill"></i><span class="modal-stat-label">Capacidad</span><span class="modal-stat-value">${st?.capacity ? st.capacity + " espectadores" : "—"}</span></div>
      <div class="modal-stat-tile"><i class="bi bi-soccer-ball"></i><span class="modal-stat-label">Fase</span><span class="modal-stat-value">${escHtml(p.fase)}${p.grupo ? " · Grupo " + escHtml(p.grupo) : ""}</span></div>
      <div class="modal-stat-tile"><i class="bi bi-calendar3-event"></i><span class="modal-stat-label">Fecha</span><span class="modal-stat-value" style="font-size:.8rem">${formatFecha(p.fecha)}</span></div>
    </div>
    <a href="${mapsUrl}" target="_blank" rel="noopener" class="modal-maps-btn"><i class="bi bi-map-fill"></i>Abrir en Google Maps</a>`;
  document.getElementById("modal-equipos-content").innerHTML = `
    <div class="modal-equipos-grid">
      ${buildEquipoCardHTML(p.bandera_local,  p.equipo_local,  getTeamInfo(p.equipo_local))}
      ${buildEquipoCardHTML(p.bandera_visita, p.equipo_visita, getTeamInfo(p.equipo_visita))}
    </div>`;
  bootstrap.Modal.getOrCreateInstance(document.getElementById("modalPartido")).show();
}

document.getElementById("partidos-grid").addEventListener("click", (e) => {
  if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) return;
  const card = e.target.closest(".match-card[data-pid]");
  if (!card) return;
  const p = partidos.find(x => x.id === parseInt(card.dataset.pid));
  if (p) showModalPartido(p);
});

function tarjetaPartido(p) {
  const abierto    = estaAbierto(p);
  const yaApostado = p.goles_local_apostado !== null && p.goles_local_apostado !== undefined;
  const intentos   = p.intentos || 0;
  const bloqueado  = yaApostado && intentos >= 2;
  const clases     = ["match-card", p.finalizado ? "finalizado" : "", yaApostado ? "apostado" : ""].join(" ");
  let puntosCorner = "";
  if (p.finalizado && yaApostado) {
    const pts = calcularPuntosLocal(p);
    const cls = pts === 3 ? "pts-3" : pts === 1 ? "pts-1" : "pts-0";
    const ico = pts === 3 ? "⭐" : pts === 1 ? "✓" : "✗";
    puntosCorner = `<span class="pts-badge-corner ${cls}">${ico} ${pts} pts</span>`;
  }
  const centroVS = p.finalizado
    ? `<div class="result-score">${p.goles_local} – ${p.goles_visita}</div>`
    : `<div class="vs-label vs-pill">VS</div>`;
  const attemptDots = (abierto && yaApostado) ? `
    <div class="attempt-dots">
      <span class="adot ${intentos >= 1 ? 'used' : ''}"></span>
      <span class="adot ${intentos >= 2 ? 'used' : ''}"></span>
      <span style="font-size:.7rem;color:var(--text-sub);margin-left:.3rem">
        ${bloqueado ? '<i class="bi bi-lock-fill"></i> Sin intentos' : `${intentos}/2 usados`}
      </span>
    </div>` : "";
  let apuestaHTML;
  if (abierto && !bloqueado) {
    apuestaHTML = `<div class="bet-section">${attemptDots}
      <div class="bet-inputs">
        <input type="number" class="bet-input" min="0" max="10" value="${yaApostado ? p.goles_local_apostado : 0}" id="gl-${p.id}" />
        <span class="bet-separator">–</span>
        <input type="number" class="bet-input" min="0" max="10" value="${yaApostado ? p.goles_visita_apostado : 0}" id="gv-${p.id}" />
      </div>
      <button class="btn-fifa-green w-100 mt-2" id="btn-apostar-${p.id}">
        <i class="bi bi-${yaApostado ? 'pencil' : 'check-circle'} me-1"></i>${yaApostado ? "Actualizar apuesta" : "Apostar"}
      </button></div>`;
  } else if (abierto && bloqueado) {
    apuestaHTML = `<div class="bet-section">${attemptDots}
      <div class="bet-inputs">
        <input type="number" class="bet-input" value="${p.goles_local_apostado}" disabled />
        <span class="bet-separator">–</span>
        <input type="number" class="bet-input" value="${p.goles_visita_apostado}" disabled />
      </div>
      <p class="match-closed-msg mt-2" style="color:var(--red)"><i class="bi bi-lock-fill me-1"></i>Límite de 2 intentos alcanzado</p></div>`;
  } else if (yaApostado) {
    apuestaHTML = `<div class="bet-section">
      <div class="bet-inputs">
        <input type="number" class="bet-input" value="${p.goles_local_apostado}" disabled />
        <span class="bet-separator">–</span>
        <input type="number" class="bet-input" value="${p.goles_visita_apostado}" disabled />
      </div>
      <p class="match-closed-msg mt-1"><i class="bi bi-lock me-1"></i>Apuesta cerrada</p></div>`;
  } else {
    apuestaHTML = `<div class="bet-section"><p class="match-closed-msg m-0" style="padding:.3rem 0"><i class="bi bi-slash-circle me-1"></i>No apostaste en este partido</p></div>`;
  }
  const estadioHTML = p.imagen_estadio ? `
    <div class="match-stadium">
      <img src="${p.imagen_estadio}" alt="${escHtml(p.nombre_estadio || 'Estadio')}" loading="lazy" />
      <div class="match-stadium-overlay">
        <span class="match-phase-badge" style="margin:0">${escHtml(p.fase)}${p.grupo ? ` · ${escHtml(p.grupo)}` : ""}</span>
        ${p.nombre_estadio ? `<span class="match-stadium-name">${escHtml(p.nombre_estadio)}</span>` : ""}
      </div>
    </div>` :
    `<div class="match-group-chip"><i class="bi bi-grid-3x3-gap-fill" style="font-size:.65rem"></i> ${escHtml(p.fase)}${p.grupo ? ` · ${escHtml(p.grupo)}` : ""}</div>`;
  return `
    <div class="${clases}" data-pid="${p.id}">
      ${puntosCorner}
      ${estadioHTML}
      <div class="match-teams" style="${p.imagen_estadio ? 'margin-top:.5rem' : ''}">
        <div class="team-side"><span class="team-flag">${p.bandera_local}</span><span class="team-name">${escHtml(p.equipo_local)}</span></div>
        <div class="vs-center">${centroVS}</div>
        <div class="team-side"><span class="team-flag">${p.bandera_visita}</span><span class="team-name">${escHtml(p.equipo_visita)}</span></div>
      </div>
      <div class="match-date"><i class="bi bi-calendar3 me-1"></i>${formatFecha(p.fecha)}</div>
      ${apuestaHTML}
    </div>`;
}

function calcularPuntosLocal(p) {
  const gl = p.goles_local_apostado, gv = p.goles_visita_apostado;
  const rl = p.goles_local, rv = p.goles_visita;
  if (gl === rl && gv === rv) return 3;
  const ganReal = rl > rv ? "L" : rv > rl ? "V" : "E";
  const ganAp   = gl > gv ? "L" : gv > gl ? "V" : "E";
  return ganReal === ganAp ? 1 : 0;
}

function _actualizarPartidoLocal(idPartido, gl, gv) {
  const idx = partidos.findIndex(p => p.id === idPartido);
  if (idx > -1) {
    partidos[idx].goles_local_apostado  = gl;
    partidos[idx].goles_visita_apostado = gv;
    partidos[idx].intentos = (partidos[idx].intentos || 0) + 1;
  }
}

async function registrarApuesta(idPartido) {
  const gl = parseInt(document.getElementById(`gl-${idPartido}`).value);
  const gv = parseInt(document.getElementById(`gv-${idPartido}`).value);
  if (isNaN(gl) || isNaN(gv) || gl < 0 || gv < 0) { toast("Marcador inválido", "error"); return; }
  try {
    const res  = await fetch(`${API}/apostar`, { method: "POST", headers: headers(), body: JSON.stringify({ id_partido: idPartido, goles_local_apostado: gl, goles_visita_apostado: gv }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Error al apostar", "error"); return; }
    toast("✅ Apuesta guardada");
    _actualizarPartidoLocal(idPartido, gl, gv);
    renderPartidos();
    updateStatsBar();
    construirTabs();
  } catch (_) { toast("Error de conexión", "error"); }
}

async function registrarApuestaModal(idPartido) {
  const gl = parseInt(document.getElementById(`modal-gl-${idPartido}`)?.value);
  const gv = parseInt(document.getElementById(`modal-gv-${idPartido}`)?.value);
  if (isNaN(gl) || isNaN(gv) || gl < 0 || gv < 0) { toast("Marcador inválido", "error"); return; }
  const btn = document.getElementById(`modal-btn-apostar-${idPartido}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-wc"></span> Guardando...'; }
  try {
    const res  = await fetch(`${API}/apostar`, { method: "POST", headers: headers(), body: JSON.stringify({ id_partido: idPartido, goles_local_apostado: gl, goles_visita_apostado: gv }) });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Error al apostar", "error");
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Apostar'; }
      return;
    }
    toast("✅ Apuesta guardada");
    _actualizarPartidoLocal(idPartido, gl, gv);
    const pUpd = partidos.find(x => x.id === idPartido);
    if (pUpd) _setModalBetArea(pUpd);
    renderPartidos();
    updateStatsBar();
    construirTabs();
  } catch (_) {
    toast("Error de conexión", "error");
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Apostar'; }
  }
}

(function() {
  const btn = document.createElement("button");
  btn.className = "scroll-top-btn";
  btn.innerHTML = '<i class="bi bi-arrow-up"></i>';
  btn.title = "Volver arriba";
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(btn);
  window.addEventListener("scroll", () => btn.classList.toggle("visible", window.scrollY > 350), { passive: true });
})();

cargarPartidos();
cargarMiCampeon();
