function genKey(prefix) {
  return (crypto?.randomUUID?.()
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
  )
}

export function getEditorKey() {
  const k = localStorage.getItem('editorKey')
  if (k) return k
  const newKey = genKey('ek')
  localStorage.setItem('editorKey', newKey)
  return newKey
}

export function getVoterKey() {
  const k = localStorage.getItem('voterKey')
  if (k) return k
  const newKey = genKey('vk')
  localStorage.setItem('voterKey', newKey)
  return newKey
}

export function getMyReviewIds() {
  return JSON.parse(localStorage.getItem('myReviews') || '[]')
}
export function addMyReviewId(id) {
  const ids = getMyReviewIds()
  if (!ids.includes(id)) {
    ids.push(id)
    localStorage.setItem('myReviews', JSON.stringify(ids))
  }
}
export function removeMyReviewId(id) {
  const ids = getMyReviewIds().filter(v => v !== id)
  localStorage.setItem('myReviews', JSON.stringify(ids))
}
export function isMyReview(id) {
  return getMyReviewIds().includes(id)
}
