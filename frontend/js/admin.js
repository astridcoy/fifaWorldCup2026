if (ROL !== "admin") { location.replace("login.html"); }

// ── Utilidades de mensajes ─────────────────────────────────────
function msgOk(id, msg) {
  const el = document.getElementById(id);
  el.className = "msg-ok";
  el.innerHTML = `<i class="bi bi-check-circle me-1"></i>${msg}`;
}

function msgErr(id, msg) {
  const el = document.getElementById(id);
  el.className = "msg-err";
  el.innerHTML = `<i class="bi bi-x-circle me-1"></i>${msg}`;
}

function msgClear(id) {
  const el = document.getElementById(id);
  el.className    = "";
  el.textContent  = "";
}

// ── PARTIDOS ──────────────────────────────────────────────────
let partidos    = [];
let filtroTexto = "";
let filtroGrupo = "";
let filtroFoto  = "";

async function cargarPartidos() {
  try {
    const res = await fetch(`${API}/partidos`, { headers: headers() });
    partidos  = await res.json();
    llenarSelectPartidos();
    renderListaPartidos();
  } catch (_) {}
}

function llenarSelectPartidos() {
  const sel = document.getElementById("sel-partido");
  sel.innerHTML = '<option value="">— Selecciona un partido —</option>';
  partidos.filter(p => !p.finalizado).forEach(p => {
    const opt = document.createElement("option");
    opt.value       = p.id;
    opt.textContent = `${p.bandera_local} ${p.equipo_local} vs ${p.bandera_visita} ${p.equipo_visita}`;
    sel.appendChild(opt);
  });
}

function _actualizarContador(filtrados, total) {
  const el = document.getElementById("partidos-count");
  if (!el) return;
  if (filtrados === total) {
    el.textContent = `${total} partido${total !== 1 ? "s" : ""}`;
  } else {
    el.innerHTML = `<span style="color:var(--gold);font-weight:600">${filtrados}</span> de ${total} partidos`;
  }
}

