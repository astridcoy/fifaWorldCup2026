// EQUIPOS, STADIUM_DB, TEAM_DB defined in data.js

const selCampeon = document.getElementById("sel-campeon");
const selSegundo = document.getElementById("sel-segundo");
const selTercero = document.getElementById("sel-tercero");
[selCampeon, selSegundo, selTercero].forEach(sel => {
  EQUIPOS.forEach(eq => {
    const opt = document.createElement("option");
    opt.value = eq; opt.textContent = eq;
    sel.appendChild(opt);
  });
});

function formatFecha(fechaStr) {
  return new Date(fechaStr).toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago"
  });
}

function estaAbierto(partido) {
  const deadline = new Date(partido.fecha).getTime() - BET_CLOSE_MINUTES * 60 * 1000;
  return !partido.finalizado && Date.now() < deadline;
}

function estaEnVivo(partido) {
  return !partido.finalizado && Date.now() >= new Date(partido.fecha).getTime();
}

const MAX_PODIO_INTENTOS = 2;

function _actualizarPodioUI(controlsId, valor, intentos) {
  const el = document.getElementById(controlsId);
  if (!el) return;
  if (intentos >= MAX_PODIO_INTENTOS) {
    // Fully locked — replace content
    el.innerHTML = `
      <div class="bet-locked-msg" style="justify-content:flex-start">
        <i class="bi bi-lock-fill"></i>
        <span><strong>${escHtml(valor)}</strong> · <span style="color:var(--red)">2/2 intentos usados</span></span>
      </div>`;
    return;
  }
  if (intentos > 0 && valor) {
    // 1 attempt used — keep select+button visible, pre-fill, show dots + "Cambiar"
    const sel = el.querySelector("select");
    if (sel) sel.value = valor;
    const btn = el.querySelector("button");
    if (btn) btn.innerHTML = `<i class="bi bi-pencil me-1"></i> Cambiar`;
    // Insert attempt dots if not already there
    if (!el.querySelector(".attempt-dots")) {
      const dots = document.createElement("div");
      dots.className = "attempt-dots";
      dots.style.cssText = "width:100%;margin-bottom:.4rem";
      dots.innerHTML = `
        <span class="adot used"></span>
        <span class="adot"></span>
        <span style="font-size:.7rem;color:var(--text-sub);margin-left:.3rem">1/2 intentos · voto actual: <strong>${escHtml(valor)}</strong></span>`;
      el.insertBefore(dots, el.firstChild);
    }
  }
}

async function cargarMiCampeon() {
  try {
    const res  = await fetch(`${API}/mi-campeon`, { headers: headers() });
    const data = await res.json();
    _actualizarPodioUI("controls-campeon", data.campeon,       data.intentos_campeon || 0);
    _actualizarPodioUI("controls-segundo", data.segundo_lugar, data.intentos_segundo || 0);
    _actualizarPodioUI("controls-tercero", data.tercer_lugar,  data.intentos_tercero || 0);
  } catch (_) {}
}

function _setupBtnPodio(btnId, sel, controlsId, endpoint, bodyKey, etiqueta) {
  document.getElementById(btnId).addEventListener("click", async () => {
    const valor = sel.value;
    if (!valor) { toast("Selecciona un equipo primero", "error"); return; }
    try {
      const res  = await fetch(`${API}${endpoint}`, { method: "POST", headers: headers(), body: JSON.stringify({ [bodyKey]: valor }) });
      const data = await res.json();
      if (!res.ok) { toast(data.error || `Error al apostar ${etiqueta}`, "error"); return; }
      toast(`✅ ${etiqueta.charAt(0).toUpperCase()}${etiqueta.slice(1)} apostado: ${valor}`);
      _actualizarPodioUI(controlsId, valor, data.intentos);
    } catch (_) { toast("Error de conexión", "error"); }
  });
}

_setupBtnPodio("btn-campeon", selCampeon, "controls-campeon", "/campeon",       "campeon", "campeón");
_setupBtnPodio("btn-segundo", selSegundo, "controls-segundo", "/segundo-lugar", "equipo",  "2do lugar");
_setupBtnPodio("btn-tercero", selTercero, "controls-tercero", "/tercer-lugar",  "equipo",  "3er lugar");

const _inputBuscador = document.getElementById("buscador-equipo");
const _btnClearBuscador = document.getElementById("btn-clear-buscador");
_inputBuscador.addEventListener("input", () => {
  busquedaEquipo = _inputBuscador.value.trim().toLowerCase();
  _btnClearBuscador.style.display = busquedaEquipo ? "" : "none";
  renderPartidos();
});
_btnClearBuscador.addEventListener("click", () => {
  _inputBuscador.value = "";
  busquedaEquipo = "";
  _btnClearBuscador.style.display = "none";
  _inputBuscador.focus();
  renderPartidos();
});

let partidos        = [];
let faseActiva      = "";
let soloSinApostar  = false;
let soloFinalizados = false;
let soloHoy         = false;
let busquedaEquipo  = "";
let fasesActuales   = [];

