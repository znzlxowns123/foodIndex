// js/ui/topRightUser.ui.js
import { supabase } from '../api/supabaseClient.js'

/* =========================
   DOM auto picker
========================= */
function pickAvatarEls() {
  const ids = ['headerAvatar', 'indexProfileBtn', 'listProfileBtn', 'topRightUserBtn']
  const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
  document.querySelectorAll('[data-topright-avatar]').forEach((el) => els.push(el))
  return [...new Set(els)]
}

function pickLoginBtnEls() {
  const ids = ['headerAuthBtn', 'headerLoginBtn', 'topRightLoginBtn']
  const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
  document.querySelectorAll('[data-topright-login]').forEach((el) => els.push(el))
  return [...new Set(els)]
}

function setImportant(el, key, value) {
  if (!el) return
  el.style.setProperty(key, value, 'important')
}

function applyAvatarStyle(el, avatarUrl) {
  if (!el) return

  // ✅ 어떤 태그든 "완전 원" 강제
  setImportant(el, 'border-radius', '999px')
  setImportant(el, 'overflow', 'hidden')

  // ✅ 배경/마스크/필터/블렌드 방탄 (여기서 검은 원 되는 케이스를 전부 차단)
  setImportant(el, 'filter', 'none')
  setImportant(el, 'backdrop-filter', 'none')
  setImportant(el, 'mix-blend-mode', 'normal')
  setImportant(el, 'background-blend-mode', 'normal')
  setImportant(el, 'mask-image', 'none')
  setImportant(el, '-webkit-mask-image', 'none')

  // IMG 태그면 src로
  if (el.tagName === 'IMG') {
    if (avatarUrl) el.src = `${avatarUrl}?v=${Date.now()}`
    else el.removeAttribute('src')
    return
  }

  // div/a/button 등은 background로
  setImportant(el, 'background-size', 'cover')
  setImportant(el, 'background-position', 'center')
  setImportant(el, 'background-repeat', 'no-repeat')
  setImportant(el, 'cursor', 'pointer')

  if (avatarUrl) {
    // ✅ 핵심: background-image 말고 background shorthand로 "한 방에" 덮어쓰기
    // (어딘가에서 background: #111 !important 로 리셋하는 경우까지 대응)
    setImportant(el, 'background', `url("${avatarUrl}?v=${Date.now()}") center/cover no-repeat`)
    setImportant(el, 'background-color', 'transparent')
    setImportant(el, 'background-image', `url("${avatarUrl}?v=${Date.now()}")`)
    if (el.textContent) el.textContent = ''
  } else {
    setImportant(el, 'background', '#111')
    setImportant(el, 'background-image', 'none')
    setImportant(el, 'background-color', '#111')
  }

  // ✅ 한 프레임 뒤에도 다시 강제(다른 CSS/JS가 덮는 걸 방지)
  requestAnimationFrame(() => {
    setImportant(el, 'border-radius', '999px')
    setImportant(el, 'overflow', 'hidden')
    setImportant(el, 'filter', 'none')
    setImportant(el, 'backdrop-filter', 'none')
    setImportant(el, 'mix-blend-mode', 'normal')
    setImportant(el, 'background-blend-mode', 'normal')
    setImportant(el, 'mask-image', 'none')
    setImportant(el, '-webkit-mask-image', 'none')

    if (avatarUrl) {
      setImportant(el, 'background', `url("${avatarUrl}?v=${Date.now()}") center/cover no-repeat`)
      setImportant(el, 'background-color', 'transparent')
      setImportant(el, 'background-image', `url("${avatarUrl}?v=${Date.now()}")`)
    } else {
      setImportant(el, 'background', '#111')
      setImportant(el, 'background-image', 'none')
      setImportant(el, 'background-color', '#111')
    }
  })
}

/* =========================
   avatar url resolver
========================= */
function getMetaAvatarUrl(user) {
  const meta = user?.user_metadata || {}

  const identities = Array.isArray(user?.identities) ? user.identities : []
  const idAny =
    identities
      .map((v) => v?.identity_data || {})
      .find((v) => v?.picture || v?.avatar_url || v?.profile_image_url) || {}

  const id0 = identities?.[0]?.identity_data || {}

  return (
    String(meta.avatar_url || meta.picture || meta.profile_image_url || meta.avatar || '').trim() ||
    String(id0.avatar_url || id0.picture || id0.profile_image_url || '').trim() ||
    String(idAny.avatar_url || idAny.picture || idAny.profile_image_url || '').trim() ||
    ''
  )
}

function isHttpUrl(v) {
  return /^https?:\/\//i.test(String(v || '').trim())
}

// DB/로컬에 "bucket/path" 같은 값이 올 때 Public URL로 변환 시도
function resolveMaybeStorageUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  if (isHttpUrl(v)) return v

  const parts = v.split('/').filter(Boolean)
  if (parts.length >= 2) {
    const bucket = parts[0]
    const path = parts.slice(1).join('/')
    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      return data?.publicUrl || v
    } catch {
      return v
    }
  }

  const candidates = ['fi-avatars', 'avatars', 'profile', 'profiles', 'public']
  for (const b of candidates) {
    try {
      const { data } = supabase.storage.from(b).getPublicUrl(v)
      if (data?.publicUrl) return data.publicUrl
    } catch {}
  }
  return v
}

