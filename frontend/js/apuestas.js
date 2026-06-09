// EQUIPOS, STADIUM_DB, TEAM_DB defined in data.js

const selCampeon = document.getElementById("sel-campeon");
EQUIPOS.forEach(eq => {
  const opt = document.createElement("option");
  opt.value = eq; opt.textContent = eq;
  selCampeon.appendChild(opt);
});

function formatFecha(fechaStr) {
  return new Date(fechaStr).toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago"
  });
}

function estaAbierto(partido) {
  const deadline = new Date(partido.fecha).getTime() - BET_CLOSE_HOURS * 60 * 60 * 1000;
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

// ── Stadium image lazy-loader ──────────────────────────────────
const _imgCache = new Map(); // pid (string) → base64

const _imgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    _imgObserver.unobserve(entry.target);
    const pid  = entry.target.dataset.pid;
    const imgs = entry.target.querySelectorAll(".stadium-img-lazy");
    imgs.forEach(imgEl => _loadStadiumImg(pid, imgEl));
  });
}, { rootMargin: "400px 0px" });

async function _loadStadiumImg(pid, imgEl) {
  if (!imgEl) return;
  if (_imgCache.has(pid)) {
    imgEl.src = _imgCache.get(pid);
    imgEl.style.opacity = "1";
    return;
  }
  try {
    const res = await fetch(`${API}/partidos/${pid}/imagen`, { headers: headers() });
    if (!res.ok) return;
    const data = await res.json();
    if (data.imagen_estadio) {
      _imgCache.set(pid, data.imagen_estadio);
      imgEl.src = data.imagen_estadio;
      imgEl.style.opacity = "1";
    }
  } catch (_) {}
}

function _observeStadiumImages() {
  document.querySelectorAll(".stadium-lazy-wrap").forEach(el => _imgObserver.observe(el));
}

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
  const apostados   = partidos.filter(p => p.prediccion != null).length;
  const abiertos    = partidos.filter(p => estaAbierto(p));
  const pendientes  = abiertos.filter(p => p.prediccion == null).length;
  const finalizados = partidos.filter(p => p.finalizado && p.prediccion != null);
  const pts         = finalizados.reduce((acc, p) => acc + calcularPuntosLocal(p), 0);
  const pct         = total > 0 ? Math.round(apostados / total * 100) : 0;
  const barColor    = pct === 100 ? "var(--green)" : pct >= 50 ? "var(--gold)" : "#fb923c";
  const bar = document.getElementById("stats-bar");
  bar.innerHTML = `
    <div class="stats-bar-item"><span class="stats-bar-num" data-target="${apostados}">0</span><span class="stats-bar-label">apostados</span></div>
    <div class="stats-bar-divider"></div>
    <div class="stats-bar-item"><span class="stats-bar-num amber" data-target="${pendientes}">0</span><span class="stats-bar-label">pendientes</span></div>
    <div class="stats-bar-divider"></div>
    <div class="stats-bar-item"><span class="stats-bar-num gold" data-target="${pts}">0</span><span class="stats-bar-label">pts ganados</span></div>
    <div class="stats-bar-progress-wrap">
      <span class="stats-bar-progress-label">${apostados} / ${total} partidos · ${pct}%</span>
      <div class="stats-progress"><div class="stats-progress-bar" style="width:0%;background:${barColor};transition:width .8s ease"></div></div>
    </div>`;
  bar.querySelectorAll(".stats-bar-num[data-target]").forEach(el => animateCount(el, parseInt(el.dataset.target)));
  requestAnimationFrame(() => {
    const pb = bar.querySelector(".stats-progress-bar");
    if (pb) pb.style.width = `${pct}%`;
  });
}

