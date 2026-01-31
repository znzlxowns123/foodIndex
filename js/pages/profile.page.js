import { fetchProfileByNickname, fetchTrustHistory } from '../api/profile.api.js'
import { supabase } from '../api/supabaseClient.js'
import { getAuthState, requireAuthOrRedirect } from '../utils/auth.util.js'
import {
  renderProfileBasic,
  renderProfileMissing,
  renderTrust,
  renderHistory,
} from '../ui/profile.ui.js'

/* =========================
   DOM
========================= */
const nicknameEl = document.getElementById('nickname')
const bioEl = document.getElementById('bio')

const trustScoreEl = document.getElementById('trustScore')
const trustStatusEl = document.getElementById('trustStatus')
const trustSubEl = document.getElementById('trustSub')

const trustHistoryList = document.getElementById('trustHistoryList')
const trustHistorySummary = document.getElementById('trustHistorySummary')

const backBtn = document.getElementById('backBtn')
const profileActionBtn = document.getElementById('profileActionBtn')
const settingsBtn = document.getElementById('settingsBtn')

// ✅ avatar DOM
const avatarEl = document.getElementById('avatar')
const avatarImg = document.getElementById('avatarImg')
const avatarInput = document.getElementById('avatarInput')

/* =========================
   Params
========================= */
const params = new URLSearchParams(location.search)
const u = (params.get('u') || 'me').trim()
const isMe = (u === 'me')

/* =========================
   Auth Guard (Supabase)
   - 내 프로필(me)만 로그인 필수
========================= */
async function guardProfile() {
  if (!isMe) return true
  const ok = await requireAuthOrRedirect('profile.html?u=me')
  return ok
}

/* =========================
   Action Button
========================= */
function wireProfileAction({ isAuthed }) {
  if (!profileActionBtn) return

  if (!isMe) {
    profileActionBtn.style.display = 'none'
    return
  }

  if (!isAuthed) {
    profileActionBtn.textContent = '로그인'
    profileActionBtn.onclick = () => (location.href = 'auth.html?next=profile.html?u=me')
    return
  }

  profileActionBtn.textContent = '로그아웃'
  profileActionBtn.onclick = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('[signOut error]', e)
    } finally {
      localStorage.removeItem('fi_logged_in')
      localStorage.removeItem('fi_profile_img')
      location.href = 'index.html'
    }
  }
}

/* =========================
   ✅ 내 프로필: fi_profiles에서 uid로 조회
   (id = auth uid 설계 전제)
========================= */
async function fetchMyProfileByUid(uid) {
  const { data, error } = await supabase
    .from('fi_profiles')
    .select('id, nickname, bio, trust_score, trust_level, review_count, avatar_url')
    .eq('id', uid)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('MY_PROFILE_NOT_FOUND')
  return data
}

/* =========================
   ✅ 내 프로필이 없으면 생성 + 있으면 닉네임 동기화
========================= */
async function ensureMyProfile({ uid, desiredNickname }) {
  const { data: existing, error: exErr } = await supabase
    .from('fi_profiles')
    .select('id, nickname, bio, trust_score, trust_level, review_count, avatar_url')
    .eq('id', uid)
    .maybeSingle()

  if (exErr) throw exErr

  const nick = (desiredNickname || 'user').trim()

  // ✅ 이미 있으면: 닉네임이 비었거나 다르면 업데이트로 동기화
  if (existing) {
    if (nick && existing.nickname !== nick) {
      const { data: updated, error: upErr } = await supabase
        .from('fi_profiles')
        .update({ nickname: nick })
        .eq('id', uid)
        .select('id, nickname, bio, trust_score, trust_level, review_count, avatar_url')
        .single()

      if (upErr) throw upErr
      return updated
    }
    return existing
  }

  // ✅ 없으면 생성
  const payload = {
    id: uid,
    nickname: nick,
    bio: '',
    trust_score: 0,
    trust_level: '측정중',
    review_count: 0,
    avatar_url: null,
  }

  const { data: created, error: insErr } = await supabase
    .from('fi_profiles')
    .insert(payload)
    .select('id, nickname, bio, trust_score, trust_level, review_count, avatar_url')
    .single()

  if (insErr) throw insErr
  return created
}

/* =========================
   ✅ Avatar helpers (중요: 전부 최상위 스코프!)
========================= */
function openAvatarPicker() {
  avatarInput?.click()
}

// ✅ 깨진 이미지면 alt("avatar") 뜨는거 방지 + inline display:none도 JS가 제어
function setAvatar(url) {
  if (!avatarImg) return

  // 기본: 숨김 + src 제거 (파란 그라데이션 보이게)
  avatarImg.style.display = 'none'
  avatarImg.removeAttribute('src')

  if (!url) return

  avatarImg.onload = () => {
    avatarImg.style.display = 'block'
  }

  avatarImg.onerror = () => {
    avatarImg.style.display = 'none'
    avatarImg.removeAttribute('src')
    localStorage.removeItem('fi_profile_img')
  }

  avatarImg.src = `${url}?v=${Date.now()}`
}

