let fotoBase64        = null;
let pendingDeleteFoto = false;

const inputFoto  = document.getElementById("input-foto");
const avatarImg  = document.getElementById("avatar-img");
const avatarDef  = document.getElementById("avatar-default");
const btnDelFoto = document.getElementById("btn-delete-foto");

// ── Mood emojis ───────────────────────────────────────────────
const MOODS = ["😊","😂","😍","🤔","😴","🤩","😅","🥳","😤","😢","🔥","⚽","🏆","💪","🤞","😎","🙏","😡","🥺","😇"];
const moodGrid = document.getElementById("mood-grid");
MOODS.forEach(em => {
  const btn = document.createElement("button");
  btn.type      = "button";
  btn.className = "mood-btn";
  btn.textContent = em;
  btn.addEventListener("click", () => {
    const cur = document.getElementById("p-estado-animo").value;
    if (cur === em) {
      document.getElementById("p-estado-animo").value = "";
      btn.classList.remove("active");
    } else {
      document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
      document.getElementById("p-estado-animo").value = em;
      btn.classList.add("active");
    }
  });
  moodGrid.appendChild(btn);
});

function setMood(em) {
  document.getElementById("p-estado-animo").value = em || "";
  document.querySelectorAll(".mood-btn").forEach(b => {
    b.classList.toggle("active", b.textContent === em);
  });
}

// ── Counters ──────────────────────────────────────────────────
document.getElementById("p-estado").addEventListener("input", function () {
  document.getElementById("estado-counter").textContent = `${this.value.length} / 150`;
});
document.getElementById("p-biografia").addEventListener("input", function () {
  document.getElementById("bio-counter").textContent = `${this.value.length} / 500`;
});

