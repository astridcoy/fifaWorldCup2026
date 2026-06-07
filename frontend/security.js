/**
 * security.js — CIA Triad implementation
 * Confidencialidad · Integridad · Disponibilidad
 */
(function() {
  "use strict";

  // ─────────────────────────────────────────────
  // CONFIDENCIALIDAD
  // ─────────────────────────────────────────────

  const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutos
  let _inactivityTimer;

  function resetInactivityTimer() {
    clearTimeout(_inactivityTimer);
    _inactivityTimer = setTimeout(forceLogout, INACTIVITY_LIMIT);
  }

  function forceLogout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "login.html?expired=1";
  }

  ["click","keydown","mousemove","touchstart","scroll"].forEach(ev =>
    document.addEventListener(ev, resetInactivityTimer, { passive: true })
  );
  resetInactivityTimer();

  // Validar expiración del JWT en cada carga
  function checkTokenExpiry() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        forceLogout();
      }
    } catch (_) {}
  }
  checkTokenExpiry();

  // Añadir indicador visual de sesión activa en la navbar
  function addSessionIndicator() {
    const navbar = document.querySelector(".navbar-wc");
    if (!navbar) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const minLeft = payload.exp ? Math.max(0, Math.floor((payload.exp - Date.now()/1000) / 60)) : null;
      const ind = document.createElement("span");
      ind.className = "session-indicator d-none d-md-inline-flex" + (minLeft !== null && minLeft < 30 ? " warn" : "");
      ind.innerHTML = `<i class="bi bi-shield-lock-fill"></i> Sesión segura`;
      ind.title = minLeft !== null ? `Token válido por ~${minLeft} min` : "Sesión activa";
      navbar.querySelector(".d-flex.align-items-center.gap-2:last-child")?.prepend(ind);
    } catch (_) {}
  }
  document.addEventListener("DOMContentLoaded", addSessionIndicator);

  // ─────────────────────────────────────────────
  // INTEGRIDAD
  // ─────────────────────────────────────────────

  // Sanitiza strings para evitar XSS al usar innerHTML
  window.sanitize = function(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  };

  // Valida que un token JWT tenga formato correcto antes de usarlo
  window.isValidJWT = function(token) {
    if (!token || typeof token !== "string") return false;
    const parts = token.split(".");
    return parts.length === 3 && parts.every(p => p.length > 0);
  };

  // Refuerza el token: si no es válido lo limpia
  (function enforceTokenIntegrity() {
    const token = localStorage.getItem("token");
    if (token && !window.isValidJWT(token)) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
    }
  })();

  // ─────────────────────────────────────────────
  // DISPONIBILIDAD
  // ─────────────────────────────────────────────

  // Banner offline / reconexión
  function createOfflineBanner() {
    if (document.getElementById("offline-banner")) return;
    const banner = document.createElement("div");
    banner.id = "offline-banner";
    banner.innerHTML = '<i class="bi bi-wifi-off"></i> Sin conexión — algunas funciones pueden no estar disponibles';
    document.body.prepend(banner);
  }

  function handleOnline()  { document.getElementById("offline-banner")?.classList.remove("show"); }
  function handleOffline() {
    createOfflineBanner();
    document.getElementById("offline-banner").classList.add("show");
  }

  window.addEventListener("online",  handleOnline);
  window.addEventListener("offline", handleOffline);
  if (!navigator.onLine) {
    document.addEventListener("DOMContentLoaded", handleOffline);
  }

  // fetch con retry automático (backoff exponencial): 3 intentos, delays 1s/2s/4s
  const _origFetch = window.fetch;
  window.fetch = async function(url, opts) {
    const MAX = 3;
    let delay = 1000;
    for (let i = 0; i < MAX; i++) {
      try {
        const res = await _origFetch(url, opts);
        return res;
      } catch (err) {
        if (i === MAX - 1 || (opts && opts.method && opts.method !== "GET")) throw err;
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
  };

})();