function renderListaPartidos() {
  const container = document.getElementById("lista-partidos");

  if (!partidos.length) {
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><h3>No hay partidos todavía</h3></div>';
    _actualizarContador(0, 0);
    return;
  }

  const q = filtroTexto.toLowerCase();
  const lista = partidos.filter(p => {
    const textoOk = !q ||
      p.equipo_local.toLowerCase().includes(q) ||
      p.equipo_visita.toLowerCase().includes(q) ||
      (p.nombre_estadio || "").toLowerCase().includes(q);
    const grupoOk = !filtroGrupo ||
      (filtroGrupo.startsWith("Grupo ") ? p.grupo === filtroGrupo : p.fase === filtroGrupo);
    const fotoOk  = !filtroFoto ||
      (filtroFoto === "con" ? !!p.tiene_imagen : !p.tiene_imagen);
    return textoOk && grupoOk && fotoOk;
  });
  _actualizarContador(lista.length, partidos.length);

  if (!lista.length) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><span class="empty-icon">🔍</span><h3>Sin resultados</h3><p>Modifica los filtros para ver partidos.</p></div>';
    return;
  }



  const GROUP_ORDER = [
    "Grupo A","Grupo B","Grupo C","Grupo D","Grupo E","Grupo F",
    "Grupo G","Grupo H","Grupo I","Grupo J","Grupo K","Grupo L",
  ];
  
  
  const PHASE_ORDER = ["Dieciseisavos","Octavos","Cuartos","Semifinal","Tercer puesto","Final"];

  
  
  const buckets = {};
  lista.forEach(p => {
    const key = p.grupo || p.fase;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(p);
  });

  const keys = [
    ...GROUP_ORDER.filter(k => buckets[k]),
    ...PHASE_ORDER.filter(k => buckets[k]),
    ...Object.keys(buckets).filter(k => !GROUP_ORDER.includes(k) && !PHASE_ORDER.includes(k)),
  ];
  const expandAll = !!(q || filtroGrupo || filtroFoto);

  const items = keys.map((key, idx) => {
    const ps          = buckets[key];
    const isGrupo     = GROUP_ORDER.includes(key);
    const finalizados = ps.filter(p => p.finalizado).length;
    const pendientes  = ps.length - finalizados;
    const expanded    = idx === 0 || expandAll;
    const collapseId  = `cadmin-${idx}`;

    const filas = ps.map(p => `
      <tr>
        <td>
          <span style="font-weight:500">${p.bandera_local || ""} ${escHtml(p.equipo_local)}</span>
          <span style="color:var(--text-sub);font-size:.8rem;margin:0 .3rem">vs</span>
          <span style="font-weight:500">${p.bandera_visita || ""} ${escHtml(p.equipo_visita)}</span>
          ${p.nombre_estadio ? `<br><span style="font-size:.7rem;color:var(--text-sub);display:block;margin-top:.1rem"><i class="bi bi-geo-alt me-1"></i>${escHtml(p.nombre_estadio)}</span>` : ""}
        </td>
        <td style="color:var(--text-sub);font-size:.8rem;white-space:nowrap">
          ${new Date(p.fecha).toLocaleString("es-CL",{timeZone:"America/Santiago",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
        </td>
        <td>
          ${p.finalizado
            ? (() => {
                const gl = p.goles_local, gv = p.goles_visita;
                const lbl = gl > gv ? "Local gana" : gv > gl ? "Visita gana" : "Empate";
                const cls = gl > gv ? "pred-L"     : gv > gl ? "pred-V"      : "pred-E";
                return `<span class="pred-tag ${cls}">${lbl}</span>`;
              })()
            : `<span style="color:var(--text-sub);font-size:.8rem"><i class="bi bi-hourglass-split me-1"></i>Pendiente</span>`}
        </td>
        <td style="text-align:center;white-space:nowrap">
          <button class="action-btn action-btn-edit me-1" onclick="abrirEditar(${p.id})" title="Editar partido"><i class="bi bi-pencil-fill"></i></button>
          <button class="action-btn action-btn-delete" onclick="eliminarPartido(${p.id})" title="Eliminar partido"><i class="bi bi-trash-fill"></i></button>
        </td>
      </tr>`).join("");

    return `
      <div class="accordion-item" style="background:var(--card-bg);border:1px solid rgba(255,255,255,.08)!important;border-radius:10px!important;margin-bottom:.5rem;overflow:hidden">
        <h2 class="accordion-header">
          <button class="accordion-button ${expanded ? "" : "collapsed"}" type="button"
            data-bs-toggle="collapse" data-bs-target="#${collapseId}"
            style="background:var(--card-bg);color:#e8eef7;box-shadow:none;padding:.75rem 1.1rem;gap:.6rem;font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:.5px">
            <i class="bi bi-${isGrupo ? "grid-3x3-gap-fill" : "trophy-fill"}" style="color:var(--gold);font-size:.85rem"></i>
            ${escHtml(key)}
            <span style="font-family:system-ui,sans-serif;font-size:.7rem;font-weight:400;color:var(--text-sub);margin-left:.3rem">${ps.length} partido${ps.length !== 1 ? "s" : ""}</span>
            ${finalizados > 0 ? `<span style="background:rgba(245,184,0,.12);color:var(--gold);border:1px solid rgba(245,184,0,.25);border-radius:4px;padding:.05rem .42rem;font-family:system-ui,sans-serif;font-size:.65rem;font-weight:700;margin-left:.2rem">${finalizados} fin.</span>` : ""}
            ${pendientes  > 0 ? `<span style="background:rgba(255,255,255,.05);color:var(--text-sub);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:.05rem .42rem;font-family:system-ui,sans-serif;font-size:.65rem;font-weight:700;margin-left:.2rem">${pendientes} pend.</span>` : ""}
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${expanded ? "show" : ""}">
          <div class="accordion-body" style="padding:.6rem;background:rgba(0,0,0,.12)">
            <div style="overflow-x:auto">
              <table class="ranking-table" style="margin:0">
                <thead><tr><th>Partido</th><th>Fecha</th><th>Resultado</th><th style="text-align:center">Acciones</th></tr></thead>
                <tbody>${filas}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  container.innerHTML = `<div class="accordion" id="accordion-admin-partidos">${items}</div>`;
}

function syncGrupoVisibility(faseId, wrapId) {
  document.getElementById(wrapId).style.display =
    document.getElementById(faseId).value === "Grupos" ? "" : "none";
}

// Desde Dieciseisavos en adelante el partido siempre tiene un ganador (alargue/penales),
// así que "Empate" deja de ser una opción válida de resultado o de apuesta.
function _syncEmpateBtn(prefix, fase) {
  const btn = document.getElementById(`${prefix}-btn-E`);
  if (!btn) return;
  btn.style.display = fase === "Grupos" ? "" : "none";
}

document.getElementById("fase-partido").addEventListener("change", () =>
  syncGrupoVisibility("fase-partido", "wrap-grupo-crear")
);
document.getElementById("edit-fase").addEventListener("change", () => {
  syncGrupoVisibility("edit-fase", "wrap-grupo-editar");
  const fase = document.getElementById("edit-fase").value;
  _syncEmpateBtn("edit-res", fase);
  if (fase !== "Grupos" && _editResSeleccionado === "E") _setEditResultado("");
});
syncGrupoVisibility("fase-partido", "wrap-grupo-crear");

// ── IMAGEN ESTADIO ────────────────────────────────────────────
let estadioCrearBase64  = null;
let estadioEditarBase64 = null;
let estadioEditarCambio = false;

function setupImagenEstadio({
  fileInputId, pickBtnId, urlInputId,
  previewWrapId, previewImgId, clearBtnId, onLoad,
}) {
  const fileInput   = document.getElementById(fileInputId);
  const pickBtn     = document.getElementById(pickBtnId);
  const urlInput    = document.getElementById(urlInputId);
  const previewWrap = document.getElementById(previewWrapId);
  const previewImg  = document.getElementById(previewImgId);
  const clearBtn    = document.getElementById(clearBtnId);

  pickBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src          = e.target.result;
      previewWrap.style.display = "";
      urlInput.value          = "";
      onLoad(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  urlInput.addEventListener("input", () => {
    const url = urlInput.value.trim();
    if (url) {
      previewImg.src          = url;
      previewWrap.style.display = "";
      onLoad(null);
    } else {
      previewWrap.style.display = "none";
      onLoad(null);
    }
  });

  clearBtn.addEventListener("click", () => {
    fileInput.value           = "";
    urlInput.value            = "";
    previewImg.src            = "";
    previewWrap.style.display = "none";
    onLoad(null);
  });
}

setupImagenEstadio({
  fileInputId:   "file-estadio",
  pickBtnId:     "btn-pick-estadio",
  urlInputId:    "url-estadio",
  previewWrapId: "preview-estadio-crear",
  previewImgId:  "img-preview-estadio-crear",
  clearBtnId:    "btn-clear-estadio-crear",
  onLoad: b64 => { estadioCrearBase64 = b64; },
});

setupImagenEstadio({
  fileInputId:   "edit-file-estadio",
  pickBtnId:     "btn-edit-pick-estadio",
  urlInputId:    "edit-url-estadio",
  previewWrapId: "preview-estadio-editar",
  previewImgId:  "img-preview-estadio-editar",
  clearBtnId:    "btn-clear-estadio-editar",
  onLoad: b64 => { estadioEditarBase64 = b64; estadioEditarCambio = true; },
});

// ── CREAR PARTIDO ─────────────────────────────────────────────
document.getElementById("btn-crear").addEventListener("click", async () => {
  const eqL  = document.getElementById("eq-local").value.trim();
  const eqV  = document.getElementById("eq-visita").value.trim();
  const flL  = document.getElementById("flag-local").value.trim();
  const flV  = document.getElementById("flag-visita").value.trim();
  const fech = document.getElementById("fecha-partido").value;
  const fase = document.getElementById("fase-partido").value;
  const grupo = fase === "Grupos" ? document.getElementById("grupo-partido").value : "";

  if (!eqL || !eqV || !fech) {
    msgErr("msg-crear", "Completa los campos obligatorios");
    return;
  }

  try {
    const res = await fetch(`${API}/admin/partido`, {
      method:  "POST",
      headers: headers(),
      body: JSON.stringify({
        equipo_local:   eqL,
        equipo_visita:  eqV,
        bandera_local:  flL,
        bandera_visita: flV,
        fecha:          fech,
        fase,
        grupo,
        nombre_estadio: document.getElementById("nombre-estadio").value.trim(),
        imagen_estadio: estadioCrearBase64 || document.getElementById("url-estadio").value.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      msgErr("msg-crear", data.error);
      return;
    }
    msgOk("msg-crear", "Partido creado correctamente");
    toast("✅ Partido creado");
    ["eq-local","eq-visita","flag-local","flag-visita","fecha-partido","nombre-estadio","url-estadio"]
      .forEach(id => { document.getElementById(id).value = ""; });
    estadioCrearBase64 = null;
    document.getElementById("preview-estadio-crear").style.display = "none";
    cargarPartidos();
  } catch (_) {
    msgErr("msg-crear", "Error de conexión");
  }
});

// ── EDITAR PARTIDO ────────────────────────────────────────────
let modalEditar;

document.addEventListener("DOMContentLoaded", () => {
  modalEditar  = new bootstrap.Modal(document.getElementById("modal-editar"));
  modalUsuario = new bootstrap.Modal(document.getElementById("modal-usuario"));

  document.getElementById("filtro-pais").addEventListener("input", e => {
    filtroTexto = e.target.value.trim();
    renderListaPartidos();
  });

  document.getElementById("filtro-grupo").addEventListener("change", e => {
    filtroGrupo = e.target.value;
    renderListaPartidos();
  });

  document.getElementById("filtro-foto").addEventListener("change", e => {
    filtroFoto = e.target.value;
    renderListaPartidos();
  });

  document.getElementById("btn-expand-all").addEventListener("click", () => {
    document.querySelectorAll("#accordion-admin-partidos .accordion-collapse").forEach(el => {
      bootstrap.Collapse.getOrCreateInstance(el).show();
    });
  });

  document.getElementById("btn-collapse-all").addEventListener("click", () => {
    document.querySelectorAll("#accordion-admin-partidos .accordion-collapse").forEach(el => {
      bootstrap.Collapse.getOrCreateInstance(el).hide();
    });
  });

  _modalVoto = new bootstrap.Modal(document.getElementById("modal-voto-admin"));
  ["L", "E", "V"].forEach(v => {
    document.getElementById(`voto-btn-${v}`).addEventListener("click", () => {
      _votoPred = v;
      ["L", "E", "V"].forEach(b => {
        document.getElementById(`voto-btn-${b}`).className =
          `btn-res-opcion flex-fill${b === v ? ` active-${v}` : ""}`;
      });
    });
  });
  document.getElementById("btn-guardar-voto").addEventListener("click", guardarVotoAdmin);

  document.getElementById("modal-voto-partido").addEventListener("change", () => {
    const p = partidos.find(x => x.id === parseInt(document.getElementById("modal-voto-partido").value));
    _syncEmpateBtn("voto", p ? p.fase : "Grupos");
    if ((!p || p.fase !== "Grupos") && _votoPred === "E") {
      _votoPred = "";
      ["L", "E", "V"].forEach(v => document.getElementById(`voto-btn-${v}`).className = "btn-res-opcion flex-fill");
    }
  });
});

function abrirEditar(id) {
  const p = partidos.find(x => x.id === id);
  if (!p) return;

  document.getElementById("edit-id").value             = p.id;
  document.getElementById("edit-eq-local").value       = p.equipo_local;
  document.getElementById("edit-eq-visita").value      = p.equipo_visita;
  document.getElementById("edit-flag-local").value     = p.bandera_local  || "";
  document.getElementById("edit-flag-visita").value    = p.bandera_visita || "";
  document.getElementById("edit-fecha").value          = p.fecha ? p.fecha.slice(0, 16) : "";
  document.getElementById("edit-fase").value           = p.fase;
  document.getElementById("edit-grupo").value          = p.grupo          || "";
  document.getElementById("edit-nombre-estadio").value = p.nombre_estadio || "";

  estadioEditarBase64 = null;
  estadioEditarCambio = false;

  const prevEdit = document.getElementById("preview-estadio-editar");
  const imgEdit  = document.getElementById("img-preview-estadio-editar");
  document.getElementById("edit-url-estadio").value = "";
  imgEdit.src            = "";
  prevEdit.style.display = "none";
  if (p.tiene_imagen) {
    fetch(`${API}/partidos/${p.id}/imagen`, { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.imagen_estadio) {
          imgEdit.src            = d.imagen_estadio;
          prevEdit.style.display = "";
        }
      }).catch(() => {});
  }

  const finalizado = !!p.finalizado;
  document.getElementById("edit-finalizado").checked = finalizado;
  document.getElementById("wrap-resultado-editar").style.display = finalizado ? "" : "none";

  let initRes = "";
  if (finalizado) {
    const gl = p.goles_local ?? 0;
    const gv = p.goles_visita ?? 0;
    initRes = gl > gv ? "L" : gv > gl ? "V" : "E";
  }
  _syncEmpateBtn("edit-res", p.fase);
  _setEditResultado(initRes);

  syncGrupoVisibility("edit-fase", "wrap-grupo-editar");
  msgClear("msg-editar");
  modalEditar.show();
}

document.getElementById("edit-finalizado").addEventListener("change", () => {
  document.getElementById("wrap-resultado-editar").style.display =
    document.getElementById("edit-finalizado").checked ? "" : "none";
});

document.getElementById("btn-guardar-editar").addEventListener("click", async () => {
  const id   = document.getElementById("edit-id").value;
  const eqL  = document.getElementById("edit-eq-local").value.trim();
  const eqV  = document.getElementById("edit-eq-visita").value.trim();
  const flL  = document.getElementById("edit-flag-local").value.trim();
  const flV  = document.getElementById("edit-flag-visita").value.trim();
  const fech = document.getElementById("edit-fecha").value;
  const fase = document.getElementById("edit-fase").value;
  const grupo = fase === "Grupos" ? document.getElementById("edit-grupo").value : "";

  if (!eqL || !eqV || !fech) {
    msgErr("msg-editar", "Completa los campos obligatorios");
    return;
  }

  const finalizado = document.getElementById("edit-finalizado").checked;
  if (finalizado && !_editResSeleccionado) {
    msgErr("msg-editar", fase === "Grupos" ? "Selecciona un resultado (Local gana / Empate / Visita gana)" : "Selecciona un resultado (Local gana / Visita gana)");
    return;
  }
  const golesLocal  = _editResSeleccionado === "L" ? 1 : 0;
  const golesVisita = _editResSeleccionado === "V" ? 1 : 0;
  const btn = document.getElementById("btn-guardar-editar");
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner-wc"></span> Guardando...';

  try {
    const res = await fetch(`${API}/admin/partido/${id}`, {
      method:  "PUT",
      headers: headers(),
      body: JSON.stringify({
        equipo_local:   eqL,
        equipo_visita:  eqV,
        bandera_local:  flL,
        bandera_visita: flV,
        fecha:          fech,
        fase,
        grupo,
        finalizado,
        goles_local:    golesLocal,
        goles_visita:   golesVisita,
        nombre_estadio: document.getElementById("edit-nombre-estadio").value.trim(),
        ...(estadioEditarCambio
          ? { imagen_estadio: estadioEditarBase64 || document.getElementById("edit-url-estadio").value.trim() || null }
          : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      msgErr("msg-editar", data.error || `Error ${res.status}`);
      toast(data.error || `Error ${res.status}`, "error");
      return;
    }
    toast("✅ Partido actualizado");
    modalEditar.hide();
    cargarPartidos();
  } catch (e) {
    msgErr("msg-editar", "Error de conexión: " + e.message);
    toast("Error de conexión: " + e.message, "error");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-floppy me-1"></i> Guardar cambios';
  }
});

async function eliminarPartido(id) {
  const p = partidos.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar "${p.equipo_local} vs ${p.equipo_visita}"?\nSe eliminarán también todas las apuestas asociadas. Esta acción no se puede deshacer.`)) return;
  try {
    const res  = await fetch(`${API}/admin/partido/${id}`, { method: "DELETE", headers: headers() });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || `Error ${res.status}`, "error");
      return;
    }
    toast("🗑️ Partido eliminado");
    cargarPartidos();
  } catch (e) {
    toast("Error de conexión: " + e.message, "error");
  }
}

