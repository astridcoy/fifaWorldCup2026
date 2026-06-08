if (ROL !== "admin") window.location.href = "login.html";

function msgOk(id, msg)  { const el = document.getElementById(id); el.className = "msg-ok";  el.innerHTML = `<i class="bi bi-check-circle me-1"></i>${msg}`; }
function msgErr(id, msg) { const el = document.getElementById(id); el.className = "msg-err"; el.innerHTML = `<i class="bi bi-x-circle me-1"></i>${msg}`;     }
function msgClear(id)    { const el = document.getElementById(id); el.className = ""; el.textContent = ""; }

// ── PARTIDOS ──────────────────────────────────────────────────
let partidos = [];

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
    opt.value = p.id;
    opt.textContent = `${p.bandera_local} ${p.equipo_local} vs ${p.bandera_visita} ${p.equipo_visita}`;
    sel.appendChild(opt);
  });
}

function renderListaPartidos() {
  if (!partidos.length) {
    document.getElementById("lista-partidos").innerHTML =
      '<div class="empty-state"><span class="empty-icon">📭</span><h3>No hay partidos todavía</h3></div>';
    return;
  }
  const filas = partidos.map(p => `
    <tr>
      <td>${p.bandera_local} ${escHtml(p.equipo_local)} <span style="color:var(--text-sub)">vs</span> ${p.bandera_visita} ${escHtml(p.equipo_visita)}</td>
      <td>
        <span class="phase-tab active" style="pointer-events:none;padding:.2rem .7rem;font-size:.72rem">${escHtml(p.fase)}</span>
        ${p.grupo ? `<span style="font-size:.72rem;color:var(--text-sub);margin-left:.3rem">${escHtml(p.grupo)}</span>` : ""}
      </td>
      <td style="color:var(--text-sub);font-size:.85rem">${new Date(p.fecha).toLocaleString("es-CL", { timeZone: "America/Santiago" })}</td>
      <td>${p.finalizado
        ? `<strong style="color:var(--gold);font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:1px">${p.goles_local} – ${p.goles_visita}</strong>`
        : '<span style="color:var(--text-sub)"><i class="bi bi-hourglass-split me-1"></i>Pendiente</span>'}</td>
      <td>
        <button class="action-btn action-btn-edit me-1" onclick="abrirEditar(${p.id})" title="Editar partido"><i class="bi bi-pencil-fill"></i></button>
        <button class="action-btn action-btn-delete" onclick="eliminarPartido(${p.id})" title="Eliminar partido"><i class="bi bi-trash-fill"></i></button>
      </td>
    </tr>`).join("");

  document.getElementById("lista-partidos").innerHTML = `
    <div class="ranking-card">
      <div style="overflow-x:auto">
        <table class="ranking-table">
          <thead><tr><th>Partido</th><th>Fase</th><th>Fecha</th><th>Resultado</th><th style="text-align:center">Acciones</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
}

function syncGrupoVisibility(faseId, wrapId) {
  document.getElementById(wrapId).style.display = document.getElementById(faseId).value === "Grupos" ? "" : "none";
}
document.getElementById("fase-partido").addEventListener("change", () => syncGrupoVisibility("fase-partido", "wrap-grupo-crear"));
document.getElementById("edit-fase").addEventListener("change",    () => syncGrupoVisibility("edit-fase",    "wrap-grupo-editar"));
syncGrupoVisibility("fase-partido", "wrap-grupo-crear");

// ── IMAGEN ESTADIO ────────────────────────────────────────────
let estadioCrearBase64  = null;
let estadioEditarBase64 = null;
let estadioEditarCambio = false;

function setupImagenEstadio({ fileInputId, pickBtnId, urlInputId, previewWrapId, previewImgId, clearBtnId, onLoad }) {
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
    reader.onload = e => { previewImg.src = e.target.result; previewWrap.style.display = ""; urlInput.value = ""; onLoad(e.target.result); };
    reader.readAsDataURL(file);
  });
  urlInput.addEventListener("input", () => {
    const url = urlInput.value.trim();
    if (url) { previewImg.src = url; previewWrap.style.display = ""; onLoad(null); }
    else     { previewWrap.style.display = "none"; onLoad(null); }
  });
  clearBtn.addEventListener("click", () => {
    fileInput.value = ""; urlInput.value = ""; previewImg.src = ""; previewWrap.style.display = "none"; onLoad(null);
  });
}

setupImagenEstadio({
  fileInputId:"file-estadio",pickBtnId:"btn-pick-estadio",urlInputId:"url-estadio",
  previewWrapId:"preview-estadio-crear",previewImgId:"img-preview-estadio-crear",clearBtnId:"btn-clear-estadio-crear",
  onLoad: b64 => { estadioCrearBase64 = b64; }
});
setupImagenEstadio({
  fileInputId:"edit-file-estadio",pickBtnId:"btn-edit-pick-estadio",urlInputId:"edit-url-estadio",
  previewWrapId:"preview-estadio-editar",previewImgId:"img-preview-estadio-editar",clearBtnId:"btn-clear-estadio-editar",
  onLoad: b64 => { estadioEditarBase64 = b64; estadioEditarCambio = true; }
});

// ── CREAR ─────────────────────────────────────────────────────
document.getElementById("btn-crear").addEventListener("click", async () => {
  const eqL  = document.getElementById("eq-local").value.trim();
  const eqV  = document.getElementById("eq-visita").value.trim();
  const flL  = document.getElementById("flag-local").value.trim();
  const flV  = document.getElementById("flag-visita").value.trim();
  const fech = document.getElementById("fecha-partido").value;
  const fase = document.getElementById("fase-partido").value;
  const grupo = fase === "Grupos" ? document.getElementById("grupo-partido").value : "";
  if (!eqL || !eqV || !fech) { msgErr("msg-crear", "Completa los campos obligatorios"); return; }
  try {
    const res  = await fetch(`${API}/admin/partido`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({
        equipo_local: eqL, equipo_visita: eqV, bandera_local: flL, bandera_visita: flV, fecha: fech, fase, grupo,
        nombre_estadio: document.getElementById("nombre-estadio").value.trim(),
        imagen_estadio: estadioCrearBase64 || document.getElementById("url-estadio").value.trim() || null
      })
    });
    const data = await res.json();
    if (!res.ok) { msgErr("msg-crear", data.error); return; }
    msgOk("msg-crear", "Partido creado correctamente");
    toast("✅ Partido creado");
    ["eq-local","eq-visita","flag-local","flag-visita","fecha-partido","nombre-estadio","url-estadio"].forEach(id => { document.getElementById(id).value = ""; });
    estadioCrearBase64 = null;
    document.getElementById("preview-estadio-crear").style.display = "none";
    cargarPartidos();
  } catch (_) { msgErr("msg-crear", "Error de conexión"); }
});

// ── EDITAR ────────────────────────────────────────────────────
let modalEditar;
document.addEventListener("DOMContentLoaded", () => {
  modalEditar  = new bootstrap.Modal(document.getElementById("modal-editar"));
  modalUsuario = new bootstrap.Modal(document.getElementById("modal-usuario"));
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
  estadioEditarBase64 = null; estadioEditarCambio = false;
  const prevEdit = document.getElementById("preview-estadio-editar");
  const imgEdit  = document.getElementById("img-preview-estadio-editar");
  document.getElementById("edit-url-estadio").value = "";
  if (p.imagen_estadio) { imgEdit.src = p.imagen_estadio; prevEdit.style.display = ""; }
  else                  { imgEdit.src = ""; prevEdit.style.display = "none"; }
  const finalizado = !!p.finalizado;
  document.getElementById("edit-finalizado").checked        = finalizado;
  document.getElementById("edit-goles-local").value         = p.goles_local  ?? 0;
  document.getElementById("edit-goles-visita").value        = p.goles_visita ?? 0;
  document.getElementById("wrap-resultado-editar").style.display = finalizado ? "" : "none";
  syncGrupoVisibility("edit-fase", "wrap-grupo-editar");
  msgClear("msg-editar");
  modalEditar.show();
}

document.getElementById("edit-finalizado").addEventListener("change", () => {
  document.getElementById("wrap-resultado-editar").style.display = document.getElementById("edit-finalizado").checked ? "" : "none";
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
  if (!eqL || !eqV || !fech) { msgErr("msg-editar", "Completa los campos obligatorios"); return; }
  const finalizado  = document.getElementById("edit-finalizado").checked;
  const golesLocal  = parseInt(document.getElementById("edit-goles-local").value)  || 0;
  const golesVisita = parseInt(document.getElementById("edit-goles-visita").value) || 0;
  const btn = document.getElementById("btn-guardar-editar");
  btn.disabled = true; btn.innerHTML = '<span class="spinner-wc"></span> Guardando...';
  try {
    const res = await fetch(`${API}/admin/partido/${id}`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({
        equipo_local: eqL, equipo_visita: eqV, bandera_local: flL, bandera_visita: flV,
        fecha: fech, fase, grupo, finalizado, goles_local: golesLocal, goles_visita: golesVisita,
        nombre_estadio: document.getElementById("edit-nombre-estadio").value.trim(),
        ...(estadioEditarCambio ? { imagen_estadio: estadioEditarBase64 || document.getElementById("edit-url-estadio").value.trim() || null } : {})
      })
    });
    const data = await res.json();
    if (!res.ok) { msgErr("msg-editar", data.error || `Error ${res.status}`); toast(data.error || `Error ${res.status}`, "error"); return; }
    toast("✅ Partido actualizado");
    modalEditar.hide();
    cargarPartidos();
  } catch (e) { msgErr("msg-editar", "Error de conexión: " + e.message); toast("Error de conexión: " + e.message, "error"); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-floppy me-1"></i> Guardar cambios'; }
});

async function eliminarPartido(id) {
  const p = partidos.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar "${p.equipo_local} vs ${p.equipo_visita}"?\nSe eliminarán también todas las apuestas asociadas. Esta acción no se puede deshacer.`)) return;
  try {
    const res  = await fetch(`${API}/admin/partido/${id}`, { method: "DELETE", headers: headers() });
    const data = await res.json();
    if (!res.ok) { toast(data.error || `Error ${res.status}`, "error"); return; }
    toast("🗑️ Partido eliminado");
    cargarPartidos();
  } catch (e) { toast("Error de conexión: " + e.message, "error"); }
}

