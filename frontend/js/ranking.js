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
    return `<tr class="${[esYo ? 'yo-row' : '', podiumCls].filter(Boolean).join(' ')}">
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
      <td class="col-exactos"><span style="color:var(--gold);font-weight:700;font-size:1rem">${u.marcadores_exactos}</span></td>
      <td class="col-ganador"><span style="color:#4ade80;font-weight:700;font-size:1rem">${u.ganadores_acertados}</span></td>
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
              <th class="col-exactos">⭐ Exactos</th>
              <th class="col-ganador">✓ Ganador</th>
              <th class="col-campeon">🏆 Campeón</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div class="legend-bar">
        ⭐ Marcador exacto = 3 pts &nbsp;·&nbsp; ✓ Solo ganador = 1 pt &nbsp;·&nbsp; 🏆 Campeón = 5 pts
      </div>
    </div>`;
  document.querySelectorAll(".ranking-table tbody tr").forEach((tr, i) => {
    tr.style.animationDelay = `${i * 0.04}s`;
    tr.classList.add("row-enter");
  });
}

cargarRanking();