const FILTRO_KEY    = "polla_filtro_v1";
const FASES_EXACTO  = new Set(["Cuartos", "Semifinal", "Final", "Tercer puesto"]);
try {
  const f = JSON.parse(localStorage.getItem(FILTRO_KEY));
  if (f) {
    faseActiva      = f.faseActiva      || "";
    soloSinApostar  = !!f.soloSinApostar;
    soloFinalizados = !!f.soloFinalizados;
    soloHoy         = !!f.soloHoy;
  }
} catch (_) {}

function _guardarFiltro() {
  try {
    localStorage.setItem(FILTRO_KEY, JSON.stringify({ faseActiva, soloSinApostar, soloFinalizados, soloHoy }));
  } catch (_) {}
}

function _esHoy(fechaStr) {
  const opts = { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" };
  return new Date(fechaStr).toLocaleDateString("en-CA", opts) === new Date().toLocaleDateString("en-CA", opts);
}

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
  const partido = partidos.find(p => p.id === parseInt(pid));

  // DB image takes priority: admin may have uploaded a custom photo
  if (partido?.tiene_imagen) {
    if (_imgCache.has(pid)) {
      imgEl.src = _imgCache.get(pid);
      imgEl.style.opacity = "1";
      return;
    }
    try {
      const res = await fetch(`${API}/partidos/${pid}/imagen`, { headers: headers() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.imagen_estadio) {
        _imgCache.set(pid, data.imagen_estadio);
        imgEl.src = data.imagen_estadio;
        imgEl.style.opacity = "1";
        return;
      }
    } catch (_) {}
  }

  // Fall back to static CDN image
  const stInfo = partido ? getStadiumInfo(partido.nombre_estadio) : null;
  if (stInfo?.img) {
    imgEl.src = stInfo.img;
    imgEl.style.opacity = "1";
  }
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

async function cargarPartidos(forceFresh = false, silencioso = false) {
  if (!forceFresh) {
    try {
      const raw = sessionStorage.getItem(`polla_p_v1_${YO_ID}`);
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
  if (!silencioso) mostrarSkeleton();
  try {
    const res  = await fetch(`${API}/partidos`, { headers: headers() });
    const data = await res.json();
    const cambiaron = JSON.stringify(data) !== JSON.stringify(partidos);
    partidos = data;
    try { sessionStorage.setItem(`polla_p_v1_${YO_ID}`, JSON.stringify({ d: partidos, t: Date.now() })); } catch (_) {}
    // En modo silencioso evitamos re-renderizar (y reiniciar animaciones) si no cambió nada.
    if (!silencioso || cambiaron) {
      construirTabs();
      renderPartidos();
      updateStatsBar();
    }
  } catch (_) {
    if (silencioso) return;
    document.getElementById("partidos-grid").innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>No se pudo cargar los partidos</h3>
        <p>Verifica que el servidor esté activo</p>
        <button class="btn-fifa-outline mt-2" id="btn-retry-partidos"><i class="bi bi-arrow-clockwise me-1"></i>Reintentar</button>
      </div>`;
    document.getElementById("btn-retry-partidos")?.addEventListener("click", () => cargarPartidos(true));
  }
}

// ── Auto-refresh sin recargar la página ─────────────────────────
const AUTO_REFRESH_MS = 25000;

function _puedeAutoRefrescar() {
  return document.visibilityState === "visible" && !document.body.classList.contains("modal-open");
}

setInterval(() => {
  if (_puedeAutoRefrescar()) cargarPartidos(true, true);
}, AUTO_REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (_puedeAutoRefrescar()) cargarPartidos(true, true);
});

function construirTabs() {
  const fases = [...new Set(partidos.map(p => p.fase))];
  if (!fases.includes(faseActiva)) faseActiva = fases[0] || "";
  fasesActuales = fases;
  const cont  = document.getElementById("tabs-fases");
  cont.innerHTML = "";
  fases.forEach(fase => {
    const pend = partidos.filter(p =>
      p.fase === fase && estaAbierto(p) && p.prediccion == null
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
      _actualizarBadgesFiltros();
      _guardarFiltro();
      renderPartidos();
    });
    cont.appendChild(btn);
  });
  const filterBtn = document.createElement("button");
  filterBtn.className = "phase-tab filter-tab ms-auto";
  filterBtn.addEventListener("click", () => {
    soloSinApostar = !soloSinApostar;
    if (soloSinApostar) { soloHoy = false; soloFinalizados = false; }
    _actualizarBadgesFiltros();
    _guardarFiltro();
    renderPartidos();
  });
  cont.appendChild(filterBtn);

  const hoyBtn = document.createElement("button");
  hoyBtn.className = "phase-tab filter-tab";
  hoyBtn.addEventListener("click", () => {
    soloHoy = !soloHoy;
    if (soloHoy) { soloSinApostar = false; soloFinalizados = false; }
    _actualizarBadgesFiltros();
    _guardarFiltro();
    renderPartidos();
  });
  cont.appendChild(hoyBtn);

  const finalizadosBtn = document.createElement("button");
  finalizadosBtn.className = "phase-tab filter-tab";
  finalizadosBtn.addEventListener("click", () => {
    soloFinalizados = !soloFinalizados;
    if (soloFinalizados) { soloSinApostar = false; soloHoy = false; }
    _actualizarBadgesFiltros();
    _guardarFiltro();
    renderPartidos();
  });
  cont.appendChild(finalizadosBtn);

  function _actualizarBadgesFiltros() {
    filterBtn.classList.toggle("active", soloSinApostar);
    filterBtn.innerHTML = `<i class="bi bi-funnel${soloSinApostar ? "-fill" : ""} me-1"></i>Sin apostar`;

    const countHoy = partidos.filter(p => p.fase === faseActiva && _esHoy(p.fecha)).length;
    hoyBtn.classList.toggle("active", soloHoy);
    hoyBtn.innerHTML = `<i class="bi bi-calendar-week${soloHoy ? "-fill" : ""} me-1"></i>Partidos de Hoy${countHoy > 0 ? ` <span class="tab-badge">${countHoy}</span>` : ""}`;

    const countFin = partidos.filter(p => p.fase === faseActiva && p.finalizado).length;
    finalizadosBtn.classList.toggle("active", soloFinalizados);
    finalizadosBtn.innerHTML = `<i class="bi bi-flag${soloFinalizados ? "-fill" : ""} me-1"></i>Finalizados${countFin > 0 ? ` <span class="tab-badge">${countFin}</span>` : ""}`;
  }
  _actualizarBadgesFiltros();
}

function renderPartidos() {
  const grid = document.getElementById("partidos-grid");

  if (busquedaEquipo) {
    const lista = partidos
      .filter(p => p.equipo_local.toLowerCase().includes(busquedaEquipo) || p.equipo_visita.toLowerCase().includes(busquedaEquipo))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (!lista.length) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span><h3>Sin resultados</h3><p>No encontramos partidos de "${escHtml(_inputBuscador.value.trim())}"</p></div>`;
      return;
    }
    grid.innerHTML = lista.map(p => tarjetaPartido(p)).join("");
    lista.forEach(p => {
      const btn = document.getElementById(`btn-apostar-${p.id}`);
      if (btn) btn.addEventListener("click", () => registrarApuesta(p.id));
    });
    _staggerCards(grid);
    _observeStadiumImages();
    return;
  }

  let lista  = partidos.filter(p => p.fase === faseActiva).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  if (soloSinApostar)  lista = lista.filter(p => estaAbierto(p) && p.prediccion == null);
  if (soloHoy)          lista = lista.filter(p => _esHoy(p.fecha));
  if (soloFinalizados) lista = lista.filter(p => p.finalizado);
  if (!lista.length) {
    grid.innerHTML = soloSinApostar
      ? `<div class="empty-state"><span class="empty-icon">✅</span><h3>¡Todo apostado en esta fase!</h3><p>Ya registraste apuesta en todos los partidos abiertos.</p></div>`
      : soloHoy
      ? `<div class="empty-state"><span class="empty-icon">📅</span><h3>No hay partidos hoy en esta fase</h3><p>Revisa otra fase o vuelve a mirar otro día.</p></div>`
      : soloFinalizados
      ? `<div class="empty-state"><span class="empty-icon">🏁</span><h3>Sin partidos finalizados</h3><p>Todavía no termina ningún partido en esta fase.</p></div>`
      : `<div class="empty-state"><span class="empty-icon">📭</span><h3>No hay partidos en esta fase</h3></div>`;
    return;
  }
  if (faseActiva === "Grupos" && !soloSinApostar && !soloHoy && !soloFinalizados) {
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

// ── Swipe horizontal entre fases (mobile) ───────────────────────
(function _initSwipeFases() {
  const grid = document.getElementById("partidos-grid");
  let startX = 0, startY = 0, _started = false, _scrolling = false;
  grid.addEventListener("touchstart", (e) => {
    // Don't hijack touches on interactive elements
    if (e.target.closest("button, input, select, label, textarea, a")) return;
    startX = e.changedTouches[0].screenX;
    startY = e.changedTouches[0].screenY;
    _started = true;
    _scrolling = false;
  }, { passive: true });
  grid.addEventListener("touchmove", (e) => {
    if (!_started) return;
    // If vertical movement dominates at any point, mark as scroll
    if (Math.abs(e.changedTouches[0].screenY - startY) > Math.abs(e.changedTouches[0].screenX - startX)) {
      _scrolling = true;
    }
  }, { passive: true });
  grid.addEventListener("touchend", (e) => {
    if (!_started || _scrolling || busquedaEquipo) { _started = false; return; }
    _started = false;
    const dx = e.changedTouches[0].screenX - startX;
    const dy = e.changedTouches[0].screenY - startY;
    // Require 90px min and clearly horizontal (2.5× more horizontal than vertical)
    if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 2.5) return;
    const idx = fasesActuales.indexOf(faseActiva);
    if (idx === -1) return;
    const nextIdx = dx < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= fasesActuales.length) return;
    faseActiva = fasesActuales[nextIdx];
    _guardarFiltro();
    construirTabs();
    renderPartidos();
  }, { passive: true });
})();

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
  if (FASES_EXACTO.has(p.fase) && p.goles_local_apostado != null) {
    let txt = `${p.goles_local_apostado} – ${p.goles_visita_apostado}`;
    if (p.predice_penales && p.equipo_penales_pred)
      txt += ` <span style="font-size:.78rem;color:var(--text-sub)">(pens: ${escHtml(p.equipo_penales_pred)})</span>`;
    return txt;
  }
  if (pred === "L") return `${p.bandera_local} ${escHtml(p.equipo_local)} gana`;
  if (pred === "V") return `${p.bandera_visita} ${escHtml(p.equipo_visita)} gana`;
  return "🤝 Empate";
}

function _scoringLegend(fase) {
  if (FASES_EXACTO.has(fase)) {
    return `<div class="scoring-legend mt-2">
      <i class="bi bi-info-circle me-1"></i>
      <span>Ganador correcto = <b>2 pts</b> · Marcador exacto = <b>6 pts</b> · Penales acertados = <b>+2 pts</b> · Máx <b>8 pts</b></span>
    </div>`;
  }
  return `<div class="scoring-legend mt-2">
    <i class="bi bi-info-circle me-1"></i>
    <span>Resultado correcto = <b>3 pts</b></span>
  </div>`;
}

function _puntosDesglose(p) {
  if (!p.finalizado || p.prediccion == null) return "";
  if (FASES_EXACTO.has(p.fase) && p.goles_local_apostado != null) {
    const gl = p.goles_local, gv = p.goles_visita;
    const gl_ap = p.goles_local_apostado, gv_ap = p.goles_visita_apostado;
    // Real winner
    let realWinner;
    if (gl > gv) realWinner = p.equipo_local;
    else if (gv > gl) realWinner = p.equipo_visita;
    else realWinner = p.equipo_ganador_penales || null;
    // Predicted winner
    let predWinner;
    if (gl_ap > gv_ap) predWinner = p.equipo_local;
    else if (gv_ap > gl_ap) predWinner = p.equipo_visita;
    else predWinner = p.equipo_penales_pred || null;

    const acertoGanador = realWinner && predWinner && realWinner === predWinner;
    const acertoExacto  = acertoGanador && gl_ap === gl && gv_ap === gv;
    const acertoPenales = p.fue_penales && p.predice_penales && p.equipo_penales_pred === p.equipo_ganador_penales;
    let rows = [];
    if (acertoExacto) {
      rows.push(`<div class="pts-row pts-ok">✓ Marcador exacto · <b>+6 pts</b></div>`);
    } else if (acertoGanador) {
      rows.push(`<div class="pts-row pts-ok">✓ Ganador correcto · <b>+2 pts</b></div>`);
      rows.push(`<div class="pts-row pts-ko">✗ Marcador incorrecto</div>`);
    } else {
      rows.push(`<div class="pts-row pts-ko">✗ Ganador incorrecto · 0 pts</div>`);
    }
    if (p.predice_penales) {
      rows.push(acertoPenales
        ? `<div class="pts-row pts-ok">✓ Penales acertados · <b>+2 pts</b></div>`
        : `<div class="pts-row pts-ko">✗ Penales no acertados</div>`);
    } else if (p.fue_penales) {
      rows.push(`<div class="pts-row pts-ko">✗ No predijiste penales</div>`);
    }
    return `<div class="pts-desglose">${rows.join("")}</div>`;
  }
  const pts = calcularPuntosLocal(p);
  return pts > 0
    ? `<div class="pts-desglose"><div class="pts-row pts-ok">✓ Resultado correcto · <b>+3 pts</b></div></div>`
    : `<div class="pts-desglose"><div class="pts-row pts-ko">✗ Resultado incorrecto · 0 pts</div></div>`;
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
      <div class="attempt-dots" style="justify-content:center;margin-bottom:.6rem;width:100%">
        <span class="adot ${intentos >= 1 ? "used" : ""}"></span>
        <span class="adot ${intentos >= MAX_BET_ATTEMPTS ? "used" : ""}"></span>
        <span style="font-size:.7rem;color:var(--text-sub);margin-left:.3rem">${intentos}/${MAX_BET_ATTEMPTS} usados</span>
      </div>` : "";

    if (FASES_EXACTO.has(p.fase)) {
      const glv = p.goles_local_apostado  ?? "";
      const gvv = p.goles_visita_apostado ?? "";
      const penEq  = p.equipo_penales_pred || "";
      const isDraw = glv !== "" && gvv !== "" && Number(glv) === Number(gvv);
      betEl.innerHTML = `
        <div class="modal-bet-inner">
          <span class="modal-bet-label" style="width:100%">
            <i class="bi bi-${yaApostado ? "pencil-fill" : "pencil-square"}"></i>
            ${yaApostado ? "Actualizar apuesta" : "Marcador exacto (90 min / alargue)"}
          </span>
          ${attemptDots}
          <div class="exacto-score-row" id="modal-exacto-${p.id}" style="width:100%;margin:.75rem 0">
            <span class="team-flag-sm">${p.bandera_local}</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="exacto-input" id="mgl-${p.id}" value="${glv}" placeholder="0">
            <span class="exacto-sep">–</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="exacto-input" id="mgv-${p.id}" value="${gvv}" placeholder="0">
            <span class="team-flag-sm">${p.bandera_visita}</span>
          </div>
          <div id="mpen-section-${p.id}" class="pen-draw-section" style="width:100%;display:${isDraw ? '' : 'none'}">
            <p class="pen-draw-label"><i class="bi bi-p-circle-fill me-1"></i>Empate: ¿quién avanza en penales?</p>
            <div class="pen-who-row" style="width:100%">
              <select class="form-select form-select-sm" id="mpen-eq-${p.id}">
                <option value="">¿Quién avanza?</option>
                <option value="${escHtml(p.equipo_local)}"  ${penEq===p.equipo_local  ?"selected":""}>${p.bandera_local} ${escHtml(p.equipo_local)}</option>
                <option value="${escHtml(p.equipo_visita)}" ${penEq===p.equipo_visita ?"selected":""}>${p.bandera_visita} ${escHtml(p.equipo_visita)}</option>
              </select>
            </div>
          </div>
          <button class="btn-fifa-green w-100 mt-2" id="modal-btn-apostar-${p.id}">
            <i class="bi bi-${yaApostado ? "pencil" : "check-circle"} me-1"></i>
            ${yaApostado ? "Actualizar apuesta" : "Apostar"}
          </button>
          ${_scoringLegend(p.fase)}
        </div>`;
    } else {
      const sinEmpate = p.fase !== "Grupos";
      betEl.innerHTML = `
        <div class="modal-bet-inner">
          <span class="modal-bet-label" style="width:100%">
            <i class="bi bi-${yaApostado ? "pencil-fill" : "check-circle"}"></i>
            ${yaApostado ? "Actualizar apuesta" : "¿Quién gana?"}
          </span>
          ${attemptDots}
          <div class="pred-btns" id="modal-pred-${p.id}" style="margin:.75rem 0;width:100%">
            <button class="pred-btn${p.prediccion === "L" ? " active" : ""}" data-pred="L">${p.bandera_local} ${escHtml(p.equipo_local)}</button>
            ${sinEmpate ? "" : `<button class="pred-btn${p.prediccion === "E" ? " active" : ""}" data-pred="E">🤝 Empate</button>`}
            <button class="pred-btn${p.prediccion === "V" ? " active" : ""}" data-pred="V">${p.bandera_visita} ${escHtml(p.equipo_visita)}</button>
          </div>
          ${sinEmpate ? `<p class="match-closed-msg" style="padding:0 0 .5rem;width:100%"><i class="bi bi-info-circle me-1"></i>Eliminación directa: no hay empate, siempre hay un ganador</p>` : ""}
          <button class="btn-fifa-green w-100" id="modal-btn-apostar-${p.id}">
            <i class="bi bi-${yaApostado ? "pencil" : "check-circle"} me-1"></i>
            ${yaApostado ? "Actualizar apuesta" : "Apostar"}
          </button>
          ${_scoringLegend(p.fase)}
        </div>`;
    }
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
      ? `<span class="pts-badge ${pts>0?"pts-1":"pts-0"}" style="font-size:.82rem">${pts>0?"✓":"✗"} ${pts} pts</span>`
      : "";
    betEl.innerHTML = `
      <div class="modal-bet-inner">
        <span class="modal-bet-label"><i class="bi bi-pencil-fill"></i>Tu apuesta</span>
        <div class="modal-bet-score">${_predLabel(p.prediccion, p)}</div>
        ${ptsBadge}
        ${p.finalizado ? _puntosDesglose(p) : ""}
        <span class="modal-intentos"><i class="bi bi-arrow-repeat"></i>${intentos}/${MAX_BET_ATTEMPTS} intentos</span>
      </div>`;
  } else {
    betEl.innerHTML = `
      <div class="modal-no-bet" style="opacity:.6">
        <i class="bi bi-slash-circle"></i>No apostaste en este partido
      </div>`;
  }
}

// Color consistente por usuario (mismo nombre → mismo color entre recargas)
const _AVATAR_COLORS = ["#E8194C", "#1A54C5", "#00BFB3", "#F1677F", "#FEBC12", "#8B5CF6", "#FB923C", "#10B981"];
function _avatarColor(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  return _AVATAR_COLORS[hash % _AVATAR_COLORS.length];
}
function _iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/);
  const ini = partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2);
  return ini.toUpperCase();
}

async function _loadVotosTab(p) {
  const cont = document.getElementById("modal-votos-content");
  if (estaAbierto(p)) {
    cont.innerHTML = `
      <div class="modal-no-bet" style="opacity:.6;text-align:center;padding:1.5rem 0">
        <i class="bi bi-eye-slash"></i>
        <p style="margin-top:.5rem">Los votos de todos se revelan cuando cierren las apuestas para este partido.</p>
      </div>`;
    return;
  }
  cont.innerHTML = '<div style="padding:1.5rem;text-align:center"><span class="spinner-wc" style="width:1.8rem;height:1.8rem;border-width:3px"></span></div>';
  try {
    const res  = await fetch(`${API}/partidos/${p.id}/votos`, { headers: headers() });
    const data = await res.json();
    if (!res.ok) {
      cont.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-sub)">${escHtml(data.error || "Error al cargar votos")}</div>`;
      return;
    }
    if (!data.length) {
      cont.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-sub)">Nadie apostó en este partido.</div>';
      return;
    }
    const predLabels = { L: `${p.bandera_local} ${escHtml(p.equipo_local)}`, E: "🤝 Empate", V: `${p.bandera_visita} ${escHtml(p.equipo_visita)}` };

    // Orden: con resultado, mayor puntaje primero (empate alfabético); sin resultado, alfabético
    const lista = [...data].sort((a, b) =>
      p.finalizado
        ? (b.puntos - a.puntos) || a.nombre.localeCompare(b.nombre, "es")
        : a.nombre.localeCompare(b.nombre, "es")
    );

    const filas = lista.map((v) => {
      const acerto = p.finalizado && v.puntos > 0;
      const fallo  = p.finalizado && v.puntos === 0;
      const claseFila = ["voto-row", acerto ? "voto-acerto" : "", fallo ? "voto-fallo" : ""].filter(Boolean).join(" ");
      const avatarHtml = v.foto_perfil
        ? `<img class="voto-avatar" src="${v.foto_perfil}" alt="${escHtml(v.nombre)}" />`
        : `<span class="voto-avatar-default" style="background:${_avatarColor(v.nombre)}">${escHtml(_iniciales(v.nombre))}</span>`;
      const ptsHtml = p.finalizado
        ? `<span class="voto-pts ${v.puntos > 0 ? "voto-pts-ok" : "voto-pts-no"}">${v.puntos} pts</span>`
        : "";
      return `
        <div class="${claseFila}">
          ${avatarHtml}
          <span class="voto-nombre">${escHtml(v.nombre)}</span>
          <span class="voto-pred-badge pred-${v.prediccion}">${predLabels[v.prediccion] ?? v.prediccion}</span>
          ${ptsHtml}
        </div>`;
    }).join("");
    cont.innerHTML = `<div class="votos-list">${filas}</div>`;
  } catch (_) {
    cont.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-sub)">Error de conexión</div>';
  }
}

