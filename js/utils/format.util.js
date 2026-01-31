export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function formatTime(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function priceToText(_level) {
  return '가격 미정'
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export function round1(n) {
  return Math.round(n * 10) / 10
}
export function formatKST(ts){
  const d = new Date(ts)
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}
