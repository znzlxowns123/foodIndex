import { escapeHtml, formatKST } from '../utils/format.util.js'

function toGrade(score) {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

export function renderProfileBasic({ nicknameEl, bioEl, nickname, bio }) {
  nicknameEl && (nicknameEl.textContent = nickname || '')
  bioEl && (bioEl.textContent = bio || '')
}

export function renderProfileMissing({ nicknameEl, bioEl, trustScoreEl, trustStatusEl, trustSubEl, u }) {
  nicknameEl && (nicknameEl.textContent = '프로필 없음')
  bioEl && (bioEl.textContent = `fi_profiles에 nickname='${u}' 먼저 생성 필요`)
  trustScoreEl && (trustScoreEl.textContent = '-')
  trustStatusEl && (trustStatusEl.textContent = '-')
  trustSubEl && (trustSubEl.textContent = '-')
}

export function renderTrust({ trustScoreEl, trustStatusEl, trustSubEl, profile }) {
  const reviewCount = Number(profile?.review_count ?? 0)
  const score = Number(profile?.trust_score ?? 0)
  const status = String(profile?.trust_level ?? '측정중')

  if (reviewCount < 5) {
    trustScoreEl.textContent = '신뢰도 측정중'
    trustStatusEl.textContent = '측정중'
    trustSubEl.textContent = `리뷰 ${reviewCount}개`
    return
  }

  const grade = toGrade(score)
  trustScoreEl.innerHTML = `<span class="level">${grade}</span> <span class="num">(${score}점)</span>`
  trustStatusEl.textContent = status
  trustSubEl.textContent = `리뷰 ${reviewCount}개 기준`
}

/**
 * ✅ 프로필 상단 버튼을 "동적으로" 바꿔주는 렌더러
 * mode:
 * - 'login'  : 로그인
 * - 'edit'   : 프로필 편집(내 프로필)
 * - 'follow' : 팔로우(남의 프로필)
 * - 'logout' : 로그아웃(원하면 나중에 모드 확장)
 * - 'hidden' : 숨김
 */
export function renderProfileActionBtn({ actionBtn, mode = 'hidden', isOwner = false }) {
  if (!actionBtn) return

  if (mode === 'hidden') {
    actionBtn.style.display = 'none'
    return
  }

  actionBtn.style.display = ''
  actionBtn.dataset.mode = mode

  // 버튼 라벨
  if (mode === 'login') actionBtn.textContent = '로그인'
  else if (mode === 'edit') actionBtn.textContent = '프로필 편집'
  else if (mode === 'follow') actionBtn.textContent = '팔로우'
  else if (mode === 'logout') actionBtn.textContent = '로그아웃'
  else actionBtn.textContent = '확인'

  // 간단 스타일(이미 CSS 있으면 이 부분 삭제해도 됨)
  actionBtn.classList.add('profile-action-btn')
  actionBtn.setAttribute('type', 'button')
}

/**
 * ✅ profile.page.js가 찾는 이름: renderHistory
 * rows: [{ delta, score_after, status, reason, created_at }]
 */
export function renderHistory({ trustHistoryList, trustHistorySummary, rows }) {
  if (!trustHistoryList || !trustHistorySummary) return

  trustHistoryList.innerHTML = ''

  if (!rows || rows.length === 0) {
    trustHistorySummary.textContent = '최근 30일 · 변동 없음'
    const li = document.createElement('li')
    li.className = 'th-item'
    li.innerHTML = `
      <div class="th-left">
        <div class="th-title">아직 변동 기록이 없습니다</div>
        <div class="th-sub">리뷰/활동이 쌓이면 여기에 기록됩니다</div>
      </div>
      <div class="th-right">
        <div class="th-delta">-</div>
        <div class="th-sub">-</div>
      </div>
    `
    trustHistoryList.appendChild(li)
    return
  }

  trustHistorySummary.textContent = `최근 30일 · ${rows.length}회 변동`

  rows.forEach(r => {
    const delta = Number(r.delta || 0)
    const deltaTxt = delta >= 0 ? `+${delta}` : `${delta}`
    const deltaCls = delta >= 0 ? 'up' : 'down'

    const li = document.createElement('li')
    li.className = 'th-item'
    li.innerHTML = `
      <div class="th-left">
        <div class="th-title">${escapeHtml(r.reason)}</div>
        <div class="th-sub">${escapeHtml(r.status)} · ${escapeHtml(formatKST(r.created_at))}</div>
      </div>
      <div class="th-right">
        <div class="th-delta ${deltaCls}">${escapeHtml(deltaTxt)}</div>
        <div class="th-sub">${escapeHtml(String(r.score_after))}점</div>
      </div>
    `
    trustHistoryList.appendChild(li)
  })
}