// ── RESULTADO ─────────────────────────────────────────────────
let _resSeleccionado = "";

function _setupResBtns(prefix, onSelect) {
  ["L", "E", "V"].forEach(val => {
    document.getElementById(`${prefix}-btn-${val}`).addEventListener("click", () => {
      ["L", "E", "V"].forEach(v =>
        document.getElementById(`${prefix}-btn-${v}`).className =
          `btn-res-opcion flex-fill${v === val ? ` active-${v}` : ""}`
      );
      onSelect(val);
    });
  });
}

const FASES_EXACTO_ADMIN = new Set(["Cuartos", "Semifinal", "Final", "Tercer puesto"]);

_setupResBtns("res", val => { _resSeleccionado = val; });

document.getElementById("sel-partido").addEventListener("change", () => {
  const p = partidos.find(x => x.id === parseInt(document.getElementById("sel-partido").value));
  const fase = p ? p.fase : "Grupos";
  const esExacto = FASES_EXACTO_ADMIN.has(fase);

  document.getElementById("res-lev-area").style.display    = esExacto ? "none" : "";
  document.getElementById("res-exacto-area").style.display = esExacto ? "" : "none";

  if (esExacto && p) {
    document.getElementById("res-flag-local").textContent   = p.bandera_local;
    document.getElementById("res-name-local").textContent   = p.equipo_local;
    document.getElementById("res-flag-visita").textContent  = p.bandera_visita;
    document.getElementById("res-name-visita").textContent  = p.equipo_visita;
    document.getElementById("res-gl").value = "";
    document.getElementById("res-gv").value = "";
    document.getElementById("res-fue-penales").checked = false;
    document.getElementById("res-penales-who").style.display = "none";
    const sel = document.getElementById("res-ganador-penales");
    sel.innerHTML = `<option value="">— Selecciona el equipo —</option>
      <option value="${escHtml(p.equipo_local)}">${p.bandera_local} ${escHtml(p.equipo_local)}</option>
      <option value="${escHtml(p.equipo_visita)}">${p.bandera_visita} ${escHtml(p.equipo_visita)}</option>`;
  } else {
    _syncEmpateBtn("res", fase);
    if (fase !== "Grupos" && _resSeleccionado === "E") {
      _resSeleccionado = "";
      ["L", "E", "V"].forEach(v => document.getElementById(`res-btn-${v}`).className = "btn-res-opcion flex-fill");
    }
  }
});