// ── RESULTADO ─────────────────────────────────────────────────
document.getElementById("btn-resultado").addEventListener("click", async () => {
  const idPartido = document.getElementById("sel-partido").value;
  const gl = parseInt(document.getElementById("res-local").value);
  const gv = parseInt(document.getElementById("res-visita").value);
  if (!idPartido) { msgErr("msg-resultado", "Selecciona un partido"); return; }
  if (!confirm(`¿Confirmas el resultado ${gl} - ${gv}?\nEsta acción calculará los puntos de todos los usuarios.`)) return;
  try {
    const res  = await fetch(`${API}/admin/resultado/${idPartido}`, { method: "PUT", headers: headers(), body: JSON.stringify({ goles_local: gl, goles_visita: gv }) });
    const data = await res.json();
    if (!res.ok) { msgErr("msg-resultado", data.error); return; }
    msgOk("msg-resultado", "Resultado ingresado y puntos calculados");
    toast("✅ Resultado registrado");
    cargarPartidos();
  } catch (_) { msgErr("msg-resultado", "Error de conexión"); }
});

// ── CAMPEÓN REAL ──────────────────────────────────────────────
document.getElementById("btn-campeon-real").addEventListener("click", async () => {
  const campeon = document.getElementById("campeon-real").value.trim();
  if (!campeon) { msgErr("msg-campeon", "Ingresa el nombre del campeón"); return; }
  if (!confirm(`¿Confirmas que el campeón es "${campeon}"?\nSe asignarán 5 puntos a quienes lo acertaron.`)) return;
  try {
    const res  = await fetch(`${API}/admin/campeon-real`, { method: "PUT", headers: headers(), body: JSON.stringify({ campeon }) });
    const data = await res.json();
    if (!res.ok) { msgErr("msg-campeon", data.error); return; }
    msgOk("msg-campeon", data.mensaje);
    toast("🏆 Campeón registrado");
  } catch (_) { msgErr("msg-campeon", "Error de conexión"); }
});

