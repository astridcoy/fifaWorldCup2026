const TOKEN  = localStorage.getItem("token");
const ROL    = localStorage.getItem("rol") || "usuario";
const YO_ID  = parseInt(localStorage.getItem("id") || "0");
const NOMBRE = localStorage.getItem("nombre") || "";

if (!TOKEN) { location.replace("login.html"); }
else { document.documentElement.style.display = ""; }

function headers() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` };
}

function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function animateCount(el, target, duration = 700) {
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function toast(msg, tipo = "success") {
  const t = document.createElement("div");
  t.className = `toast-wc toast-${tipo}`;
  t.textContent = msg;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

document.getElementById("btn-logout").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});

(function initNavMenus() {
  const initial = (NOMBRE || "?")[0].toUpperCase();

  // ── Left nav menu ──
  const menuWrap = document.getElementById("nav-left-menu");
  const menuBtn  = document.getElementById("nav-menu-btn");
  const menuDrop = document.getElementById("nav-menu-dropdown");
  const chatLink = document.getElementById("nav-dd-chat");

  if (menuBtn && menuDrop) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menuDrop.classList.toggle("open");
      menuBtn.classList.toggle("active", open);
      closeAvatarDrop();
    });
  }
  if (chatLink) chatLink.addEventListener("click", (e) => {
    e.preventDefault();
    menuDrop?.classList.remove("open");
    menuBtn?.classList.remove("active");
    if (typeof openChatWidget === "function") openChatWidget();
  });

  // ── Right avatar ──
  const avatarWrap = document.getElementById("nav-avatar-wrap");
  const avatarBtn  = document.getElementById("nav-avatar-btn");
  const avatarDrop = document.getElementById("nav-avatar-dropdown");
  const circleEl   = document.getElementById("nav-avatar-circle");
  const infoInitEl = document.getElementById("nav-avatar-info-initial");
  const fullnameEl = document.getElementById("nav-avatar-fullname");
  const adminLink  = document.getElementById("nav-dd-admin");

  if (circleEl)   circleEl.textContent   = initial;
  if (infoInitEl) infoInitEl.textContent = initial;
  if (fullnameEl) fullnameEl.textContent = NOMBRE || "Usuario";
  if (adminLink && ROL === "admin") adminLink.style.display = "flex";

  if (avatarBtn && avatarDrop) {
    avatarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = avatarDrop.classList.toggle("open");
      avatarBtn.classList.toggle("active", open);
      closeMenuDrop();
    });
  }

  function closeMenuDrop()   { menuDrop?.classList.remove("open");   menuBtn?.classList.remove("active"); }
  function closeAvatarDrop() { avatarDrop?.classList.remove("open"); avatarBtn?.classList.remove("active"); }

  document.addEventListener("click", (e) => {
    if (!menuWrap?.contains(e.target))   closeMenuDrop();
    if (!avatarWrap?.contains(e.target)) closeAvatarDrop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeMenuDrop(); closeAvatarDrop(); }
  });

  // Carga foto de perfil en el avatar
  (async () => {
    try {
      const res = await fetch(`${API}/perfil`, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.foto_perfil) return;
      const imgHtml = `<img src="${data.foto_perfil}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="avatar" />`;
      if (circleEl)   circleEl.innerHTML   = imgHtml;
      if (infoInitEl) infoInitEl.innerHTML = imgHtml;
    } catch (_) {}
  })();
})();

(function initSidebar() {
  const hamburger = document.getElementById("nav-hamburger");
  const drawer    = document.getElementById("sidebar-drawer");
  const overlay   = document.getElementById("sidebar-overlay");
  const closeBtn  = document.getElementById("sidebar-close");
  const logoutBtn = document.getElementById("sidebar-logout");
  const adminLink = document.getElementById("sidebar-admin-link");
  if (adminLink && ROL === "admin") adminLink.style.display = "flex";
  function open()  { drawer.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow = "hidden"; }
  function close() { drawer.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow = ""; }
  hamburger.addEventListener("click", open);
  overlay.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  logoutBtn.addEventListener("click", () => { localStorage.clear(); window.location.href = "login.html"; });
})();
