// Show reset button for admins
if (ROL === "admin") {
  document.getElementById("admin-ranking-bar").style.display = "block";
  document.getElementById("btn-reset-ranking").addEventListener("click", async () => {
    if (!confirm("¿Resetear el ranking? Se eliminarán TODAS las apuestas y votos de campeón. Esta acción no se puede deshacer.")) return;
    const btn = document.getElementById("btn-reset-ranking");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-wc" style="width:14px;height:14px;border-width:2px"></span> Reseteando...';
    try {
      const res  = await fetch(`${API}/admin/ranking/reset`, { method: "DELETE", headers: headers() });
      const data = await res.json();
      if (res.ok) {
        toast("Ranking reseteado", "ok");
        cargarRanking();
      } else {
        toast(data.error || "Error al resetear", "error");
      }
    } catch (_) {
      toast("Error de conexión", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-arrow-counterclockwise me-1"></i> Resetear ranking';
    }
  });
}

// ── Song embed helper ─────────────────────────────────────────
function getSongEmbed(url) {
  if (!url) return null;
  const sp = url.match(/open\.spotify\.com(?:\/intl-[^/]+)?\/track\/([A-Za-z0-9]+)/);
  if (sp) return { src: `https://open.spotify.com/embed/track/${sp[1]}?utm_source=generator`, h: 80 };
  const yt = url.match(/(?:youtube\.com\/watch[?&]v=|music\.youtube\.com\/watch[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}`, h: 200 };
  return null;
}

// ── User profile modal ────────────────────────────────────────
let profileModal = null;

async function openUserProfile(userId) {
  if (!profileModal) profileModal = new bootstrap.Modal(document.getElementById("modal-perfil-usuario"));
  document.getElementById("modal-perfil-body").innerHTML =
    '<div style="padding:2.5rem;text-align:center"><span class="spinner-wc" style="width:2rem;height:2rem;border-width:3px"></span></div>';
  profileModal.show();

  try {
    const res  = await fetch(`${API}/usuarios/${userId}/perfil-publico`, { headers: headers() });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById("modal-perfil-body").innerHTML =
        `<div style="padding:2rem;text-align:center;color:var(--text-sub)">${escHtml(data.error || "Error al cargar el perfil")}</div>`;
      return;
    }

    // ── Avatar
    const avatarHtml = data.foto_perfil
      ? `<img src="${data.foto_perfil}" class="pm-avatar" alt="${escHtml(data.nombre)}" />`
      : `<span class="pm-avatar-def"><i class="bi bi-person-fill"></i></span>`;

    // ── Header section
    const moodLine   = data.estado_animo ? `<span class="pm-mood">${data.estado_animo}</span>` : "";
    const statusLine = data.estado ? `<p class="pm-status">"${escHtml(data.estado)}"</p>` : "";

    // ── Stats section
    const pts    = data.total_puntos ?? 0;
    const aciertos = data.aciertos  ?? 0;
    const statsHtml = `
      <div class="pm-section">
        <div class="pm-section-title"><i class="bi bi-bar-chart-fill"></i> Estadísticas</div>
        <div class="pm-stats-grid">
          <div class="pm-stat">
            <span class="pm-stat-val" style="color:var(--gold)">${pts}</span>
            <span class="pm-stat-lbl">Puntos totales</span>
          </div>
          <div class="pm-stat">
            <span class="pm-stat-val" style="color:#4ade80">✓ ${aciertos}</span>
            <span class="pm-stat-lbl">Predicciones correctas</span>
          </div>
        </div>
      </div>`;

    // ── Champion section (only if set)
    const campeonHtml = data.campeon_apostado ? `
      <div class="pm-section">
        <div class="pm-section-title"><i class="bi bi-trophy-fill"></i> Campeón apostado</div>
        <div class="pm-campeon">
          <span class="pm-campeon-icon">🏆</span>
          <span style="font-weight:600;font-size:.95rem">${escHtml(data.campeon_apostado)}</span>
        </div>
      </div>` : "";

    // ── Bio section (only if set)
    const bioHtml = data.biografia ? `
      <div class="pm-section">
        <div class="pm-section-title"><i class="bi bi-person-lines-fill"></i> Sobre mí</div>
        <p class="pm-bio">${escHtml(data.biografia)}</p>
      </div>` : "";

    // ── Song section (only if valid embed)
    const emb = getSongEmbed(data.cancion_url);
    const songHtml = emb ? `
      <div class="pm-section">
        <div class="pm-section-title"><i class="bi bi-music-note-beamed"></i> Canción favorita</div>
        <iframe class="pm-embed" src="${emb.src}" height="${emb.h}"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"></iframe>
      </div>` : "";

    document.getElementById("modal-perfil-body").innerHTML = `
      <div class="pm-header">
        ${avatarHtml}
        ${moodLine}
        <p class="pm-name">${escHtml(data.nombre)}</p>
        ${statusLine}
      </div>
      ${statsHtml}
      ${campeonHtml}
      ${bioHtml}
      ${songHtml}`;
  } catch (_) {
    document.getElementById("modal-perfil-body").innerHTML =
      '<div style="padding:2rem;text-align:center;color:var(--text-sub)">Error de conexión</div>';
  }
}

// ── Ranking load & render ─────────────────────────────────────
async function cargarRanking() {
  try {
    const res  = await fetch(`${API}/ranking`, { headers: headers() });
    const data = await res.json();
    renderRanking(data);
  } catch (_) {
    document.getElementById("ranking-container").innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>No se pudo cargar el ranking</h3>
      </div>`;
  }
}

function renderRanking(data) {
  if (!data.length) {
    document.getElementById("ranking-container").innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🏆</span>
        <h3>Nadie ha apostado todavía</h3>
        <p>¡Sé el primero en apostar!</p>
      </div>`;
    return;
  }

  const filas = data.map(u => {
    const posClase   = u.posicion === 1 ? "pos-1" : u.posicion === 2 ? "pos-2" : u.posicion === 3 ? "pos-3" : "pos-n";
    const podiumCls  = u.posicion === 1 ? "podium-1" : u.posicion === 2 ? "podium-2" : u.posicion === 3 ? "podium-3" : "";
    const ringCls    = u.posicion === 1 ? "top-ring-1" : u.posicion === 2 ? "top-ring-2" : u.posicion === 3 ? "top-ring-3" : "";
    const esYo       = u.id === YO_ID;
    const avatarHtml = u.foto_perfil
      ? `<img class="rank-avatar ${ringCls}" src="${u.foto_perfil}" alt="${escHtml(u.nombre)}" />`
      : `<span class="rank-avatar-default ${ringCls}"><i class="bi bi-person-fill"></i></span>`;
    const campeonCell = u.campeon_apostado
      ? `<span style="font-size:.85rem;color:#e2e8f0">${escHtml(u.campeon_apostado)}</span>`
      : `<span style="color:var(--text-sub)">—</span>`;
    return `<tr class="${[esYo ? "yo-row" : "", podiumCls].filter(Boolean).join(" ")}" data-uid="${u.id}">
      <td><span class="pos-medal ${posClase}">${u.posicion}</span></td>
      <td>
        <span class="rank-nombre-wrap">
          ${avatarHtml}
          <span>
            <span style="font-weight:600;display:block;line-height:1.2">${escHtml(u.nombre)}</span>
            ${esYo ? '<span class="yo-tag">TÚ</span>' : ""}
          </span>
        </span>
      </td>
      <td><span class="pts-total">${u.total_puntos}</span></td>
      <td class="col-aciertos"><span style="color:#4ade80;font-weight:700;font-size:1rem">${u.aciertos}</span></td>
      <td class="col-campeon">${campeonCell}</td>
    </tr>`;
  }).join("");

  document.getElementById("ranking-container").innerHTML = `
    <div class="ranking-card">
      <div style="overflow-x:auto">
        <table class="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th><i class="bi bi-star-fill me-1"></i>Pts</th>
              <th class="col-aciertos">✓ Aciertos</th>
              <th class="col-campeon">🏆 Campeón</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div class="legend-bar">
        ✓ Predicción correcta (1X2) = 1 pt &nbsp;·&nbsp; 🏆 Campeón = 5 pts
      </div>
    </div>`;

  document.querySelectorAll(".ranking-table tbody tr").forEach((tr, i) => {
    tr.style.animationDelay = `${i * 0.04}s`;
    tr.classList.add("row-enter");
    tr.addEventListener("click", () => openUserProfile(Number(tr.dataset.uid)));
  });
}

cargarRanking();