cargarPartidos();

// ── USUARIOS ──────────────────────────────────────────────────
let modalUsuario;
let usuariosCache = [];

document.getElementById("btn-toggle-usuario-pw").addEventListener("click", () => {
  const inp  = document.getElementById("usuario-password");
  const icon = document.getElementById("icon-toggle-usuario-pw");
  if (inp.type === "password") { inp.type = "text"; icon.className = "bi bi-eye-slash"; }
  else                         { inp.type = "password"; icon.className = "bi bi-eye"; }
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

function renderTablaUsuarios(usuarios) {
  if (!usuarios.length) {
    document.getElementById("lista-usuarios").innerHTML =
      '<div class="empty-state"><span class="empty-icon">👤</span><h3>No hay usuarios registrados</h3></div>';
    return;
  }
  const ME = parseInt(localStorage.getItem("id") || "0");
  const filas = usuarios.map(u => {
    const avatarHtml = u.foto_perfil
      ? `<img src="${u.foto_perfil}" alt="${u.nombre}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)" />`
      : `<span style="width:38px;height:38px;border-radius:50%;background:rgba(245,184,0,.15);border:2px solid rgba(245,184,0,.3);display:inline-flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.1rem"><i class="bi bi-person-fill"></i></span>`;
    const rolBadge = u.rol === "admin"
      ? `<span style="background:rgba(245,184,0,.18);color:var(--gold);border:1px solid rgba(245,184,0,.35);border-radius:4px;padding:.15rem .55rem;font-size:.72rem;font-family:'Bebas Neue',sans-serif;letter-spacing:.5px">ADMIN</span>`
      : `<span style="background:rgba(255,255,255,.07);color:var(--text-sub);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:.15rem .55rem;font-size:.72rem">usuario</span>`;
    const esSelf = u.id === ME ? `<span style="font-size:.7rem;color:var(--text-sub);margin-left:.4rem">(tú)</span>` : "";
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
  }).join("");
  document.getElementById("lista-usuarios").innerHTML = `
    <div class="ranking-card"><div style="overflow-x:auto">
      <table class="ranking-table">
        <thead><tr><th></th><th>Nombre</th><th>Email</th><th>Rol</th><th style="text-align:center">Acciones</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div></div>`;
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
  if (!nombre || !email)         { msgErr("msg-usuario", "Nombre y email son obligatorios"); return; }
  if (esNuevo && !password)      { msgErr("msg-usuario", "La contraseña es obligatoria");   return; }
  const body = { nombre, email, rol };
  if (password) body.password = password;
  const btn = document.getElementById("btn-guardar-usuario");
  btn.disabled = true; btn.innerHTML = '<span class="spinner-wc"></span> Guardando...';
  try {
    const res  = await fetch(
      esNuevo ? `${API}/admin/usuario` : `${API}/admin/usuario/${id}`,
      { method: esNuevo ? "POST" : "PUT", headers: headers(), body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok) { msgErr("msg-usuario", data.error); return; }
    toast(esNuevo ? "✅ Usuario creado" : "✅ Usuario actualizado");
    modalUsuario.hide();
    cargarUsuarios();
  } catch (_) { msgErr("msg-usuario", "Error de conexión"); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-floppy me-1"></i> Guardar'; }
});

async function eliminarUsuario(id) {
  const u = usuariosCache.find(x => x.id === id);
  const nombre = u ? u.nombre : `#${id}`;
  if (!confirm(`¿Eliminar al usuario "${nombre}"?\nSe eliminarán también todas sus apuestas. Esta acción no se puede deshacer.`)) return;
  try {
    const res  = await fetch(`${API}/admin/usuario/${id}`, { method: "DELETE", headers: headers() });
    const data = await res.json();
    if (!res.ok) { toast(data.error || `Error ${res.status}`, "error"); return; }
    toast("🗑️ Usuario eliminado");
    cargarUsuarios();
  } catch (_) { toast("Error de conexión", "error"); }
}

cargarUsuarios();

// ── VOTOS ─────────────────────────────────────────────────────
let todosVotos = [];

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
    if (!porUsuario[v.id_usuario]) porUsuario[v.id_usuario] = { nombre: v.nombre, email: v.email, foto_perfil: v.foto_perfil, votos: [] };
    porUsuario[v.id_usuario].votos.push(v);
  });
  const items = Object.entries(porUsuario).map(([uid, u], idx) => {
    const totalVotos  = u.votos.length;
    const totalPts    = u.votos.reduce((s, v) => s + (v.puntos ?? 0), 0);
    const finalizados = u.votos.filter(v => v.finalizado).length;
    const pendientes  = totalVotos - finalizados;
    const filas = u.votos.map(v => {
      const pts = v.puntos ?? 0;
      const ptsHtml = v.finalizado
        ? `<span class="pts-badge ${pts===3?'pts-3':pts===1?'pts-1':'pts-0'}">${pts} pts</span>`
        : '<span style="color:var(--text-sub);font-size:.8rem">—</span>';
      const resultado = v.finalizado
        ? `<strong style="color:var(--gold);font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:1px">${v.resultado_local} – ${v.resultado_visita}</strong>`
        : '<span style="color:var(--text-sub);font-size:.8rem"><i class="bi bi-hourglass-split me-1"></i>Pendiente</span>';
      return `<tr>
        <td style="color:#e8eef7">${v.bandera_local ?? ''} ${escHtml(v.equipo_local)} <span style="color:var(--text-sub)">vs</span> ${v.bandera_visita ?? ''} ${escHtml(v.equipo_visita)}</td>
        <td style="color:var(--text-sub);font-size:.8rem;white-space:nowrap">
          ${new Date(v.fecha).toLocaleString("es-CL",{timeZone:"America/Santiago",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
        </td>
        <td><strong style="color:var(--text);font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:1px">${v.goles_local_apostado} – ${v.goles_visita_apostado}</strong></td>
        <td>${resultado}</td>
        <td style="text-align:center">${ptsHtml}</td>
        <td style="text-align:center;color:var(--text-sub);font-size:.8rem">${v.intentos}/2</td>
      </tr>`;
    }).join("");
    const collapseId = `votos-u${uid}`;
    const isFirst    = idx === 0;
    return `
      <div class="accordion-item" style="background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:10px;margin-bottom:.6rem;overflow:hidden">
        <h2 class="accordion-header">
          <button class="accordion-button ${isFirst?'':'collapsed'}" type="button"
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
              ${finalizados > 0 ? `<span class="pts-badge pts-${totalPts>=finalizados*2?'3':'1'}" style="font-size:.75rem">${totalPts} pts</span>` : ''}
              ${pendientes  > 0 ? `<span style="background:rgba(255,255,255,.07);border-radius:6px;padding:.2rem .55rem;font-size:.75rem;color:var(--text-sub)">${pendientes} pend.</span>` : ''}
            </span>
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${isFirst?'show':''}">
          <div class="accordion-body" style="padding:.75rem 1rem 1rem;background:rgba(0,0,0,.15);color:var(--text)">
            <div style="overflow-x:auto">
              <table class="ranking-table" style="margin:0">
                <thead><tr><th>Partido</th><th>Fecha</th><th>Apuesta</th><th>Resultado</th><th style="text-align:center">Puntos</th><th style="text-align:center">Intentos</th></tr></thead>
                <tbody>${filas}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");
  cont.innerHTML = `<div class="accordion accordion-flush" id="accordion-votos">${items}</div>`;
}

cargarVotos();