async function uploadAvatarAndSave({ uid, file }) {
  if (!file) throw new Error('NO_FILE')

  // 간단 용량 제한 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('FILE_TOO_LARGE')
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${uid}/avatar_${Date.now()}.${ext}`

  // 1) storage 업로드
  const { error: upErr } = await supabase.storage
    .from('fi-avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' })

  if (upErr) throw upErr

  // 2) public url
  const { data } = supabase.storage.from('fi-avatars').getPublicUrl(path)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('NO_PUBLIC_URL')

  // 3) DB 업데이트
  const { error: dbErr } = await supabase
    .from('fi_profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', uid)

  if (dbErr) throw dbErr

  // (선택) 로컬 캐시
  localStorage.setItem('fi_profile_img', publicUrl)

  return publicUrl
}

function wireAvatarUpload({ isAuthed, uid }) {
  if (!avatarEl) return

  if (isMe && isAuthed && uid) {
    avatarEl.style.cursor = 'pointer'
    avatarEl.title = '프로필 사진 변경'
    avatarEl.onclick = openAvatarPicker
  } else {
    avatarEl.style.cursor = ''
    avatarEl.onclick = null
  }

  if (!avatarInput) return

  avatarInput.onchange = async (e) => {
    try {
      if (!(isMe && isAuthed && uid)) return

      const file = e.target.files?.[0]
      if (!file) return

      const url = await uploadAvatarAndSave({ uid, file })
      setAvatar(url)
      alert('프로필 사진이 변경되었습니다.')
    } catch (err) {
      console.error('[avatar upload error]', err)

      if (String(err?.message) === 'FILE_TOO_LARGE') {
        alert('파일이 너무 커요! 5MB 이하로 올려주세요.')
      } else {
        alert('업로드 실패! 콘솔을 확인해주세요.')
      }
    } finally {
      avatarInput.value = ''
    }
  }
}

/* =========================
   Load Profile
========================= */
async function load() {
  const ok = await guardProfile()
  if (!ok) return

  const auth = await getAuthState()
  const isAuthed = !!auth?.isAuthed
  const user = auth?.user || null
  const uid = user?.id || null

  wireProfileAction({ isAuthed })
  wireAvatarUpload({ isAuthed, uid })

  try {
    let profile = null

    if (isMe) {
      if (!uid) throw new Error('NO_AUTH_USER')

      // ✅ "내가 실제로 쓰는 닉네임" 우선순위: 로컬 > 메타 > 이메일
      const localNick =
        localStorage.getItem('fi_nickname') ||
        localStorage.getItem('fi_user_nickname') ||
        ''

      const metaNick = user?.user_metadata?.nickname || user?.user_metadata?.full_name || ''
      const emailNick = (user?.email || '').split('@')[0]
      const desiredNickname = (localNick || metaNick || emailNick || 'user').trim()

      profile = await ensureMyProfile({ uid, desiredNickname })
    } else {
      // ✅ 타인 프로필
      profile = await fetchProfileByNickname(u)

      // ✅ 없으면 "임시 프로필"로 보여주기 (406 방지는 api에서 maybeSingle)
      if (!profile) {
        profile = {
          id: null,
          nickname: u || '익명',
          bio: '',
          trust_score: 0,
          trust_level: '측정중',
          review_count: 0,
          avatar_url: null,
        }
      }

      // ✅ (UX) 로그인 상태에서 u가 "내 닉네임"이면 me로 정규화
      // - 댓글에서 내 닉네임을 눌러 들어온 경우를 자동으로 "내 프로필"로 바꿈
      if (isAuthed && uid) {
        // 내 프로필을 가져와서 비교(없으면 생성)
        const localNick =
          localStorage.getItem('fi_nickname') ||
          localStorage.getItem('fi_user_nickname') ||
          ''
        const metaNick = user?.user_metadata?.nickname || user?.user_metadata?.full_name || ''
        const emailNick = (user?.email || '').split('@')[0]
        const desiredNickname = (localNick || metaNick || emailNick || 'user').trim()

        const meProfile = await ensureMyProfile({ uid, desiredNickname })
        if (meProfile?.nickname && meProfile.nickname === u) {
          history.replaceState(null, '', 'profile.html?u=me')
          // 상태만 바꾸고 다시 로드
          location.reload()
          return
        }
      }
    }

    // ✅ avatar 반영 (없으면 기본)
    setAvatar(profile?.avatar_url || '')

    renderProfileBasic({
      nicknameEl,
      bioEl,
      nickname: profile.nickname,
      bio: profile.bio || '',
    })

    renderTrust({ trustScoreEl, trustStatusEl, trustSubEl, profile })

    // ✅ id가 있을 때만 히스토리 조회
    if (profile?.id) {
      const rows = await fetchTrustHistory(profile.id, 30)
      renderHistory({ trustHistoryList, trustHistorySummary, rows })
    } else {
      renderHistory({ trustHistoryList, trustHistorySummary, rows: [] })
    }
  } catch (err) {
    console.error('[profile load error]', err)

    // 실패 시에도 기본 아바타로
    setAvatar('')

    renderProfileMissing({
      nicknameEl,
      bioEl,
      trustScoreEl,
      trustStatusEl,
      trustSubEl,
      u,
    })

    renderHistory({
      trustHistoryList,
      trustHistorySummary,
      rows: [],
    })
  }
}

/* =========================
   Events
========================= */
function wire() {
  backBtn?.addEventListener('click', () => {
    if (history.length > 1) history.back()
    else location.href = 'index.html'
  })

  settingsBtn?.addEventListener('click', () => {
    alert('설정 페이지는 준비중입니다 🙂')
  })
}

/* =========================
   Init
========================= */
wire()
load()
