// js/pages/auth.page.js
import { setLoggedIn, getNextUrl, goNext } from '../utils/authFlow.util.js'

// ✅ Supabase (동적 import 유지)
let supabase = null
try {
  const mod = await import('../api/supabaseClient.js') // 경로 너 프로젝트에 맞게 유지
  supabase = mod.supabase
} catch (e) {
  // supabase 없는 환경이면 임시 로그인 모드
}

const $buttons = document.getElementById('providerButtons')

/* =========================
   ✅ 이미 로그인 상태면 auth 페이지 안 보여주고 바로 next로
========================= */
await redirectIfAlreadyAuthed()

/* =========================
   Providers
========================= */
const PROVIDERS = [
  {
    id: 'google',
    label: 'Google로 계속하기',
    show: true,
    iconSvg: `
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.671 32.653 29.194 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
        <path fill="#4CAF50" d="M24 44c5.092 0 9.785-1.953 13.313-5.126l-6.146-5.198C29.135 35.091 26.705 36 24 36c-5.173 0-9.639-3.321-11.283-7.946l-6.52 5.02C9.51 39.556 16.227 44 24 44z"/>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a11.99 11.99 0 0 1-4.136 5.676l.003-.002 6.146 5.198C36.885 39.244 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
      </svg>
    `,
    async action() {
      const next = getNextUrl()

      // ✅ Supabase 있으면 OAuth
      if (supabase?.auth?.signInWithOAuth) {
        // ✅ 중요: OAuth는 auth.html로 다시 돌아와야 세션을 회수해서 "로그인됨"이 안정적으로 인식됨
        const redirectTo = new URL(
          `auth.html?next=${encodeURIComponent(next)}`,
          window.location.origin
        ).toString()

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        })

        if (error) {
          alert('구글 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.')
          console.error(error)
        }
        return
      }

      // ✅ 임시 로그인 (기존 방식 유지)
      setLoggedIn(true)
      goNext()
    },
  },

  {
    id: 'kakao',
    label: 'Kakao로 계속하기',
    show: false,
    iconSvg: `<span style="font-weight:1000;">K</span>`,
    async action() {
      alert('준비 중입니다.')
    },
  },
]

renderProviders()

/* =========================
   Functions
========================= */
async function redirectIfAlreadyAuthed() {
  // supabase 없으면(임시 모드) 기존 로컬 플래그 방식일 수도 있으니 그냥 통과
  if (!supabase?.auth?.getSession) return false

  try {
    const { data } = await supabase.auth.getSession()
    const session = data?.session

    if (session) {
      // ✅ 세션 있으면: "로그인 상태"로 처리하고 바로 next로
      setLoggedIn(true)
      goNext()
      return true
    }
  } catch (e) {
    console.error('[auth] getSession error', e)
  }
  return false
}

function renderProviders() {
  if (!$buttons) return
  $buttons.innerHTML = ''

  const visible = PROVIDERS.filter(p => p.show)
  visible.forEach(p => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'provider-btn'
    btn.dataset.provider = p.id
    btn.innerHTML = `
      <span class="icon">${p.iconSvg}</span>
      <span>${escapeHtml(p.label)}</span>
    `
    btn.addEventListener('click', () => p.action())
    $buttons.appendChild(btn)
  })
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
