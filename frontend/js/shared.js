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