async function cargarPartidos(forceFresh = false) {
  if (!forceFresh) {
    try {
      const raw = sessionStorage.getItem("polla_p_v1");
      if (raw) {
        const { d, t } = JSON.parse(raw);
        if (Date.now() - t < 30000) {
          partidos = d;
          construirTabs();
          renderPartidos();
          updateStatsBar();
          return;
        }
      }
    } catch (_) {}
  }
  mostrarSkeleton();
  try {
    const res = await fetch(`${API}/partidos`, { headers: headers() });
    partidos  = await res.json();
    try { sessionStorage.setItem("polla_p_v1", JSON.stringify({ d: partidos, t: Date.now() })); } catch (_) {}
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
  if (soloSinApostar) lista = lista.filter(p => estaAbierto(p) && p.prediccion == null);
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
  _staggerCards(grid);
  _observeStadiumImages();
}

function renderGruposAccordion(grid, lista) {
  const ahora    = new Date();
  const featured = lista
    .filter(p => !p.finalizado && new Date(p.fecha) > ahora)
    .slice(0, 3);

  const featuredIds = new Set(featured.map(p => p.id));
  const rest        = lista.filter(p => !featuredIds.has(p.id));

  const grupos = {};
  rest.forEach(p => {
    const g = p.grupo || "Sin grupo";
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(p);
  });

  const featuredHTML = featured.length ? `
    <div class="grupos-featured-label"><i class="bi bi-clock me-2" style="color:var(--gold)"></i>Próximos partidos...</div>
    <div class="grupos-featured-grid">
      ${featured.map(p => tarjetaPartido(p)).join("")}
    </div>
    <div class="grupos-section-label"><i class="bi bi-grid-3x3-gap-fill me-2"></i>Partidos por grupo</div>` : `
    <div class="grupos-section-label" style="margin-top:0"><i class="bi bi-grid-3x3-gap-fill me-2"></i>Partidos por grupo</div>`;

  const grupoKeys = Object.keys(grupos).sort((a, b) => a.localeCompare(b));

  const tabsRow = `
    <div class="grupo-tabs" id="grupo-tabs">
      ${grupoKeys.map((g, i) => {
        const pend = grupos[g].filter(p => estaAbierto(p) && p.prediccion == null).length;
        return `<button class="grupo-tab${i === 0 ? " active" : ""}" data-grupo="${escHtml(g)}">
          ${escHtml(g)}${pend > 0 ? `<span class="tab-badge">${pend}</span>` : ""}
        </button>`;
      }).join("")}
    </div>`;

  const panels = grupoKeys.map((g, i) => `
    <div class="grupo-panel${i === 0 ? "" : " grupo-panel-hidden"}" data-grupo="${escHtml(g)}">
      <div class="grupos-mini-grid">${grupos[g].map(p => tarjetaPartido(p)).join("")}</div>
    </div>`).join("");

  grid.innerHTML = `<div style="grid-column:1/-1;width:100%">${featuredHTML}${tabsRow}<div class="grupo-panels">${panels}</div></div>`;

  grid.querySelectorAll(".grupo-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      grid.querySelectorAll(".grupo-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      grid.querySelectorAll(".grupo-panel").forEach(p => p.classList.add("grupo-panel-hidden"));
      grid.querySelector(`.grupo-panel[data-grupo="${btn.dataset.grupo}"]`).classList.remove("grupo-panel-hidden");
      _staggerCards(grid);
      _observeStadiumImages();
    });
  });

  lista.forEach(p => {
    const btn = document.getElementById(`btn-apostar-${p.id}`);
    if (btn) btn.addEventListener("click", () => registrarApuesta(p.id));
  });
  _staggerCards(grid);
  _observeStadiumImages();
}

function _staggerCards(container) {
  container.querySelectorAll(".match-card").forEach((card, i) => {
    card.style.animationDelay = `${i * 0.045}s`;
    card.classList.add("card-enter");
  });
}


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

function _predLabel(pred, p) {
  if (pred === "L") return `${p.bandera_local} ${escHtml(p.equipo_local)} gana`;
  if (pred === "V") return `${p.bandera_visita} ${escHtml(p.equipo_visita)} gana`;
  return "🤝 Empate";
}