function showModalPartido(p) {
  const abierto    = estaAbierto(p);
  const yaApostado = p.prediccion != null;
  const intentos   = p.intentos || 0;
  bootstrap.Tab.getOrCreateInstance(document.querySelector("#modalTabs .nav-link")).show();
  const _heroEl = document.getElementById("modal-hero");
  _heroEl.style.backgroundImage = "";
  const _stInfo = getStadiumInfo(p.nombre_estadio);
  const _pid    = String(p.id);
  if (p.tiene_imagen) {
    // DB image takes priority; use static as instant placeholder while fetching
    if (_stInfo?.img) _heroEl.style.backgroundImage = `url(${_stInfo.img})`;
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
  } else if (_stInfo?.img) {
    _heroEl.style.backgroundImage = `url(${_stInfo.img})`;
  }
  document.getElementById("modal-phase-chip").textContent = `${p.fase}${p.grupo ? " · Grupo " + p.grupo : ""}`;
  document.getElementById("modal-venue").textContent      = p.nombre_estadio || "";
  document.getElementById("modal-flag-l").textContent = p.bandera_local;
  document.getElementById("modal-name-l").textContent = p.equipo_local;
  document.getElementById("modal-flag-v").textContent = p.bandera_visita;
  document.getElementById("modal-name-v").textContent = p.equipo_visita;
  document.getElementById("modal-center-score").innerHTML = p.finalizado
    ? `<div class="modal-final-score">${p.goles_local}<span style="color:var(--text-sub);margin:0 .2rem">–</span>${p.goles_visita}</div>
       <div class="modal-final-label">Resultado final</div>
       ${p.fue_penales && p.equipo_ganador_penales ? `<div class="modal-penales-label"><i class="bi bi-p-circle-fill me-1"></i>${escHtml(p.equipo_ganador_penales)} avanzó en penales</div>` : ""}`
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
  _loadVotosTab(p);
  const st = getStadiumInfo(p.nombre_estadio);
  const mapsUrl = st?.maps || `https://maps.google.com/?q=${encodeURIComponent(p.nombre_estadio || "FIFA 2026 Stadium")}`;
  document.getElementById("modal-estadio-content").innerHTML = `
    <div class="modal-estadio-stats">
      <div class="modal-stat-tile modal-stat-tile-venue"><i class="bi bi-building"></i><span class="modal-stat-label">Estadio</span><span class="modal-stat-value">${escHtml(p.nombre_estadio) || "—"}</span></div>
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
    !desbloqueado ? "card-locked" : "",
    estaEnVivo(p) ? "en-vivo" : ""
  ].filter(Boolean).join(" ");

  let puntosCorner = "";
  if (p.finalizado && yaApostado) {
    const pts = calcularPuntosLocal(p);
    const cls = pts > 0 ? "pts-1" : "pts-0";
    const ico = pts > 0 ? "✓" : "✗";
    puntosCorner = `<span class="pts-badge-corner ${cls}">${ico} ${pts} pts</span>`;
  } else if (estaEnVivo(p)) {
    puntosCorner = `<span class="live-badge-corner"><i class="bi bi-circle-fill"></i> EN VIVO</span>`;
  }
  const penalesTag = p.fue_penales && p.equipo_ganador_penales
    ? `<div class="pens-winner-label"><i class="bi bi-p-circle-fill me-1"></i>${escHtml(p.equipo_ganador_penales)} avanzó</div>` : "";
  const centroVS = p.finalizado
    ? `<div class="result-score">${p.goles_local} – ${p.goles_visita}</div>${penalesTag}`
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
    if (FASES_EXACTO.has(p.fase)) {
      const glv = p.goles_local_apostado  ?? "";
      const gvv = p.goles_visita_apostado ?? "";
      const penEq  = p.equipo_penales_pred || "";
      const isDraw = glv !== "" && gvv !== "" && Number(glv) === Number(gvv);
      apuestaHTML = `<div class="bet-section">${attemptDots}
        <p class="match-closed-msg mt-0 mb-1" style="padding:0"><i class="bi bi-pencil-square me-1"></i>Marcador al 90 min (o alargue)</p>
        <div class="exacto-score-row" id="exacto-${p.id}">
          <span class="team-flag-sm">${p.bandera_local}</span>
          <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="exacto-input" id="gl-${p.id}" value="${glv}" placeholder="0">
          <span class="exacto-sep">–</span>
          <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="exacto-input" id="gv-${p.id}" value="${gvv}" placeholder="0">
          <span class="team-flag-sm">${p.bandera_visita}</span>
        </div>
        <div id="pen-section-${p.id}" class="pen-draw-section" style="display:${isDraw ? '' : 'none'}">
          <p class="pen-draw-label"><i class="bi bi-p-circle-fill me-1"></i>Empate: ¿quién avanza en penales?</p>
          <div class="pen-who-row">
            <select class="form-select form-select-sm" id="pen-eq-${p.id}">
              <option value="">¿Quién avanza?</option>
              <option value="${escHtml(p.equipo_local)}"  ${penEq===p.equipo_local  ?"selected":""}>${p.bandera_local} ${escHtml(p.equipo_local)}</option>
              <option value="${escHtml(p.equipo_visita)}" ${penEq===p.equipo_visita ?"selected":""}>${p.bandera_visita} ${escHtml(p.equipo_visita)}</option>
            </select>
          </div>
        </div>
        <button class="btn-fifa-green w-100 mt-2" id="btn-apostar-${p.id}">
          <i class="bi bi-${yaApostado ? 'pencil' : 'check-circle'} me-1"></i>${yaApostado ? "Actualizar apuesta" : "Apostar"}
        </button>
        ${_scoringLegend(p.fase)}</div>`;
    } else {
      const sinEmpate = p.fase !== "Grupos";
      apuestaHTML = `<div class="bet-section">${attemptDots}
        <div class="pred-btns" id="pred-${p.id}">
          <button class="pred-btn${p.prediccion === 'L' ? ' active' : ''}" data-pred="L">${p.bandera_local} ${escHtml(p.equipo_local)}</button>
          ${sinEmpate ? "" : `<button class="pred-btn${p.prediccion === 'E' ? ' active' : ''}" data-pred="E">🤝 Empate</button>`}
          <button class="pred-btn${p.prediccion === 'V' ? ' active' : ''}" data-pred="V">${p.bandera_visita} ${escHtml(p.equipo_visita)}</button>
        </div>
        ${sinEmpate ? `<p class="match-closed-msg mt-1" style="padding:0"><i class="bi bi-info-circle me-1"></i>Eliminación directa: no hay empate, siempre hay un ganador</p>` : ""}
        <button class="btn-fifa-green w-100 mt-2" id="btn-apostar-${p.id}">
          <i class="bi bi-${yaApostado ? 'pencil' : 'check-circle'} me-1"></i>${yaApostado ? "Actualizar apuesta" : "Apostar"}
        </button>
        ${_scoringLegend(p.fase)}</div>`;
    }
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
  const _hasImg = p.tiene_imagen || !!getStadiumInfo(p.nombre_estadio)?.img;
  const estadioHTML = _hasImg ? `
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
  // Usa el puntaje almacenado en DB (correcto incluso para partidos decididos por penales)
  if (p.puntos != null) return p.puntos;
  const ganReal = p.goles_local > p.goles_visita ? "L" : p.goles_visita > p.goles_local ? "V" : "E";
  return p.prediccion === ganReal ? MATCH_POINTS : 0;
}