document.getElementById("res-fue-penales").addEventListener("change", e => {
  document.getElementById("res-penales-who").style.display = e.target.checked ? "" : "none";
});

let _editResSeleccionado = "";

function _setEditResultado(val) {
  _editResSeleccionado = val;
  ["L", "E", "V"].forEach(v =>
    document.getElementById(`edit-res-btn-${v}`).className =
      `btn-res-opcion flex-fill${v === val ? ` active-${v}` : ""}`
  );
}

_setupResBtns("edit-res", val => { _setEditResultado(val); });

document.getElementById("btn-resultado").addEventListener("click", async () => {
  const idPartido = document.getElementById("sel-partido").value;
  if (!idPartido) { msgErr("msg-resultado", "Selecciona un partido"); return; }

  const p = partidos.find(x => x.id === parseInt(idPartido));
  const esExacto = p && FASES_EXACTO_ADMIN.has(p.fase);
  let body;

  if (esExacto) {
    const gl = parseInt(document.getElementById("res-gl").value ?? "");
    const gv = parseInt(document.getElementById("res-gv").value ?? "");
    if (isNaN(gl) || isNaN(gv)) { msgErr("msg-resultado", "Ingresa el marcador exacto"); return; }
    const fuePenales = document.getElementById("res-fue-penales").checked;
    const ganadorPen = document.getElementById("res-ganador-penales").value;
    if (fuePenales && !ganadorPen) { msgErr("msg-resultado", "Indica qué equipo avanzó en penales"); return; }
    if (gl === gv && !fuePenales) { msgErr("msg-resultado", "Marcador empatado: marca '¿Fue a penales?' e indica el ganador"); return; }
    const resumen = `${gl}-${gv}${fuePenales ? ` (pens: ${ganadorPen})` : ""}`;
    if (!confirm(`¿Confirmas el resultado ${resumen}?\nEsta acción calculará los puntos de todos los usuarios.`)) return;
    body = { goles_local: gl, goles_visita: gv, fue_penales: fuePenales, equipo_ganador_penales: ganadorPen || null };
  } else {
    if (!_resSeleccionado) {
      msgErr("msg-resultado", p && p.fase !== "Grupos" ? "Selecciona un resultado (Local gana / Visita gana)" : "Selecciona un resultado (Local gana / Empate / Visita gana)");
      return;
    }
    const resTextos = { L: "Local gana", E: "Empate", V: "Visita gana" };
    if (!confirm(`¿Confirmas que el resultado es "${resTextos[_resSeleccionado]}"?\nEsta acción calculará los puntos de todos los usuarios.`)) return;
    const gl = _resSeleccionado === "L" ? 1 : 0;
    const gv = _resSeleccionado === "V" ? 1 : 0;
    body = { goles_local: gl, goles_visita: gv };
  }

  try {
    const res = await fetch(`${API}/admin/resultado/${idPartido}`, {
      method: "PUT", headers: headers(), body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { msgErr("msg-resultado", data.error); return; }
    msgOk("msg-resultado", "Resultado ingresado y puntos calculados");
    toast("✅ Resultado registrado");
    _resSeleccionado = "";
    ["L", "E", "V"].forEach(v =>
      document.getElementById(`res-btn-${v}`).className = "btn-res-opcion flex-fill"
    );
    cargarPartidos();
  } catch (_) {
    msgErr("msg-resultado", "Error de conexión");
  }
});

// ── PODIO REAL (campeón / 2do / 3er lugar) ─────────────────────
function _setupPodioReal({ inputId, btnId, msgId, endpoint, body, etiqueta, puntos, toastIcono }) {
  document.getElementById(btnId).addEventListener("click", async () => {
    const valor = document.getElementById(inputId).value.trim();
    if (!valor) {
      msgErr(msgId, `Ingresa el nombre del ${etiqueta}`);
      return;
    }
    if (!confirm(`¿Confirmas que el ${etiqueta} es "${valor}"?\nSe asignarán ${puntos} puntos a quienes lo acertaron.`)) return;

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method:  "PUT",
        headers: headers(),
        body:    JSON.stringify({ [body]: valor }),
      });
      const data = await res.json();
      if (!res.ok) {
        msgErr(msgId, data.error);
        return;
      }
      msgOk(msgId, data.mensaje);
      toast(`${toastIcono} ${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} registrado`);
    } catch (_) {
      msgErr(msgId, "Error de conexión");
    }
  });
}

_setupPodioReal({
  inputId: "campeon-real", btnId: "btn-campeon-real", msgId: "msg-campeon",
  endpoint: "/admin/campeon-real", body: "campeon", etiqueta: "campeón", puntos: 5, toastIcono: "🏆",
});
_setupPodioReal({
  inputId: "segundo-real", btnId: "btn-segundo-real", msgId: "msg-segundo",
  endpoint: "/admin/segundo-real", body: "equipo", etiqueta: "2do lugar", puntos: 3, toastIcono: "🥈",
});
_setupPodioReal({
  inputId: "tercero-real", btnId: "btn-tercero-real", msgId: "msg-tercero",
  endpoint: "/admin/tercero-real", body: "equipo", etiqueta: "3er lugar", puntos: 2, toastIcono: "🥉",
});

cargarPartidos();

// ── USUARIOS ──────────────────────────────────────────────────
let modalUsuario;
let usuariosCache       = [];
let filtroUsuarioTexto  = "";

document.getElementById("btn-toggle-usuario-pw").addEventListener("click", () => {
  const inp  = document.getElementById("usuario-password");
  const icon = document.getElementById("icon-toggle-usuario-pw");
  if (inp.type === "password") {
    inp.type       = "text";
    icon.className = "bi bi-eye-slash";
  } else {
    inp.type       = "password";
    icon.className = "bi bi-eye";
  }
});

