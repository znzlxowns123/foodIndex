// js/tag-ui.js
export function renderButtons({
  el,
  items,
  getButtonHtml, // (item) => string
  onBind,        // (rootEl) => void
}) {
  if (!el) return
  el.innerHTML = items.map(getButtonHtml).join("")
  onBind?.(el)
}
