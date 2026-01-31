// /js/utils/auth.util.js
import { supabase } from '../api/supabaseClient.js'

const NEXT_KEY = 'fi_next_url'

/* ---------------- next helpers ---------------- */
export function parseNextFromLocation() {
  const sp = new URLSearchParams(location.search)
  return sp.get('next') || ''
}

export function setNextUrl(nextUrl) {
  if (!nextUrl) return
  try { sessionStorage.setItem(NEXT_KEY, String(nextUrl)) } catch {}
}

export function getNextUrl() {
  try { return sessionStorage.getItem(NEXT_KEY) || '' } catch { return '' }
}

export function clearNextUrl() {
  try { sessionStorage.removeItem(NEXT_KEY) } catch {}
}

/* ---------------- auth state (Supabase) ---------------- */
export async function getAuthState() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    session,
    user: session?.user || null,
    isAuthed: !!session?.user
  }
}

/* ---------------- safe redirect ---------------- */
export function safeRedirect(nextUrl, fallback = '/index.html') {
  const origin = location.origin
  try {
    const u = new URL(nextUrl || '', origin)
    if (u.origin !== origin) {
      location.href = new URL(fallback, origin).toString()
      return
    }
    location.href = u.toString()
  } catch {
    location.href = new URL(fallback, origin).toString()
  }
}

/* ---------------- gate ---------------- */
export async function requireAuthOrRedirect(nextUrl) {
  const { isAuthed } = await getAuthState()
  if (isAuthed) return true

  const next = nextUrl || (location.pathname + location.search)
  setNextUrl(next)

  const authUrl = new URL('auth.html', location.href)
  authUrl.searchParams.set('next', next)
  location.href = authUrl.toString()
  return false
}
// ✅ 구글 로그인 유저에서 닉네임 뽑기
export function getNicknameFromUser(user) {
  if (!user) return '익명'

  // 구글 OAuth는 보통 name/full_name가 들어옴
  const meta = user.user_metadata || {}
  const name =
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    meta.preferred_username ||
    ''

  if (String(name).trim()) return String(name).trim()

  // 최후: 이메일 앞부분
  const email = user.email || ''
  if (email.includes('@')) return email.split('@')[0]

  return '익명'
}