async function cargarUsuarios() {
  try {
    const res = await fetch(`${API}/admin/usuarios`, { headers: headers() });
    usuariosCache = await res.json();
    renderTablaUsuarios(usuariosCache);
  } catch (_) {
    document.getElementById("lista-usuarios").innerHTML =
      '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error al cargar usuarios</h3></div>';
  }
}

function _filaUsuario(u, ME) {
  const avatarHtml = u.foto_perfil
    ? `<img src="${u.foto_perfil}" alt="${u.nombre}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)" />`
    : `<span style="width:38px;height:38px;border-radius:50%;background:rgba(245,184,0,.15);border:2px solid rgba(245,184,0,.3);display:inline-flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.1rem"><i class="bi bi-person-fill"></i></span>`;
  const rolBadge = u.rol === "admin"
    ? `<span style="background:rgba(245,184,0,.18);color:var(--gold);border:1px solid rgba(245,184,0,.35);border-radius:4px;padding:.15rem .55rem;font-size:.72rem;font-family:'Bebas Neue',sans-serif;letter-spacing:.5px">ADMIN</span>`
    : `<span style="background:rgba(255,255,255,.07);color:var(--text-sub);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:.15rem .55rem;font-size:.72rem">usuario</span>`;
  const esSelf = u.id === ME
    ? `<span style="font-size:.7rem;color:var(--text-sub);margin-left:.4rem">(tú)</span>`
    : "";
  return `<tr>
    <td style="width:48px">${avatarHtml}</td>
    <td>${escHtml(u.nombre)}${esSelf}</td>
    <td style="color:var(--text-sub);font-size:.85rem">${escHtml(u.email)}</td>
    <td>${rolBadge}</td>
    <td>
      <button class="action-btn action-btn-edit me-1" onclick="abrirEditarUsuario(${u.id})" title="Editar usuario"><i class="bi bi-pencil-fill"></i></button>
      <button class="action-btn action-btn-delete" onclick="eliminarUsuario(${u.id})" title="Eliminar usuario"
        ${u.id === ME ? "disabled style='opacity:.4;cursor:not-allowed'" : ""}><i class="bi bi-trash-fill"></i></button>
    </td>
  </tr>`;
}

function renderTablaUsuarios(usuarios) {
  const cont = document.getElementById("lista-usuarios");
  if (!usuarios.length) {
    cont.innerHTML = '<div class="empty-state"><span class="empty-icon">👤</span><h3>No hay usuarios registrados</h3></div>';
    return;
  }

  const ME = parseInt(localStorage.getItem("id") || "0");
  const q  = filtroUsuarioTexto.toLowerCase();
  const filtrados = usuarios.filter(u =>
    !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );

  if (!filtrados.length) {
    cont.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><span class="empty-icon">🔍</span><h3>Sin resultados</h3><p>Modifica la búsqueda para ver usuarios.</p></div>';
    return;
  }

  const GRUPOS = [
    { rol: "admin",   titulo: "Administradores", icono: "shield-fill-check" },
    { rol: "usuario", titulo: "Usuarios",         icono: "person-fill" },
  ];
  const expandAll = !!q;

  let renderedIdx = 0;
  const items = GRUPOS.map(g => {
    const us = filtrados.filter(u => u.rol === g.rol);
    if (!us.length) return "";
    const expanded    = renderedIdx++ === 0 || expandAll;
    const collapseId  = `cusuarios-${g.rol}`;
    const filas       = us.map(u => _filaUsuario(u, ME)).join("");

    return `
      <div class="accordion-item" style="background:var(--card-bg);border:1px solid rgba(255,255,255,.08)!important;border-radius:10px!important;margin-bottom:.5rem;overflow:hidden">
        <h2 class="accordion-header">
          <button class="accordion-button ${expanded ? "" : "collapsed"}" type="button"
            data-bs-toggle="collapse" data-bs-target="#${collapseId}"
            style="background:var(--card-bg);color:#e8eef7;box-shadow:none;padding:.75rem 1.1rem;gap:.6rem;font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:.5px">
            <i class="bi bi-${g.icono}" style="color:var(--gold);font-size:.85rem"></i>
            ${g.titulo}
            <span style="font-family:system-ui,sans-serif;font-size:.7rem;font-weight:400;color:var(--text-sub);margin-left:.3rem">${us.length} usuario${us.length !== 1 ? "s" : ""}</span>
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${expanded ? "show" : ""}">
          <div class="accordion-body" style="padding:.6rem;background:rgba(0,0,0,.12)">
            <div style="overflow-x:auto">
              <table class="ranking-table" style="margin:0">
                <thead><tr><th></th><th>Nombre</th><th>Email</th><th>Rol</th><th style="text-align:center">Acciones</th></tr></thead>
                <tbody>${filas}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  cont.innerHTML = `<div class="accordion" id="accordion-usuarios">${items}</div>`;
}



document.getElementById("btn-nuevo-usuario").addEventListener("click", () => {
  document.getElementById("usuario-edit-id").value          = "";
  document.getElementById("usuario-nombre").value           = "";
  document.getElementById("usuario-email").value            = "";
  document.getElementById("usuario-rol").value              = "usuario";
  document.getElementById("usuario-password").value         = "";
  document.getElementById("modal-usuario-titulo-texto").textContent = "Nuevo usuario";
  document.getElementById("usuario-pw-label").textContent   = "Contraseña";
  document.getElementById("usuario-pw-hint").style.display  = "none";
  document.getElementById("usuario-password").placeholder   = "Mín. 8 caracteres";
  msgClear("msg-usuario");
  modalUsuario.show();
});



async function abrirEditarUsuario(id) {
  const res = await fetch(`${API}/admin/usuarios`, { headers: headers() });
  usuariosCache = await res.json();
  const u = usuariosCache.find(x => x.id === id);
  if (!u) return;
  document.getElementById("usuario-edit-id").value          = u.id;
  document.getElementById("usuario-nombre").value           = u.nombre;
  document.getElementById("usuario-email").value            = u.email;
  document.getElementById("usuario-rol").value              = u.rol;
  document.getElementById("usuario-password").value         = "";
  document.getElementById("modal-usuario-titulo-texto").textContent = "Editar usuario";
  document.getElementById("usuario-pw-label").textContent   = "Nueva contraseña (opcional)";
  document.getElementById("usuario-pw-hint").style.display  = "";
  document.getElementById("usuario-password").placeholder   = "Dejar en blanco para no cambiar";
  msgClear("msg-usuario");
  modalUsuario.show();
}



document.getElementById("btn-guardar-usuario").addEventListener("click", async () => {
  const id       = document.getElementById("usuario-edit-id").value;
  const nombre   = document.getElementById("usuario-nombre").value.trim();
  const email    = document.getElementById("usuario-email").value.trim();
  const rol      = document.getElementById("usuario-rol").value;
  const password = document.getElementById("usuario-password").value;
  const esNuevo  = !id;

  if (!nombre || !email) {
    msgErr("msg-usuario", "Nombre y email son obligatorios");
    return;
  }
  if (esNuevo && !password) {
    msgErr("msg-usuario", "La contraseña es obligatoria");
    return;
  }

  const body = { nombre, email, rol };
  if (password) body.password = password;

  const btn = document.getElementById("btn-guardar-usuario");
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner-wc"></span> Guardando...';




  try {
    const res = await fetch(
      esNuevo ? `${API}/admin/usuario` : `${API}/admin/usuario/${id}`,
      { method: esNuevo ? "POST" : "PUT", headers: headers(), body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok) {
      msgErr("msg-usuario", data.error);
      return;
    }
    toast(esNuevo ? "✅ Usuario creado" : "✅ Usuario actualizado");
    modalUsuario.hide();
    cargarUsuarios();
  } catch (_) {
    msgErr("msg-usuario", "Error de conexión");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-floppy me-1"></i> Guardar';
  }
});




async function eliminarUsuario(id) {
  const u      = usuariosCache.find(x => x.id === id);
  const nombre = u ? u.nombre : `#${id}`;
  if (!confirm(`¿Eliminar al usuario "${nombre}"?\nSe eliminarán también todas sus apuestas. Esta acción no se puede deshacer.`)) return;
  try {
    const res  = await fetch(`${API}/admin/usuario/${id}`, { method: "DELETE", headers: headers() });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || `Error ${res.status}`, "error");
      return;
    }
    toast("🗑️ Usuario eliminado");
    cargarUsuarios();
  } catch (_) {
    toast("Error de conexión", "error");
  }
}

