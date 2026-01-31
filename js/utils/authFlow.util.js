// js/utils/authFlow.util.js

const KEY_LOGGED_IN = 'fi_logged_in'
const KEY_PROFILE_IMG = 'fi_profile_img'

export function getNextUrl() {
  const url = new URL(window.location.href)
  const next = url.searchParams.get('next') || 'index.html'
  return next
}

export function goNext() {
  const next = getNextUrl()
  window.location.href = next
}

export function setLoggedIn(v) {
  localStorage.setItem(KEY_LOGGED_IN, v ? '1' : '0')
}

export function setProfileImg(url) {
  if (!url) {
    localStorage.removeItem(KEY_PROFILE_IMG)
    return
  }
  localStorage.setItem(KEY_PROFILE_IMG, url)
}