async function getDbAvatarUrl(uid) {
  if (!uid) return ''
  const { data: row, error } = await supabase
    .from('fi_profiles')
    .select('avatar_url')
    .eq('id', uid)
    .maybeSingle()

  // ✅ 여기서 에러를 숨기지 말고 콘솔에 남김 (RLS 걸리면 여기서 바로 티남)
  if (error) console.warn('[fi_profiles avatar_url] select error:', error)

  return String(row?.avatar_url || '').trim()
}

function getLocalAuthFallback() {
  const loggedIn = localStorage.getItem('fi_logged_in') === '1'
  const avatarUrl = String(localStorage.getItem('fi_profile_img') || '').trim()
  return { loggedIn, avatarUrl }
}

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false)
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = `${url}?preload=${Date.now()}`
  })
}

/**
 * 상단바 아바타/로그인 버튼 동기화
 * - ✅ getSession 우선(더 안정적)
 * - localStorage(fi_logged_in/fi_profile_img) 폴백
 */
export async function syncTopRightUserUI({
  avatarEl,
  loginBtnEl,
  afterLoginRedirect = location.pathname.replace(/^\//, '') + location.search,
} = {}) {
  const avatarTargets = avatarEl ? (Array.isArray(avatarEl) ? avatarEl : [avatarEl]) : pickAvatarEls()
  const loginTargets = loginBtnEl ? (Array.isArray(loginBtnEl) ? loginBtnEl : [loginBtnEl]) : pickLoginBtnEls()

  if (!avatarTargets.length && !loginTargets.length) return

  // ✅ 세션 우선 (getUser가 가끔 늦게 잡히는 케이스 방지)
  let user = null
  let isAuthed = false
  let uid = null

  try {
    const { data: ses } = await supabase.auth.getSession()
    user = ses?.session?.user || null
    isAuthed = !!user
    uid = user?.id || null
  } catch {}

  // (보조) getUser도 한 번 더 시도
  if (!isAuthed) {
    try {
      const { data } = await supabase.auth.getUser()
      user = data?.user || null
      isAuthed = !!user
      uid = user?.id || null
    } catch {}
  }

  // ✅ avatar url resolve (localStorage → meta/identities → DB)
  let avatarUrl = resolveMaybeStorageUrl(localStorage.getItem('fi_profile_img') || '')

  // 1) Supabase 유저 메타(구글 picture 등)
  if (isAuthed && !avatarUrl) {
    const metaUrl = resolveMaybeStorageUrl(getMetaAvatarUrl(user))
    if (metaUrl) {
      avatarUrl = metaUrl
      localStorage.setItem('fi_profile_img', avatarUrl)
    }
  }

  // 2) DB(fi_profiles.avatar_url)
  if (isAuthed && !avatarUrl) {
    const dbUrlRaw = await getDbAvatarUrl(uid)
    const dbUrl = resolveMaybeStorageUrl(dbUrlRaw)
    if (dbUrl) {
      avatarUrl = dbUrl
      localStorage.setItem('fi_profile_img', avatarUrl)
    }
  }

  // ✅ Supabase 세션이 안 잡히면 로컬 로그인으로 폴백
  if (!isAuthed) {
    const local = getLocalAuthFallback()
    if (local.loggedIn) {
      isAuthed = true
      if (!avatarUrl) avatarUrl = resolveMaybeStorageUrl(local.avatarUrl)
    }
  }

  // ✅ 이미지가 실제 로드 가능한지 확인 후 반영 (403/404면 검은 원 유지)
  let ok = true
  if (isAuthed && avatarUrl) ok = await preloadImage(avatarUrl)

 avatarTargets.forEach((el) => {
  const has = !!(isAuthed && ok && avatarUrl)
  el.classList.toggle('has-avatar', has)
  applyAvatarStyle(el, has ? avatarUrl : '')
})


  // ✅ 클릭 동작 통일
  avatarTargets.forEach((el) => {
    el.onclick = () => {
      sessionStorage.setItem('fi_prev_url', location.href)
      if (isAuthed) location.href = 'profile.html?u=me'
      else location.href = `auth.html?next=${encodeURIComponent(afterLoginRedirect)}`
    }
  })

  // ✅ 로그인 버튼(있으면) 동기화
  loginTargets.forEach((btn) => {
    if (!btn) return
    if (isAuthed) {
      btn.textContent = '내 프로필'
      btn.onclick = () => {
        sessionStorage.setItem('fi_prev_url', location.href)
        location.href = 'profile.html?u=me'
      }
    } else {
      btn.textContent = '로그인'
      btn.onclick = () => {
        sessionStorage.setItem('fi_prev_url', location.href)
        location.href = `auth.html?next=${encodeURIComponent(afterLoginRedirect)}`
      }
    }
  })
}
