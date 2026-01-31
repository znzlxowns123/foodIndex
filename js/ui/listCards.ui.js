import { escapeHtml } from '../utils/format.util.js'

function getIndexValue(p) {
  const v =
    p.index_score ??
    p.index ??
    p.food_index ??
    null

  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function getIndexClass(score) {
  if (score >= 4.0) return 'idx-red'
  if (score >= 3.3) return 'idx-green'
  if (score >= 2.5) return 'idx-orange'
  return 'idx-gray'
}

export function renderCards({ cardsEl, rows }) {
  if (!rows.length) {
    cardsEl.innerHTML = `
      <div style="padding:24px; color:#666; text-align:center;">
        조건에 맞는 가게가 없어요.
      </div>
    `
    return
  }

  cardsEl.innerHTML = rows.map(p => {
    const idx = getIndexValue(p)
    const idxText = idx !== null ? `Index ${idx.toFixed(1)}` : 'Index -'
    const idxClass = idx !== null ? getIndexClass(idx) : 'idx-gray'

    return `
      <article class="card" data-manage-no="${escapeHtml(p.manage_no)}" style="cursor:pointer;">
        <h3 class="title">
          ${escapeHtml(p.name)}
          <span class="index ${idxClass}">${idxText}</span>
        </h3>
        <div class="meta">
          ${escapeHtml(p.area)}${p.area && p.category ? ' · ' : ''}${escapeHtml(p.category)}
        </div>
      </article>
    `
  }).join('')

  cardsEl.querySelectorAll('.card').forEach(card => {
    card.onclick = () => {
      const manageNo = card.dataset.manageNo
      location.href = `detail.html?manage_no=${encodeURIComponent(manageNo)}`
    }
  })
}