// ── Filtro y expandir/colapsar usuarios ─────────────────────────
// El navegador puede restaurar el valor anterior del input al recargar (F5)
// aunque tenga autocomplete="off"; se fuerza vacío para que siempre arranque limpio.
document.getElementById("filtro-usuario").value = "";
document.getElementById("filtro-usuario").addEventListener("input", e => {
  filtroUsuarioTexto = e.target.value.trim();
  renderTablaUsuarios(usuariosCache);
});

document.getElementById("btn-expand-all-usuarios").addEventListener("click", () => {
  document.querySelectorAll("#accordion-usuarios .accordion-collapse").forEach(el => {
    bootstrap.Collapse.getOrCreateInstance(el).show();
  });
});

document.getElementById("btn-collapse-all-usuarios").addEventListener("click", () => {
  document.querySelectorAll("#accordion-usuarios .accordion-collapse").forEach(el => {
    bootstrap.Collapse.getOrCreateInstance(el).hide();
  });
});

cargarUsuarios();

// ── VOTOS ─────────────────────────────────────────────────────
const VOTO_ADMIN_GRACIA_DIAS = 7;
function _dentroPlazoEdicion(fechaStr) {
  const limite = new Date(fechaStr).getTime() + VOTO_ADMIN_GRACIA_DIAS * 86400000;
  return Date.now() <= limite;
}

let todosVotos     = [];
let _renderedVotos = {};
let _modalVoto     = null;
let _votoUid       = null;
let _votoPid       = null;
let _votoPred      = "";

function abrirVotoNuevo(uid) {
  const data = _renderedVotos[uid];
  if (!data) return;
  _votoUid  = parseInt(uid);
  _votoPid  = null;
  _votoPred = "";
  ["L", "E", "V"].forEach(v => {
    document.getElementById(`voto-btn-${v}`).className = "btn-res-opcion flex-fill";
  });
  const votadosIds = new Set(data.votos.map(v => v.id_partido));
  const sinVotar   = partidos.filter(p =>
    !votadosIds.has(p.id) && (!p.finalizado || _dentroPlazoEdicion(p.fecha))
  );
  const sel = document.getElementById("modal-voto-partido");
  sel.innerHTML = '<option value="">— Selecciona un partido —</option>';
  if (!sinVotar.length) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.textContent = "No hay partidos pendientes sin votar";
    sel.appendChild(opt);
  }
  sinVotar.forEach(p => {
    const opt = document.createElement("option");
    opt.value       = p.id;
    opt.textContent = `${p.bandera_local ?? ""} ${p.equipo_local} vs ${p.bandera_visita ?? ""} ${p.equipo_visita}${p.finalizado ? " (finalizado)" : ""}`;
    sel.appendChild(opt);
  });
  _syncEmpateBtn("voto", "Grupos"); // se ajusta de nuevo al elegir un partido en el <select>
  document.getElementById("modal-voto-partido-wrap").style.display = "";
  document.getElementById("modal-voto-titulo").textContent = "Agregar voto";
  document.getElementById("modal-voto-info").innerHTML =
    `Usuario: <strong style="color:#e2e8f0">${escHtml(data.nombre)}</strong>`;
  msgClear("msg-voto-admin");
  _modalVoto.show();
}

function abrirVotoEditar(uid, idx) {
  const data = _renderedVotos[uid];
  if (!data) return;
  const voto = data.votos[idx];
  _votoUid  = parseInt(uid);
  _votoPid  = voto.id_partido;
  _votoPred = voto.prediccion || "";
  _syncEmpateBtn("voto", voto.fase);
  ["L", "E", "V"].forEach(v => {
    document.getElementById(`voto-btn-${v}`).className =
      `btn-res-opcion flex-fill${v === _votoPred ? ` active-${v}` : ""}`;
  });
  document.getElementById("modal-voto-partido-wrap").style.display = "none";
  document.getElementById("modal-voto-titulo").textContent = "Editar voto";
  document.getElementById("modal-voto-info").innerHTML =
    `Usuario: <strong style="color:#e2e8f0">${escHtml(data.nombre)}</strong><br>` +
    `Partido: <strong style="color:#e2e8f0">${escHtml(voto.equipo_local)} vs ${escHtml(voto.equipo_visita)}</strong>` +
    (voto.finalizado
      ? `<br><span style="color:var(--gold)"><i class="bi bi-flag-fill me-1"></i>Finalizado · resultado ${voto.resultado_local}-${voto.resultado_visita}</span>`
      : "");
  msgClear("msg-voto-admin");
  _modalVoto.show();
}

async function guardarVotoAdmin() {
  const pid = _votoPid ?? parseInt(document.getElementById("modal-voto-partido").value);
  if (!pid) { msgErr("msg-voto-admin", "Selecciona un partido"); return; }
  if (!_votoPred) { msgErr("msg-voto-admin", "Selecciona una predicción"); return; }
  const btn = document.getElementById("btn-guardar-voto");
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner-wc"></span> Guardando...';
  try {
    const res = await fetch(`${API}/admin/apuesta`, {
      method:  "PUT",
      headers: headers(),
      body:    JSON.stringify({ id_usuario: _votoUid, id_partido: pid, prediccion: _votoPred }),
    });
    const data = await res.json();
    if (!res.ok) { msgErr("msg-voto-admin", data.error || "Error al guardar"); return; }
    toast("✅ Voto guardado");
    _modalVoto.hide();
    cargarVotos();
  } catch (_) {
    msgErr("msg-voto-admin", "Error de conexión");
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-floppy me-1"></i> Guardar';
  }
}

async function cargarVotos() {
  try {
    const res = await fetch(`${API}/admin/apuestas`, { headers: headers() });
    if (!res.ok) throw new Error();
    todosVotos = await res.json();
    renderVotos();
  } catch (_) {
    document.getElementById("lista-votos").innerHTML =
      '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error cargando votos</h3></div>';
  }
}