function _setModalBetArea(p) {
  const desbloqueado = estaDesbloqueado(p);
  const abierto    = estaAbierto(p);
  const yaApostado = p.prediccion != null;
  const intentos   = p.intentos || 0;
  const bloqueado  = yaApostado && intentos >= MAX_BET_ATTEMPTS;
  const betEl      = document.getElementById("modal-bet-area");

  if (!desbloqueado) {
    const dias = diasParaDesbloqueo(p);
    betEl.innerHTML = `
      <div class="modal-bet-inner" style="text-align:center;padding:1.25rem 0">
        <div class="bet-locked-msg" style="justify-content:center;font-size:.9rem;gap:.6rem">
          <i class="bi bi-lock-fill" style="font-size:1.1rem;color:rgba(255,255,255,.35)"></i>
          <span>Se desbloquea en <strong>${dias} día${dias !== 1 ? "s" : ""}</strong></span>
        </div>
      </div>`;
    return;
  }

  if (abierto && !bloqueado) {
    const attemptDots = yaApostado ? `
      <div class="attempt-dots" style="justify-content:center;margin-bottom:.6rem">
        <span class="adot ${intentos >= 1 ? "used" : ""}"></span>
        <span class="adot ${intentos >= MAX_BET_ATTEMPTS ? "used" : ""}"></span>
        <span style="font-size:.7rem;color:var(--text-sub);margin-left:.3rem">${intentos}/${MAX_BET_ATTEMPTS} usados</span>
      </div>` : "";
    betEl.innerHTML = `
      <div class="modal-bet-inner">
        <span class="modal-bet-label">
          <i class="bi bi-${yaApostado ? "pencil-fill" : "check-circle"}"></i>
          ${yaApostado ? "Actualizar apuesta" : "¿Quién gana?"}
        </span>
        ${attemptDots}
        <div class="pred-btns" id="modal-pred-${p.id}" style="margin:.75rem 0">
          <button class="pred-btn${p.prediccion === "L" ? " active" : ""}" data-pred="L">${p.bandera_local} ${escHtml(p.equipo_local)}</button>
          <button class="pred-btn${p.prediccion === "E" ? " active" : ""}" data-pred="E">🤝 Empate</button>
          <button class="pred-btn${p.prediccion === "V" ? " active" : ""}" data-pred="V">${p.bandera_visita} ${escHtml(p.equipo_visita)}</button>
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
        <div class="modal-bet-score">${_predLabel(p.prediccion, p)}</div>
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
      ? `<span class="pts-badge ${pts===1?"pts-1":"pts-0"}" style="font-size:.82rem">${pts===1?"✓":"✗"} ${pts} pt</span>`
      : "";
    betEl.innerHTML = `
      <div class="modal-bet-inner">
        <span class="modal-bet-label"><i class="bi bi-pencil-fill"></i>Tu apuesta</span>
        <div class="modal-bet-score">${_predLabel(p.prediccion, p)}</div>
        ${ptsBadge}
        <span class="modal-intentos"><i class="bi bi-arrow-repeat"></i>${intentos}/${MAX_BET_ATTEMPTS} intentos</span>
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
  const yaApostado = p.prediccion != null;
  const intentos   = p.intentos || 0;
  bootstrap.Tab.getOrCreateInstance(document.querySelector("#modalTabs .nav-link")).show();
  const _heroEl = document.getElementById("modal-hero");
  _heroEl.style.backgroundImage = "";
  if (p.tiene_imagen) {
    const _pid = String(p.id);
    if (_imgCache.has(_pid)) {
      _heroEl.style.backgroundImage = `url(${_imgCache.get(_pid)})`;
    } else {
      fetch(`${API}/partidos/${p.id}/imagen`, { headers: headers() })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.imagen_estadio) {
            _imgCache.set(_pid, d.imagen_estadio);
            _heroEl.style.backgroundImage = `url(${d.imagen_estadio})`;
          }
        }).catch(() => {});
    }
  }
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

