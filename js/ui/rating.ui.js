import { clamp, round1 } from '../utils/format.util.js'

export function createRatingController({
  ratingValueEl,
  ratingRangeEl,
  ratingNumberEl,
  ratingCapEl,
  capMaxTextEl,
  getUserLevel
}) {
  const maxByLevel = { new: 3.5, trusted: 4.5, curator: 5.0 }
  const HARD_MAX = 5.0

  let currentRating = 3.0
  let isTypingNumber = false

  function getAllowedRange() {
    const level = getUserLevel?.() || 'new'
    return { min: 1.0, max: maxByLevel[level] ?? 3.5, level }
  }

  // ✅ "검은 채움"은 항상 5.0 만점 트랙 기준으로 표시(원래 느낌)
function setRangeVisual(value) {
  // ✅ "실제 슬라이더 min/max" 기준으로 pct 계산해야 손잡이와 채움이 일치함
  const min = Number(ratingRangeEl?.min ?? 1.0)
  const max = Number(ratingRangeEl?.max ?? 5.0)

  const v = Number(value)
  const denom = (max - min) || 1
  const pct = ((v - min) / denom) * 100
  const pctClamped = clamp(pct, 0, 100)

  if (ratingRangeEl) {
    ratingRangeEl.style.setProperty('--pct', `${pctClamped}%`)
    ratingRangeEl.style.setProperty('--fill', `${pctClamped}%`) // 혹시 CSS가 --fill 쓰는 경우 대비
    ratingRangeEl.style.backgroundSize = `${pctClamped}% 100%` // fallback
  }
}

  function sanitizeDecimalInput(str) {
    let s = String(str ?? '').replace(/[^0-9.]/g, '')
    const firstDot = s.indexOf('.')
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replaceAll('.', '')
    }
    if (s === '.') s = '0.'
    return s
  }

  function applyUI(v) {
    if (ratingValueEl) ratingValueEl.textContent = v.toFixed(1)
    if (ratingRangeEl) ratingRangeEl.value = String(v)
    if (!isTypingNumber && ratingNumberEl) ratingNumberEl.value = v.toFixed(1)
    setRangeVisual(v)
  }

  function setRating(value) {
    const { min, max } = getAllowedRange()
    const v = round1(clamp(Number(value), min, max))
    currentRating = v
    applyUI(v)
  }

  function applyAllowedRangeToUI() {
    const { min, max } = getAllowedRange()

    if (ratingRangeEl) {
      ratingRangeEl.min = String(min)
      ratingRangeEl.max = String(max)
      ratingRangeEl.step = '0.1'
    }

    const locked = max < HARD_MAX
    if (ratingCapEl) ratingCapEl.hidden = !locked
    if (capMaxTextEl) capMaxTextEl.textContent = max.toFixed(1)

    const v = round1(clamp(currentRating, min, max))
    currentRating = v
    applyUI(v)
  }

  /* ---------------- events ---------------- */
  ratingRangeEl?.addEventListener('input', (e) => {
    isTypingNumber = false
    setRating(e.target.value)
  })

  ratingNumberEl?.addEventListener('beforeinput', (e) => {
    const t = e.data
    if (t == null) return
    if (!/^[0-9.]$/.test(t)) e.preventDefault()
  })

  ratingNumberEl?.addEventListener('input', (e) => {
    isTypingNumber = true
    const raw = e.target.value
    const clean = sanitizeDecimalInput(raw)
    if (clean !== raw) e.target.value = clean

    if (clean === '' || clean === '0.' || clean.endsWith('.')) return
    const n = Number(clean)
    if (!Number.isFinite(n)) return
    setRating(n)
  })

  ratingNumberEl?.addEventListener('blur', (e) => {
    const clean = sanitizeDecimalInput(e.target.value)
    if (clean === '' || clean.endsWith('.')) {
      isTypingNumber = false
      e.target.value = currentRating.toFixed(1)
      return
    }
    const n = Number(clean)
    if (!Number.isFinite(n)) {
      isTypingNumber = false
      e.target.value = currentRating.toFixed(1)
      return
    }
    isTypingNumber = false
    setRating(n)
  })

  /* ---------------- init ---------------- */
  applyAllowedRangeToUI()

  return {
    getRating: () => currentRating,
    setRating,
    applyAllowedRangeToUI
  }
}
