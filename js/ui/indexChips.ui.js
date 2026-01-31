console.log('[foodChips] LOADED ✅ v1')

import { TAGS } from '../tags.js'
import { renderButtons } from '../tag-ui.js'
import { escapeHtml } from '../utils/format.util.js'

export function renderSituationChips({ el, onSelect }) {
  if (!el) return

  const items = [
    ...TAGS.situations,
    { key: 'all', label: '전체', icon: '✨' },
  ]

  renderButtons({
    el,
    items,
    getButtonHtml: (t) => {
      const isAll = t.key === 'all'
      const active = isAll ? ' active' : ''
      const text = t.icon ? `${t.icon} ${t.label}` : t.label
      return `<button data-filter="${escapeHtml(t.key)}" class="${active}">${escapeHtml(text)}</button>`
    },
    onBind: (root) => {
      root.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          root.querySelectorAll('button').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          const sit = btn.dataset?.filter ?? 'all'
          onSelect?.(sit)
        })
      })
    }
  })
}

export function renderFoodChips({ el, selectedFood, onToggle }) {
  if (!el) return
console.log('[foodChips] render', { selectedFood })

  const foods = TAGS.foods.map(f => f.key)

  // ✅ 비교용 정규화(괄호/슬래시/공백 차이 방지)
  const normalize = (s) =>
    String(s ?? '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/\(.*?\)/g, '')   // (기타) 같은 괄호 제거(비교용)
      .replaceAll('/', '')       // 슬래시 제거(비교용)

  // ✅ 표시용 라벨(분식(기타) -> 분식) : 값은 그대로 유지
  const displayLabel = (s) =>
    String(s ?? '')
      .replace(/\(기타\)/g, '')
      .trim()

  const selectedKey = normalize(selectedFood)

  el.innerHTML = foods.map(rawLabel => {
    const active = selectedKey && selectedKey === normalize(rawLabel) ? ' active' : ''
    const shown = displayLabel(rawLabel)

    return `
      <button class="food-chip${active}" type="button" data-food="${escapeHtml(rawLabel)}">
        <span class="text">${escapeHtml(shown)}</span>
      </button>
    `
  }).join('')

  el.querySelectorAll('.food-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const food = btn.dataset.food || ''
      if (!food) return
      onToggle?.(food)
    })
  })
}
