export function setChips(chipsEl, tags = []) {
  if (!chipsEl) return
  chipsEl.innerHTML = ''
  tags
    .filter(Boolean)
    .map(v => String(v).trim())
    .filter(v => v.length > 0)
    .slice(0, 10)
    .forEach(t => {
      const span = document.createElement('span')
      span.className = 'chip'
      span.textContent = t
      chipsEl.appendChild(span)
    })
}
