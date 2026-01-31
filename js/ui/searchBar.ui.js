export function wireSearchBar({ inputEl, clearBtnEl, onChange }) {
  if (!inputEl) return () => {}

  const syncClear = () => {
    const on = !!inputEl.value.trim()
    clearBtnEl?.classList.toggle('is-on', on)
  }

  const handleInput = (e) => {
    const v = (e.target.value || '').trim()
    syncClear()
    onChange?.(v)
  }

  inputEl.addEventListener('input', handleInput)

  clearBtnEl?.addEventListener('click', () => {
    inputEl.value = ''
    syncClear()
    onChange?.('')
    inputEl.focus()
  })

  syncClear()

  return () => {
    inputEl.removeEventListener('input', handleInput)
  }
}
