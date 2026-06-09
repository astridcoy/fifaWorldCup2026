(function () {
  const API        = "https://polla-api-production.up.railway.app";
  const ME_ID      = parseInt(localStorage.getItem("id") || "0");
  const ME_ROL     = localStorage.getItem("rol") || "";
  const TZ         = "America/Santiago";

  let lastId     = 0;
  let isOpen     = false;
  let pollTimer  = null;
  let isAtBottom = true;

  // ── Inject styles ────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    .cw-fab {
      position:fixed; bottom:1.5rem; left:1.5rem;
      width:42px; height:42px; border-radius:50%;
      background:var(--gold); border:none; cursor:pointer;
      display:none; align-items:center; justify-content:center;
      color:var(--navy); font-size:1.15rem;
      box-shadow:0 4px 16px rgba(245,184,0,.4);
      z-index:600; transition:background .2s, transform .15s;
    }
    @media (min-width:576px) {
      .cw-fab { display:flex; }
    }
    .cw-fab:hover { background:var(--gold-dark); transform:translateY(-2px); }
    .cw-fab:active { transform:scale(.92); }
    .cw-fab .cw-badge {
      position:absolute; top:-4px; right:-4px;
      background:#e74c3c; color:#fff; border-radius:50%;
      font-size:.6rem; font-weight:700; min-width:16px; height:16px;
      display:flex; align-items:center; justify-content:center;
      padding:0 3px; display:none;
    }

    .cw-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.45);
      z-index:610; opacity:0; pointer-events:none;
      transition:opacity .25s;
    }
    .cw-overlay.open { opacity:1; pointer-events:all; }

    .cw-panel {
      position:fixed; z-index:620;
      bottom:0; left:0; right:0;
      height:70dvh; max-height:600px;
      background:var(--card-bg,#0d1b2a);
      border-radius:16px 16px 0 0;
      border:1px solid rgba(255,255,255,.08);
      display:flex; flex-direction:column;
      transform:translateY(100%); opacity:0; pointer-events:none;
      transition:transform .28s cubic-bezier(.4,0,.2,1), opacity .28s;
      box-shadow:0 -8px 40px rgba(0,0,0,.5);
    }
    @media (min-width:576px) {
      .cw-panel {
        bottom:80px; left:1.5rem; right:auto;
        width:360px; border-radius:14px;
        height:500px;
      }
    }
    .cw-panel.open { transform:translateY(0); opacity:1; pointer-events:all; }

    .cw-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:.75rem 1rem; border-bottom:1px solid rgba(255,255,255,.08);
      flex-shrink:0;
    }
    .cw-header-title {
      font-family:'Bebas Neue',sans-serif; font-size:1.1rem;
      letter-spacing:.5px; color:#e8eef7;
      display:flex; align-items:center; gap:.5rem;
    }
    .cw-header-title i { color:var(--gold); }
    .cw-close-btn {
      background:none; border:none; color:var(--text-sub,#8899aa);
      font-size:1.1rem; cursor:pointer; padding:.2rem .4rem;
      border-radius:6px; transition:color .15s, background .15s;
      line-height:1;
    }
    .cw-close-btn:hover { color:#e8eef7; background:rgba(255,255,255,.08); }

    .cw-messages {
      flex:1; overflow-y:auto; display:flex; flex-direction:column;
      gap:.45rem; padding:.6rem .75rem;
      scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.1) transparent;
    }
    .cw-messages::-webkit-scrollbar { width:3px; }
    .cw-messages::-webkit-scrollbar-thumb { background:rgba(255,255,255,.12); border-radius:2px; }

    .cw-msg { display:flex; gap:.5rem; align-items:flex-end; max-width:88%; }
    .cw-msg.own { align-self:flex-end; flex-direction:row-reverse; }
    .cw-avatar {
      width:28px; height:28px; border-radius:50%; object-fit:cover;
      flex-shrink:0; border:1px solid rgba(255,255,255,.1);
    }
    .cw-avatar-initials {
      width:28px; height:28px; border-radius:50%; flex-shrink:0;
      background:rgba(245,184,0,.15); border:1px solid rgba(245,184,0,.3);
      display:flex; align-items:center; justify-content:center;
      font-size:.65rem; font-weight:700; color:var(--gold);
    }
    .cw-bubble-wrap { display:flex; flex-direction:column; gap:.1rem; min-width:0; }
    .cw-meta {
      font-size:.65rem; color:var(--text-sub,#8899aa);
      display:flex; align-items:center; gap:.3rem;
    }
    .cw-msg.own .cw-meta { justify-content:flex-end; }
    .cw-meta .name { font-weight:600; color:var(--gold); }
    .cw-bubble {
      background:var(--card-bg,#0d1b2a); border:1px solid rgba(255,255,255,.08);
      border-radius:0 10px 10px 10px; padding:.4rem .65rem;
      font-size:.82rem; color:#e8eef7; line-height:1.4;
      word-break:break-word; position:relative;
    }
    .cw-msg.own .cw-bubble {
      background:rgba(245,184,0,.1); border-color:rgba(245,184,0,.2);
      border-radius:10px 0 10px 10px;
    }
    .cw-del-btn {
      position:absolute; top:2px; right:4px;
      background:none; border:none; color:rgba(255,255,255,.2);
      font-size:.6rem; padding:0; cursor:pointer;
      opacity:0; transition:opacity .15s;
    }
    .cw-bubble:hover .cw-del-btn { opacity:1; }
    .cw-del-btn:hover { color:#e74c3c; }

    .cw-empty {
      flex:1; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      color:var(--text-sub,#8899aa); gap:.4rem; font-size:.83rem;
    }
    .cw-empty i { font-size:2rem; opacity:.3; }

    .cw-input-row {
      display:flex; gap:.4rem; padding:.6rem .75rem .5rem;
      border-top:1px solid rgba(255,255,255,.08); flex-shrink:0;
    }
    .cw-input {
      flex:1; background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.1); border-radius:20px;
      color:#e8eef7; font-size:.85rem; padding:.45rem .9rem;
      outline:none; resize:none; max-height:72px;
      transition:border-color .2s;
    }
    .cw-input:focus { border-color:rgba(245,184,0,.5); }
    .cw-input::placeholder { color:var(--text-sub,#8899aa); }
    .cw-send-btn {
      background:var(--gold); border:none; border-radius:50%;
      width:36px; height:36px; flex-shrink:0; align-self:flex-end;
      color:var(--navy,#0a1628); font-size:.9rem; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transition:opacity .15s, transform .1s;
    }
    .cw-send-btn:hover { opacity:.85; }
    .cw-send-btn:active { transform:scale(.9); }
    .cw-send-btn:disabled { opacity:.4; cursor:not-allowed; }
    .cw-counter {
      font-size:.65rem; color:var(--text-sub,#8899aa);
      text-align:right; padding:0 .75rem .4rem; flex-shrink:0;
    }
    .cw-counter.warn { color:#e67e22; }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ──────────────────────────────────────────────
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button class="cw-fab" id="cw-fab" title="Chat del Mundial">
      <i class="bi bi-chat-dots-fill"></i>
      <span class="cw-badge" id="cw-badge"></span>
    </button>
    <div class="cw-overlay" id="cw-overlay"></div>
    <div class="cw-panel" id="cw-panel">
      <div class="cw-header">
        <span class="cw-header-title"><i class="bi bi-chat-dots-fill"></i> Chat del Mundial</span>
        <button class="cw-close-btn" id="cw-close"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="cw-messages" id="cw-messages">
        <div class="cw-empty" id="cw-empty">
          <i class="bi bi-chat-square-dots"></i>
          <span>Cargando...</span>
        </div>
      </div>
      <div class="cw-input-row">
        <textarea class="cw-input" id="cw-input" placeholder="Escribe un mensaje..." rows="1" maxlength="300"></textarea>
        <button class="cw-send-btn" id="cw-send"><i class="bi bi-send-fill"></i></button>
      </div>
      <div class="cw-counter" id="cw-counter">0 / 300</div>
    </div>`;
  document.body.appendChild(wrap);

  // ── Helpers ──────────────────────────────────────────────────
  function avatarEl(nombre, foto) {
    if (foto) {
      const img = document.createElement("img");
      img.className = "cw-avatar";
      img.src = foto;
      img.alt = nombre;
      return img.outerHTML;
    }
    const initials = nombre.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    return `<div class="cw-avatar-initials">${initials}</div>`;
  }

  function fmtTime(iso) {
    const d      = new Date(iso);
    const now    = new Date();
    const dDay   = d.toLocaleDateString("es-CL",  { timeZone: TZ });
    const nowDay = now.toLocaleDateString("es-CL", { timeZone: TZ });
    if (dDay === nowDay) {
      return d.toLocaleTimeString("es-CL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleString("es-CL", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function buildMsg(msg) {
    const isOwn  = msg.id_usuario === ME_ID;
    const canDel = isOwn || ME_ROL === "admin";
    const div    = document.createElement("div");
    div.className = `cw-msg${isOwn ? " own" : ""}`;
    div.dataset.id = msg.id;
    div.innerHTML = `
      ${avatarEl(msg.nombre, msg.foto_perfil)}
      <div class="cw-bubble-wrap">
        <div class="cw-meta">
          ${isOwn ? "" : `<span class="name">${escHtml(msg.nombre)}</span>`}
          <span>${fmtTime(msg.created_at)}</span>
        </div>
        <div class="cw-bubble">
          ${escHtml(msg.mensaje)}
          ${canDel ? `<button class="cw-del-btn" data-del="${msg.id}" title="Eliminar"><i class="bi bi-x-lg"></i></button>` : ""}
        </div>
      </div>`;
    return div;
  }

  function appendMessages(msgs) {
    const cont  = document.getElementById("cw-messages");
    const empty = document.getElementById("cw-empty");
    if (empty) empty.remove();
    msgs.forEach(msg => {
      cont.appendChild(buildMsg(msg));
      lastId = Math.max(lastId, msg.id);
    });
    if (isAtBottom) cont.scrollTop = cont.scrollHeight;
  }

  // ── Polling ──────────────────────────────────────────────────
  async function poll() {
    if (!isOpen) return;
    try {
      const res  = await fetch(`${API}/chat/messages?since=${lastId}`, { headers: headers() });
      if (res.ok) {
        const msgs = await res.json();
        if (msgs.length) appendMessages(msgs);
      }
    } catch (_) {}
    finally {
      if (isOpen) pollTimer = setTimeout(poll, 4000);
    }
  }

  // ── Send ─────────────────────────────────────────────────────
  async function send() {
    const input = document.getElementById("cw-input");
    const btn   = document.getElementById("cw-send");
    const texto = input.value.trim();
    if (!texto) return;
    btn.disabled = true;
    try {
      const res = await fetch(`${API}/chat/messages`, {
        method:  "POST",
        headers: headers(),
        body:    JSON.stringify({ mensaje: texto }),
      });
      if (res.ok) {
        input.value = "";
        input.style.height = "";
        document.getElementById("cw-counter").textContent = "0 / 300";
        document.getElementById("cw-counter").className   = "cw-counter";
        isAtBottom = true;
        clearTimeout(pollTimer);
        poll();
      } else {
        const d = await res.json();
        toast(d.error || "Error al enviar", "error");
      }
    } catch (_) {
      toast("Error de conexión", "error");
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  // ── Delete ───────────────────────────────────────────────────
  document.getElementById("cw-messages").addEventListener("click", async e => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    const id = btn.dataset.del;
    try {
      const res = await fetch(`${API}/chat/messages/${id}`, { method: "DELETE", headers: headers() });
      if (res.ok) {
        document.querySelector(`.cw-msg[data-id="${id}"]`)?.remove();
        const cont = document.getElementById("cw-messages");
        if (!cont.querySelector(".cw-msg")) {
          cont.innerHTML = '<div class="cw-empty"><i class="bi bi-chat-square-dots"></i><span>No hay mensajes aún.</span></div>';
        }
      }
    } catch (_) {}
  });

  // ── Open / Close ─────────────────────────────────────────────
  function openChat() {
    document.getElementById("sidebar-drawer")?.classList.remove("open");
    document.getElementById("sidebar-overlay")?.classList.remove("open");
    isOpen = true;
    document.getElementById("cw-panel").classList.add("open");
    document.getElementById("cw-overlay").classList.add("open");
    document.body.style.overflow = "hidden";
    clearTimeout(pollTimer);
    poll();
    setTimeout(() => {
      const cont = document.getElementById("cw-messages");
      cont.scrollTop = cont.scrollHeight;
      document.getElementById("cw-input").focus();
    }, 280);
  }

  function closeChat() {
    isOpen = false;
    clearTimeout(pollTimer);
    document.getElementById("cw-panel").classList.remove("open");
    document.getElementById("cw-overlay").classList.remove("open");
    document.body.style.overflow = "";
  }

  document.getElementById("cw-fab").addEventListener("click", openChat);
  document.getElementById("cw-close").addEventListener("click", closeChat);
  document.getElementById("cw-overlay").addEventListener("click", closeChat);

  // ── Input ─────────────────────────────────────────────────────
  const inp = document.getElementById("cw-input");
  inp.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 72) + "px";
    const len = this.value.length;
    const ctr = document.getElementById("cw-counter");
    ctr.textContent = `${len} / 300`;
    ctr.className   = `cw-counter${len > 260 ? " warn" : ""}`;
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  document.getElementById("cw-send").addEventListener("click", send);

  document.getElementById("cw-messages").addEventListener("scroll", function () {
    isAtBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 50;
  });

  window.openChatWidget = openChat;
})();