const UNLOCK_DAYS = 7;

function diasParaDesbloqueo(p) {
  const ms = new Date(p.fecha) - new Date();
  return Math.ceil(ms / 86400000) - UNLOCK_DAYS;
}

function estaDesbloqueado(p) {
  if (p.finalizado) return true;
  return diasParaDesbloqueo(p) <= 0;
}

function tarjetaPartido(p) {
  const desbloqueado = estaDesbloqueado(p);
  const abierto    = estaAbierto(p);
  const yaApostado = p.prediccion != null;
  const intentos   = p.intentos || 0;
  const bloqueado  = yaApostado && intentos >= MAX_BET_ATTEMPTS;
  const clases     = ["match-card",
    p.finalizado ? "finalizado" : "",
    yaApostado   ? "apostado"   : "",
    !desbloqueado ? "card-locked" : ""
  ].filter(Boolean).join(" ");

  let puntosCorner = "";
  if (p.finalizado && yaApostado) {
    const pts = calcularPuntosLocal(p);
    const cls = pts === 1 ? "pts-1" : "pts-0";
    const ico = pts === 1 ? "✓" : "✗";
    puntosCorner = `<span class="pts-badge-corner ${cls}">${ico} ${pts} pt</span>`;
  }
  const centroVS = p.finalizado
    ? `<div class="result-score">${p.goles_local} – ${p.goles_visita}</div>`
    : `<div class="vs-label vs-pill">VS</div>`;
  const attemptDots = (abierto && yaApostado) ? `
    <div class="attempt-dots">
      <span class="adot ${intentos >= 1 ? 'used' : ''}"></span>
      <span class="adot ${intentos >= MAX_BET_ATTEMPTS ? 'used' : ''}"></span>
      <span style="font-size:.7rem;color:var(--text-sub);margin-left:.3rem">
        ${bloqueado ? '<i class="bi bi-lock-fill"></i> Sin intentos' : `${intentos}/${MAX_BET_ATTEMPTS} usados`}
      </span>
    </div>` : "";
  let apuestaHTML;
  if (!desbloqueado) {
    const dias = diasParaDesbloqueo(p);
    apuestaHTML = `<div class="bet-section bet-locked-section">
      <div class="bet-locked-msg">
        <i class="bi bi-lock-fill"></i>
        <span>Se desbloquea en <strong>${dias} día${dias !== 1 ? "s" : ""}</strong></span>
      </div>
    </div>`;
  } else if (abierto && !bloqueado) {
    apuestaHTML = `<div class="bet-section">${attemptDots}
      <div class="pred-btns" id="pred-${p.id}">
        <button class="pred-btn${p.prediccion === 'L' ? ' active' : ''}" data-pred="L">${p.bandera_local} ${escHtml(p.equipo_local)}</button>
        <button class="pred-btn${p.prediccion === 'E' ? ' active' : ''}" data-pred="E">🤝 Empate</button>
        <button class="pred-btn${p.prediccion === 'V' ? ' active' : ''}" data-pred="V">${p.bandera_visita} ${escHtml(p.equipo_visita)}</button>
      </div>
      <button class="btn-fifa-green w-100 mt-2" id="btn-apostar-${p.id}">
        <i class="bi bi-${yaApostado ? 'pencil' : 'check-circle'} me-1"></i>${yaApostado ? "Actualizar apuesta" : "Apostar"}
      </button></div>`;
  } else if (abierto && bloqueado) {
    apuestaHTML = `<div class="bet-section">${attemptDots}
      <div class="pred-tag pred-${p.prediccion}">${_predLabel(p.prediccion, p)}</div>
      <p class="match-closed-msg mt-2" style="color:var(--red)"><i class="bi bi-lock-fill me-1"></i>Límite de 2 intentos alcanzado</p></div>`;
  } else if (yaApostado) {
    apuestaHTML = `<div class="bet-section">
      <div class="pred-tag pred-${p.prediccion}">${_predLabel(p.prediccion, p)}</div>
      <p class="match-closed-msg mt-1"><i class="bi bi-lock me-1"></i>Apuesta cerrada</p></div>`;
  } else {
    apuestaHTML = `<div class="bet-section"><p class="match-closed-msg m-0" style="padding:.3rem 0"><i class="bi bi-slash-circle me-1"></i>No apostaste en este partido</p></div>`;
  }
  const estadioHTML = p.tiene_imagen ? `
    <div class="match-stadium stadium-lazy-wrap" data-pid="${p.id}">
      <img class="stadium-img-lazy" src="" alt="${escHtml(p.nombre_estadio || 'Estadio')}" style="opacity:0;transition:opacity .3s" />
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
      <div class="match-teams">
        <div class="team-side"><span class="team-flag">${p.bandera_local}</span><span class="team-name">${escHtml(p.equipo_local)}</span></div>
        <div class="vs-center">${centroVS}</div>
        <div class="team-side"><span class="team-flag">${p.bandera_visita}</span><span class="team-name">${escHtml(p.equipo_visita)}</span></div>
      </div>
      <div class="match-date"><i class="bi bi-calendar3 me-1"></i>${formatFecha(p.fecha)}</div>
      ${apuestaHTML}
    </div>`;
}