function renderVotos() {
  const cont = document.getElementById("lista-votos");
  if (!todosVotos.length) {
    cont.innerHTML = '<div class="empty-state"><span class="empty-icon">🗳️</span><h3>No hay votos registrados</h3></div>';
    return;
  }

  const porUsuario = {};
  todosVotos.forEach(v => {
    if (!porUsuario[v.id_usuario]) {
      porUsuario[v.id_usuario] = {
        nombre:      v.nombre,
        email:       v.email,
        foto_perfil: v.foto_perfil,
        votos:       [],
      };
    }
    porUsuario[v.id_usuario].votos.push(v);
  });




  _renderedVotos = {};
  const items = Object.entries(porUsuario).map(([uid, u], idx) => {
    _renderedVotos[uid] = u;
    const totalVotos  = u.votos.length;
    const totalPts    = u.votos.reduce((s, v) => s + (v.puntos ?? 0), 0);
    const finalizados = u.votos.filter(v => v.finalizado).length;
    const pendientes  = totalVotos - finalizados;
    const votadosIds  = new Set(u.votos.map(v => v.id_partido));
    const sinVotar    = partidos.filter(p =>
      !votadosIds.has(p.id) && (!p.finalizado || _dentroPlazoEdicion(p.fecha))
    ).length;

    const filas = u.votos.map((v, vIdx) => {
      const pts = v.puntos ?? 0;
      const ptsHtml = v.finalizado
        ? `<span class="pts-badge ${pts > 0 ? "pts-1" : "pts-0"}">${pts} pts</span>`
        : '<span style="color:var(--text-sub);font-size:.8rem">—</span>';
      const esExacto = FASES_EXACTO_ADMIN.has(v.fase);

      // Resultado real del partido
      const resultado = v.finalizado
        ? (() => {
            const gl = v.resultado_local, gv = v.resultado_visita;
            if (esExacto) {
              const cls = gl > gv ? "pred-L" : gv > gl ? "pred-V" : "pred-E";
              let lbl = `${gl} - ${gv}`;
              if (v.fue_penales && v.equipo_ganador_penales)
                lbl += ` <span style="font-size:.72rem;opacity:.8">(pens: ${escHtml(v.equipo_ganador_penales)})</span>`;
              return `<span class="pred-tag ${cls}">${lbl}</span>`;
            }
            const lbl = gl > gv ? "Local gana" : gv > gl ? "Visita gana" : "Empate";
            const cls = gl > gv ? "pred-L"     : gv > gl ? "pred-V"      : "pred-E";
            return `<span class="pred-tag ${cls}">${lbl}</span>`;
          })()
        : '<span style="color:var(--text-sub);font-size:.8rem"><i class="bi bi-hourglass-split me-1"></i>Pendiente</span>';

      // Predicción del usuario
      let predHtml;
      if (esExacto && v.goles_local_apostado != null) {
        const gla = v.goles_local_apostado, gva = v.goles_visita_apostado;
        const cls  = gla > gva ? "pred-L" : gva > gla ? "pred-V" : "pred-E";
        let lbl = `${gla} - ${gva}`;
        if (v.predice_penales && v.equipo_penales_pred)
          lbl += ` <span style="font-size:.72rem;opacity:.8">(pens: ${escHtml(v.equipo_penales_pred)})</span>`;
        predHtml = `<span class="pred-tag ${cls}">${lbl}</span>`;
      } else if (v.prediccion) {
        const predLabels = { L: "Local gana", E: "Empate", V: "Visita gana" };
        predHtml = `<span class="pred-tag pred-${v.prediccion}">${predLabels[v.prediccion] ?? v.prediccion}</span>`;
      } else {
        predHtml = '<span style="color:var(--text-sub);font-size:.8rem">—</span>';
      }
      return `<tr>
        <td style="color:#e8eef7">${v.bandera_local ?? ""} ${escHtml(v.equipo_local)} <span style="color:var(--text-sub)">vs</span> ${v.bandera_visita ?? ""} ${escHtml(v.equipo_visita)}</td>
        <td style="color:var(--text-sub);font-size:.8rem;white-space:nowrap">
          ${new Date(v.fecha).toLocaleString("es-CL",{timeZone:"America/Santiago",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
        </td>
        <td>${predHtml}</td>
        <td>${resultado}</td>
        <td style="text-align:center">${ptsHtml}</td>
        <td style="text-align:center;color:var(--text-sub);font-size:.8rem">${v.intentos}/2</td>
        <td style="text-align:center">${!v.finalizado
          ? `<button class="action-btn action-btn-edit" onclick="abrirVotoEditar('${uid}', ${vIdx})" title="Editar voto"><i class="bi bi-pencil-fill"></i></button>`
          : _dentroPlazoEdicion(v.fecha)
          ? `<button class="action-btn action-btn-edit" onclick="abrirVotoEditar('${uid}', ${vIdx})" title="Editar voto (partido finalizado, dentro del plazo de ${VOTO_ADMIN_GRACIA_DIAS} días)"><i class="bi bi-pencil-fill"></i></button>`
          : `<button class="action-btn action-btn-edit" disabled title="No se puede editar: pasaron más de ${VOTO_ADMIN_GRACIA_DIAS} días desde que finalizó" style="opacity:.35;cursor:not-allowed"><i class="bi bi-lock-fill"></i></button>`}</td>
      </tr>`;
    }).join("");

    const collapseId = `votos-u${uid}`;
    const isFirst    = idx === 0;




    return `
      <div class="accordion-item" style="background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:10px;margin-bottom:.6rem;overflow:hidden">
        <h2 class="accordion-header">
          <button class="accordion-button ${isFirst ? "" : "collapsed"}" type="button"
            data-bs-toggle="collapse" data-bs-target="#${collapseId}"
            style="background:var(--card);color:#e8eef7 !important;box-shadow:none;padding:.85rem 1.1rem;gap:.75rem;opacity:1 !important">
            ${u.foto_perfil
              ? `<img src="${u.foto_perfil}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(245,184,0,.4);flex-shrink:0" />`
              : `<span style="width:34px;height:34px;border-radius:50%;background:rgba(245,184,0,.15);border:1px solid rgba(245,184,0,.3);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--gold)"><i class="bi bi-person-fill"></i></span>`}
            <span style="flex:1;min-width:0">
              <strong style="font-size:.95rem">${escHtml(u.nombre)}</strong>
              <span style="color:var(--text-sub);font-size:.8rem;margin-left:.5rem">${escHtml(u.email)}</span>
            </span>
            <span style="display:flex;gap:.4rem;align-items:center;flex-shrink:0">
              <span style="background:rgba(255,255,255,.07);border-radius:6px;padding:.2rem .55rem;font-size:.75rem;color:var(--text-sub)"><i class="bi bi-check2-square me-1"></i>${totalVotos} votos</span>
              ${finalizados > 0 ? `<span class="pts-badge pts-${totalPts >= finalizados * 2 ? "3" : "1"}" style="font-size:.75rem">${totalPts} pts</span>` : ""}
              ${pendientes  > 0 ? `<span style="background:rgba(255,255,255,.07);border-radius:6px;padding:.2rem .55rem;font-size:.75rem;color:var(--text-sub)">${pendientes} pend.</span>` : ""}
            </span>
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${isFirst ? "show" : ""}">
          <div class="accordion-body" style="padding:.75rem 1rem 1rem;background:rgba(0,0,0,.15);color:var(--text)">
            <div style="overflow-x:auto">
              <table class="ranking-table" style="margin:0">
                <thead><tr><th>Partido</th><th>Fecha</th><th>Predicción</th><th>Resultado</th><th style="text-align:center">Pts</th><th style="text-align:center">Intentos</th><th style="text-align:center"></th></tr></thead>
                <tbody>${filas}</tbody>
              </table>
            </div>
            <div style="padding-top:.65rem;text-align:right">
              <button class="btn-fifa-outline" style="font-size:.82rem;padding:.38rem .9rem" onclick="abrirVotoNuevo('${uid}')">
                <i class="bi bi-plus-lg me-1"></i>Agregar voto${sinVotar > 0 ? ` (${sinVotar})` : ""}
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  cont.innerHTML = `<div class="accordion accordion-flush" id="accordion-votos">${items}</div>`;
}

cargarVotos();

// ── Borrar historial de votos ──────────────────────────────────
document.getElementById("btn-reset-apuestas").addEventListener("click", async () => {
  if (!confirm("¿Seguro que quieres borrar TODOS los votos registrados?\nEsta acción no se puede deshacer.")) return;
  const btn = document.getElementById("btn-reset-apuestas");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-wc" style="width:14px;height:14px;border-width:2px"></span> Borrando...';
  try {
    const res  = await fetch(`${API}/admin/apuestas/reset`, { method: "DELETE", headers: headers() });
    const data = await res.json();
    if (res.ok) {
      toast("Historial de votos eliminado", "ok");
      todosVotos = [];
      renderVotos();
    } else {
      toast(data.error || "Error al borrar", "error");
    }
  } catch (_) {
    toast("Error de conexión", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-trash me-1"></i> Borrar historial de votos';
  }
});



// ── Borrar historial del chat ──────────────────────────────────
document.getElementById("btn-borrar-chat").addEventListener("click", async () => {
  if (!confirm("¿Seguro que quieres borrar todo el historial del chat? Esta acción no se puede deshacer.")) return;
  const btn = document.getElementById("btn-borrar-chat");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-wc" style="width:14px;height:14px;border-width:2px"></span> Borrando...';
  try {
    const res = await fetch(`${API}/chat/messages`, { method: "DELETE", headers: headers() });
    const data = await res.json();
    if (res.ok) {
      toast("✅ Historial del chat borrado");
    } else {
      toast(data.error || "Error al borrar", "error");
    }
  } catch (_) {
    toast("Error de conexión", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-trash me-1"></i> Borrar historial del chat';
  }
});

// ── Auditoría de admin ──────────────────────────────────────────
async function cargarAuditoria() {
  const cont = document.getElementById("lista-auditoria");
  try {
    const res  = await fetch(`${API}/admin/auditoria`, { headers: headers() });
    const data = await res.json();
    if (!res.ok) throw new Error();
    if (!data.length) {
      cont.innerHTML = '<div class="empty-state"><span class="empty-icon">🛡️</span><h3>Sin cambios registrados todavía</h3></div>';
      return;
    }
    const accionLabels = {
      editar_voto:      { txt: "Voto editado",          color: "#fbbf24" },
      editar_resultado: { txt: "Resultado modificado",  color: "#f87171" },
      anular_resultado: { txt: "Resultado anulado",     color: "#f87171" },
    };

    // Agrupar por día (America/Santiago); el backend ya ordena por creado_en DESC,
    // así que el orden de inserción de las claves respeta los días más recientes primero.
    const fechaKey = iso => new Date(iso).toLocaleDateString("es-CL", {
      timeZone: "America/Santiago", day: "2-digit", month: "short", year: "numeric",
    });
    const buckets = {};
    data.forEach(a => {
      const key = fechaKey(a.creado_en);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(a);
    });

    const items = Object.keys(buckets).map((key, idx) => {
      const registros  = buckets[key];
      const expanded    = idx === 0;
      const collapseId  = `cauditoria-${idx}`;
      const filas = registros.map(a => {
        const tag = accionLabels[a.accion] || { txt: a.accion, color: "#7a91b3" };
        return `<tr>
          <td style="white-space:nowrap;color:var(--text-sub);font-size:.8rem">
            ${new Date(a.creado_en).toLocaleString("es-CL",{timeZone:"America/Santiago",hour:"2-digit",minute:"2-digit"})}
          </td>
          <td style="white-space:nowrap">${escHtml(a.admin_nombre)}</td>
          <td><span style="color:${tag.color};font-weight:600;font-size:.82rem">${tag.txt}</span></td>
          <td style="color:#c8d4e0;font-size:.85rem">${escHtml(a.detalle)}</td>
        </tr>`;
      }).join("");

      return `
        <div class="accordion-item" style="background:var(--card-bg);border:1px solid rgba(255,255,255,.08)!important;border-radius:10px!important;margin-bottom:.5rem;overflow:hidden">
          <h2 class="accordion-header">
            <button class="accordion-button ${expanded ? "" : "collapsed"}" type="button"
              data-bs-toggle="collapse" data-bs-target="#${collapseId}"
              style="background:var(--card-bg);color:#e8eef7;box-shadow:none;padding:.75rem 1.1rem;gap:.6rem;font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:.5px">
              <i class="bi bi-calendar3" style="color:var(--gold);font-size:.85rem"></i>
              ${key}
              <span style="font-family:system-ui,sans-serif;font-size:.7rem;font-weight:400;color:var(--text-sub);margin-left:.3rem">${registros.length} cambio${registros.length !== 1 ? "s" : ""}</span>
            </button>
          </h2>
          <div id="${collapseId}" class="accordion-collapse collapse ${expanded ? "show" : ""}">
            <div class="accordion-body" style="padding:.6rem;background:rgba(0,0,0,.12)">
              <div style="overflow-x:auto">
                <table class="ranking-table" style="margin:0">
                  <thead><tr><th>Hora</th><th>Admin</th><th>Acción</th><th>Detalle</th></tr></thead>
                  <tbody>${filas}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");

    cont.innerHTML = `<div class="accordion" id="accordion-auditoria">${items}</div>`;
  } catch (_) {
    cont.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Error cargando auditoría</h3></div>';
  }
}

document.getElementById("btn-expand-all-auditoria").addEventListener("click", () => {
  document.querySelectorAll("#accordion-auditoria .accordion-collapse").forEach(el => {
    bootstrap.Collapse.getOrCreateInstance(el).show();
  });
});

document.getElementById("btn-collapse-all-auditoria").addEventListener("click", () => {
  document.querySelectorAll("#accordion-auditoria .accordion-collapse").forEach(el => {
    bootstrap.Collapse.getOrCreateInstance(el).hide();
  });
});

cargarAuditoria();

// Sanitize score inputs: digits only, clamped 0-20
document.addEventListener("input", e => {
  if (!e.target.matches(".exacto-input")) return;
  const raw = e.target.value.replace(/\D/g, "");
  const val = raw === "" ? "" : String(Math.min(20, parseInt(raw, 10)));
  if (e.target.value !== val) e.target.value = val;
});