function _actualizarPartidoLocal(idPartido, prediccion, extra = {}) {
  const idx = partidos.findIndex(p => p.id === idPartido);
  if (idx > -1) {
    partidos[idx] = { ...partidos[idx], prediccion, intentos: (partidos[idx].intentos || 0) + 1, ...extra };
  }
}

async function registrarApuesta(idPartido) {
  const p = partidos.find(x => x.id === idPartido);
  let body, extra;
  if (p && FASES_EXACTO.has(p.fase)) {
    const gl = parseInt(document.getElementById(`gl-${idPartido}`)?.value ?? "");
    const gv = parseInt(document.getElementById(`gv-${idPartido}`)?.value ?? "");
    if (isNaN(gl) || isNaN(gv)) { toast("Ingresa el marcador exacto", "error"); return; }
    const predPen = gl === gv;
    const eqPen   = document.getElementById(`pen-eq-${idPartido}`)?.value || "";
    if (gl === gv && !eqPen) { toast("Marcador empatado: selecciona quién gana en penales", "error"); return; }
    body  = { id_partido: idPartido, goles_local: gl, goles_visita: gv, predice_penales: predPen, equipo_penales_pred: eqPen || undefined };
    extra = { goles_local_apostado: gl, goles_visita_apostado: gv, predice_penales: predPen, equipo_penales_pred: eqPen || null };
    const pred = gl > gv ? "L" : gv > gl ? "V" : (eqPen === p.equipo_local ? "L" : "V");
    extra.prediccion = pred;
  } else {
    const pred = document.querySelector(`#pred-${idPartido} .pred-btn.active`)?.dataset.pred;
    if (!pred) { toast(p && p.fase !== "Grupos" ? "Selecciona Local o Visita" : "Selecciona Local, Empate o Visita", "error"); return; }
    body  = { id_partido: idPartido, prediccion: pred };
    extra = {};
  }
  try {
    const res  = await fetch(`${API}/apostar`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Error al apostar", "error"); return; }
    toast("✅ Apuesta guardada");
    _actualizarPartidoLocal(idPartido, extra.prediccion ?? body.prediccion, extra);
    try { sessionStorage.setItem(`polla_p_v1_${YO_ID}`, JSON.stringify({ d: partidos, t: Date.now() })); } catch (_) {}
    construirTabs();
    renderPartidos();
    updateStatsBar();
  } catch (_) { toast("Error de conexión", "error"); }
}

async function registrarApuestaModal(idPartido) {
  const p = partidos.find(x => x.id === idPartido);
  let body, extra;
  if (p && FASES_EXACTO.has(p.fase)) {
    const gl = parseInt(document.getElementById(`mgl-${idPartido}`)?.value ?? "");
    const gv = parseInt(document.getElementById(`mgv-${idPartido}`)?.value ?? "");
    if (isNaN(gl) || isNaN(gv)) { toast("Ingresa el marcador exacto", "error"); return; }
    const predPen = gl === gv;
    const eqPen   = document.getElementById(`mpen-eq-${idPartido}`)?.value || "";
    if (gl === gv && !eqPen) { toast("Marcador empatado: selecciona quién gana en penales", "error"); return; }
    body  = { id_partido: idPartido, goles_local: gl, goles_visita: gv, predice_penales: predPen, equipo_penales_pred: eqPen || undefined };
    const pred = gl > gv ? "L" : gv > gl ? "V" : (eqPen === p.equipo_local ? "L" : "V");
    extra = { goles_local_apostado: gl, goles_visita_apostado: gv, predice_penales: predPen, equipo_penales_pred: eqPen || null, prediccion: pred };
  } else {
    const pred = document.querySelector(`#modal-pred-${idPartido} .pred-btn.active`)?.dataset.pred;
    if (!pred) { toast(p && p.fase !== "Grupos" ? "Selecciona Local o Visita" : "Selecciona Local, Empate o Visita", "error"); return; }
    body  = { id_partido: idPartido, prediccion: pred };
    extra = {};
  }
  const btn = document.getElementById(`modal-btn-apostar-${idPartido}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-wc"></span> Guardando...'; }
  try {
    const res  = await fetch(`${API}/apostar`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Error al apostar", "error");
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Apostar'; }
      return;
    }
    toast("✅ Apuesta guardada");
    _actualizarPartidoLocal(idPartido, extra.prediccion ?? body.prediccion, extra);
    try { sessionStorage.setItem(`polla_p_v1_${YO_ID}`, JSON.stringify({ d: partidos, t: Date.now() })); } catch (_) {}
    const pUpd = partidos.find(x => x.id === idPartido);
    if (pUpd) _setModalBetArea(pUpd);
    construirTabs();
    renderPartidos();
    updateStatsBar();
  } catch (_) {
    toast("Error de conexión", "error");
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Apostar'; }
  }
}

// Sanitize score inputs + auto-toggle penalty section on draw
document.addEventListener("input", e => {
  if (!e.target.matches(".exacto-input")) return;

  // Digits only, clamped 0-20
  const raw = e.target.value.replace(/\D/g, "");
  const val = raw === "" ? "" : String(Math.min(20, parseInt(raw, 10)));
  if (e.target.value !== val) e.target.value = val;

  // Derive the partido ID and prefix (card vs modal)
  const id = e.target.id;
  let pid, pfx;
  if      (id.startsWith("mgl-")) { pid = id.slice(4); pfx = "m"; }
  else if (id.startsWith("mgv-")) { pid = id.slice(4); pfx = "m"; }
  else if (id.startsWith("gl-"))  { pid = id.slice(3); pfx = ""; }
  else if (id.startsWith("gv-"))  { pid = id.slice(3); pfx = ""; }
  else return;

  const glVal = parseInt(document.getElementById(`${pfx}gl-${pid}`)?.value, 10);
  const gvVal = parseInt(document.getElementById(`${pfx}gv-${pid}`)?.value, 10);
  if (isNaN(glVal) || isNaN(gvVal)) return;

  // Draw → penalties are mandatory; non-draw → hide penalty section
  const isDraw     = glVal === gvVal;
  const penSection = document.getElementById(`${pfx}pen-section-${pid}`);
  if (!penSection) return;
  penSection.style.display = isDraw ? "" : "none";
  if (!isDraw) {
    const sel = document.getElementById(`${pfx}pen-eq-${pid}`);
    if (sel) sel.value = "";
  }
});


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
