import { escapeHtml } from '../utils/format.util.js'

export function renderIndexCards({ cardsEl, places, reviewCountMap, onClick }) {
  if (!cardsEl) return

  if (!places.length) {
    cardsEl.innerHTML = `
      <div style="padding:24px; color:#666;">
        아직 조건에 맞는 카드가 없어요.
      </div>
    `
    return
  }

  cardsEl.innerHTML = places.map(p => {
    const count = reviewCountMap.get(p.manage_no) ?? 0
    const title = escapeHtml(p.name)
    const area = escapeHtml(p.area)
    const category = escapeHtml(p.category)

    return `
      <article class="card" data-manage-no="${escapeHtml(p.manage_no)}" style="cursor:pointer;">
        <h3>${title}</h3>
        <div class="meta">
          ${area}${area && category ? ' · ' : ''}${category}
          <span style="margin-left:10px; color:#999;">·</span>
          <span style="margin-left:10px; color:#111; font-weight:700;">리뷰 ${count}</span>
        </div>
      </article>
    `
  }).join('')

  cardsEl.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const manageNo = card.dataset.manageNo
      if (!manageNo) return
      onClick?.(manageNo)
    })
  })
}
