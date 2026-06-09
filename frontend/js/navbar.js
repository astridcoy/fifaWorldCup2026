(function injectNavbar() {
  const page    = location.pathname.split("/").pop() || "index.html";
  const isAdmin = page === "admin.html";

  function menuAct(href) {
    if (href === "#chat") return page === "chat.html" ? " nav-dd-active" : "";
    return page === href ? " nav-dd-active" : "";
  }
  function sideAct(href) { return page === href ? " active" : ""; }
  function avatarAct(href) { return page === href ? " nav-dd-active" : ""; }

  const html = `
  <div class="sidebar-overlay" id="sidebar-overlay"></div>
  <div class="sidebar-drawer" id="sidebar-drawer">
    <div class="sidebar-header">
      <div class="sidebar-brand">POLLATOUCH <span>MUNDIAL</span> 2026 <span class="navbar-hosts"><span class="hflag">🇺🇸</span><span class="hflag">🇨🇦</span><span class="hflag">🇲🇽</span></span></div>
      <button class="sidebar-close" id="sidebar-close"><i class="bi bi-x-lg"></i></button>
    </div>
    <nav class="sidebar-nav">
      <a href="index.html"   class="sidebar-link${sideAct("index.html")}"><i class="bi bi-controller"></i> Mis Apuestas</a>
      <a href="ranking.html" class="sidebar-link${sideAct("ranking.html")}"><i class="bi bi-trophy"></i> Ranking</a>
      <a href="#" class="sidebar-link${sideAct("chat.html")}" onclick="event.preventDefault(); if(typeof openChatWidget==='function') openChatWidget()"><i class="bi bi-chat-dots"></i> Chat</a>
      <a href="perfil.html"  class="sidebar-link${sideAct("perfil.html")}"><i class="bi bi-person-circle"></i> Perfil</a>
      <div class="sidebar-divider"></div>
      <a href="admin.html" class="sidebar-link sidebar-link-admin${sideAct("admin.html")}" id="sidebar-admin-link"><i class="bi bi-gear"></i> Panel Admin</a>
    </nav>
    <div class="sidebar-footer">
      <button class="sidebar-logout-btn" id="sidebar-logout"><i class="bi bi-box-arrow-right"></i> Cerrar sesión</button>
    </div>
  </div>

  <nav class="navbar-wc d-flex align-items-center justify-content-between">
    <div class="d-flex align-items-center gap-2">
      <button class="nav-hamburger" id="nav-hamburger"><i class="bi bi-list"></i></button>
      <div class="nav-left-menu" id="nav-left-menu">
        <button class="nav-menu-btn" id="nav-menu-btn"><i class="bi bi-list"></i></button>
        <div class="nav-menu-dropdown" id="nav-menu-dropdown">
          <a href="index.html"   class="nav-dd-item${menuAct("index.html")}"><i class="bi bi-controller"></i> Mis Apuestas</a>
          <a href="ranking.html" class="nav-dd-item${menuAct("ranking.html")}"><i class="bi bi-trophy"></i> Ranking</a>
          <a href="#" class="nav-dd-item${menuAct("#chat")}" id="nav-dd-chat"><i class="bi bi-chat-dots"></i> Chat</a>
        </div>
      </div>
      <a class="navbar-brand-wc" href="${isAdmin ? "admin.html" : "index.html"}">
        <img src="img/fifa2026-logo.png" class="navbar-logo" alt="FIFA 2026" />
        POLLATOUCH <span>MUNDIAL</span> 2026
        <span class="navbar-hosts">
          <span class="hflag" title="USA">🇺🇸</span>
          <span class="hflag" title="Canada">🇨🇦</span>
          <span class="hflag" title="México">🇲🇽</span>
        </span>
        ${isAdmin ? '<span class="badge-admin ms-2">ADMIN</span>' : ""}
      </a>
    </div>
    <div class="nav-avatar-wrap" id="nav-avatar-wrap">
      <button class="nav-avatar-btn" id="nav-avatar-btn">
        <span class="nav-avatar-circle" id="nav-avatar-circle"></span>
      </button>
      <div class="nav-avatar-dropdown" id="nav-avatar-dropdown">
        <div class="nav-avatar-info">
          <span class="nav-avatar-info-initial" id="nav-avatar-info-initial"></span>
          <span class="nav-avatar-fullname" id="nav-avatar-fullname"></span>
        </div>
        <div class="nav-dd-divider"></div>
        <a href="perfil.html" class="nav-dd-item${avatarAct("perfil.html")}"><i class="bi bi-person-circle"></i> Mi Perfil</a>
        <a href="admin.html"  class="nav-dd-item nav-dd-admin${avatarAct("admin.html")}" id="nav-dd-admin" style="display:none"><i class="bi bi-gear"></i> Panel Admin</a>
        <div class="nav-dd-divider"></div>
        <button class="nav-dd-item nav-dd-logout" id="btn-logout"><i class="bi bi-box-arrow-right"></i> Cerrar sesión</button>
      </div>
    </div>
  </nav>`;

  const root = document.getElementById("navbar-root");
  if (root) root.outerHTML = html;
})();