function calcularPuntosLocal(p) {
  if (!p.finalizado || p.prediccion == null) return 0;
  const ganReal = p.goles_local > p.goles_visita ? "L" : p.goles_visita > p.goles_local ? "V" : "E";
  return p.prediccion === ganReal ? 1 : 0;
}

function _actualizarPartidoLocal(idPartido, prediccion) {
  const idx = partidos.findIndex(p => p.id === idPartido);
  if (idx > -1) {
    partidos[idx].prediccion = prediccion;
    partidos[idx].intentos = (partidos[idx].intentos || 0) + 1;
  }
}

async function registrarApuesta(idPartido) {
  const pred = document.querySelector(`#pred-${idPartido} .pred-btn.active`)?.dataset.pred;
  if (!pred) { toast("Selecciona Local, Empate o Visita", "error"); return; }
  try {
    const res  = await fetch(`${API}/apostar`, { method: "POST", headers: headers(), body: JSON.stringify({ id_partido: idPartido, prediccion: pred }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Error al apostar", "error"); return; }
    toast("✅ Apuesta guardada");
    _actualizarPartidoLocal(idPartido, pred);
    try { sessionStorage.setItem("polla_p_v1", JSON.stringify({ d: partidos, t: Date.now() })); } catch (_) {}
    renderPartidos();
    updateStatsBar();
    construirTabs();
  } catch (_) { toast("Error de conexión", "error"); }
}

async function registrarApuestaModal(idPartido) {
  const pred = document.querySelector(`#modal-pred-${idPartido} .pred-btn.active`)?.dataset.pred;
  if (!pred) { toast("Selecciona Local, Empate o Visita", "error"); return; }
  const btn = document.getElementById(`modal-btn-apostar-${idPartido}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-wc"></span> Guardando...'; }
  try {
    const res  = await fetch(`${API}/apostar`, { method: "POST", headers: headers(), body: JSON.stringify({ id_partido: idPartido, prediccion: pred }) });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Error al apostar", "error");
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Apostar'; }
      return;
    }
    toast("✅ Apuesta guardada");
    _actualizarPartidoLocal(idPartido, pred);
    try { sessionStorage.setItem("polla_p_v1", JSON.stringify({ d: partidos, t: Date.now() })); } catch (_) {}
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

// Delegation handler for pred-btn selection (cards + modal)
document.addEventListener("click", e => {
  const btn = e.target.closest(".pred-btn");
  if (!btn) return;
  const wrap = btn.closest(".pred-btns");
  if (!wrap) return;
  wrap.querySelectorAll(".pred-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
});

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