// ── Song embed ────────────────────────────────────────────────
function getSongEmbed(url) {
  if (!url || !url.trim()) return null;
  const u = url.trim();
  const sp = u.match(/open\.spotify\.com(?:\/intl-[^/]+)?\/track\/([A-Za-z0-9]+)/);
  if (sp) return { src: `https://open.spotify.com/embed/track/${sp[1]}?utm_source=generator`, h: 80 };
  const yt = u.match(/(?:youtube\.com\/watch[?&]v=|music\.youtube\.com\/watch[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}`, h: 200 };
  return null;
}

function renderSongPreview(url) {
  const wrap = document.getElementById("cancion-preview");
  const emb  = getSongEmbed(url);
  if (!emb) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = `<iframe class="cancion-embed" src="${emb.src}" height="${emb.h}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}

document.getElementById("p-cancion-url").addEventListener("input", function () {
  renderSongPreview(this.value);
});

// ── Photo ─────────────────────────────────────────────────────
function mostrarFoto(src) {
  avatarImg.src = src;
  avatarImg.classList.remove("d-none");
  avatarDef.classList.add("d-none");
  btnDelFoto.classList.remove("d-none");
}

function ocultarFoto() {
  avatarImg.src = "";
  avatarImg.classList.add("d-none");
  avatarDef.classList.remove("d-none");
  btnDelFoto.classList.add("d-none");
}

document.getElementById("btn-foto").addEventListener("click", () => inputFoto.click());

inputFoto.addEventListener("change", () => {
  const file = inputFoto.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast("La imagen no debe superar 10 MB", "error"); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); toast("Imagen inválida", "error"); };
  img.onload = () => {
    URL.revokeObjectURL(url);
    const MAX = 300;
    let { width: w, height: h } = img;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else        { w = Math.round(w * MAX / h); h = MAX; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    fotoBase64 = canvas.toDataURL("image/jpeg", 0.75);
    pendingDeleteFoto = false;
    mostrarFoto(fotoBase64);
  };
  img.src = url;
});

btnDelFoto.addEventListener("click", () => {
  fotoBase64 = null; pendingDeleteFoto = true; ocultarFoto(); inputFoto.value = "";
});

// ── Password toggle & strength ────────────────────────────────
document.getElementById("toggle-pw").addEventListener("click", () => {
  const inp  = document.getElementById("p-password");
  const icon = document.getElementById("eye-icon");
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
});

function medirFuerza(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[a-z]/.test(pw))        score++;
  if (/\d/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["", "Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"];
  const colors = ["transparent", "#E8192C", "#ff6b35", "#F5B800", "#00843D", "#00843D"];
  return { score, label: labels[score], color: colors[score] };
}

document.getElementById("p-password").addEventListener("input", function () {
  const { score, label, color } = medirFuerza(this.value);
  const bar = document.getElementById("pw-bar");
  bar.style.width      = this.value ? `${score * 20}%` : "0";
  bar.style.background = color;
  document.getElementById("pw-label").textContent = label;
  document.getElementById("pw-label").style.color = color;
});

// ── Validation ────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validarEmail(val)    { return EMAIL_RE.test(val); }
function validarPassword(val) { return val.length >= 8 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /\d/.test(val); }

function setValidez(id, ok) {
  const el = document.getElementById(id);
  el.classList.toggle("is-valid",   ok);
  el.classList.toggle("is-invalid", !ok);
}
function clearValidez(...ids) { ids.forEach(id => { const el = document.getElementById(id); el.classList.remove("is-valid", "is-invalid"); }); }

document.getElementById("p-nombre").addEventListener("input", function () {
  setValidez("p-nombre", this.value.trim().length >= 2 && this.value.trim().length <= 80);
});
document.getElementById("p-email").addEventListener("input", function () {
  setValidez("p-email", validarEmail(this.value.trim()));
});
document.getElementById("p-confirmar").addEventListener("input", function () {
  const pw = document.getElementById("p-password").value;
  if (this.value || pw) setValidez("p-confirmar", this.value === pw);
});

// ── Load profile ──────────────────────────────────────────────
async function cargarPerfil() {
  try {
    const res  = await fetch(`${API}/perfil`, { headers: headers() });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Error al cargar perfil", "error"); return; }
    document.getElementById("p-nombre").value = data.nombre || "";
    document.getElementById("p-email").value  = data.email  || "";
    if (data.foto_perfil) mostrarFoto(data.foto_perfil);
    if (data.estado) {
      document.getElementById("p-estado").value = data.estado;
      document.getElementById("estado-counter").textContent = `${data.estado.length} / 150`;
    }
    if (data.biografia) {
      document.getElementById("p-biografia").value = data.biografia;
      document.getElementById("bio-counter").textContent = `${data.biografia.length} / 500`;
    }
    if (data.cancion_url) {
      document.getElementById("p-cancion-url").value = data.cancion_url;
      renderSongPreview(data.cancion_url);
    }
    setMood(data.estado_animo || "");
  } catch (_) { toast("Error de conexión", "error"); }
}

// ── Save profile ──────────────────────────────────────────────
document.getElementById("btn-guardar").addEventListener("click", async () => {
  const nombre    = document.getElementById("p-nombre").value.trim();
  const email     = document.getElementById("p-email").value.trim();
  const password  = document.getElementById("p-password").value;
  const confirmar = document.getElementById("p-confirmar").value;

  clearValidez("p-nombre", "p-email", "p-password", "p-confirmar");
  let ok = true;

  if (!nombre || nombre.length < 2 || nombre.length > 80) { setValidez("p-nombre", false); ok = false; }
  if (!validarEmail(email))                                { setValidez("p-email",  false); ok = false; }
  if (password) {
    if (!validarPassword(password)) {
      document.getElementById("pw-group").classList.add("is-invalid");
      setValidez("p-password", false); ok = false;
    } else {
      document.getElementById("pw-group").classList.remove("is-invalid");
    }
    if (password !== confirmar) { setValidez("p-confirmar", false); ok = false; }
  } else {
    document.getElementById("pw-group").classList.remove("is-invalid");
  }

  if (!ok) return;

  const body = {
    nombre,
    email,
    estado:        document.getElementById("p-estado").value.trim(),
    biografia:     document.getElementById("p-biografia").value.trim(),
    cancion_url:   document.getElementById("p-cancion-url").value.trim(),
    estado_animo:  document.getElementById("p-estado-animo").value,
  };
  if (password)           body.password    = password;
  if (fotoBase64)         body.foto_perfil = fotoBase64;
  else if (pendingDeleteFoto) body.foto_perfil = null;

  const btn = document.getElementById("btn-guardar");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-wc"></span> Guardando...';

  try {
    const res  = await fetch(`${API}/perfil`, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Error al guardar", "error"); return; }
    toast("✅ Perfil actualizado");
    localStorage.setItem("nombre", nombre);
    document.getElementById("p-password").value  = "";
    document.getElementById("p-confirmar").value = "";
    document.getElementById("pw-bar").style.width   = "0";
    document.getElementById("pw-label").textContent = "";
    fotoBase64 = null; pendingDeleteFoto = false;
    clearValidez("p-nombre", "p-email", "p-password", "p-confirmar");
  } catch (_) { toast("Error de conexión", "error"); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-floppy me-1"></i> Guardar cambios';
  }
});

cargarPerfil();
