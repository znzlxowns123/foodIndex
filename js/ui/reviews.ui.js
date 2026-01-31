import { escapeHtml, formatTime } from '../utils/format.util.js'
import { isMyReview } from '../utils/storageKeys.util.js'

export function setScorePanelFromReviews({ reviews, fiScoreEl, fiCountEl, fiConfTextEl, fiConfBarEl }) {
  const n = reviews?.length ?? 0
  fiCountEl.textContent = String(n)

  if (!n) {
    fiScoreEl.textContent = '—'
    fiConfTextEl.textContent = '0%'
    fiConfBarEl.style.width = '0%'
    return
  }

  const ratings = reviews.map(r => Number(r.rating)).filter(v => Number.isFinite(v) && v > 0)
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0
  fiScoreEl.textContent = avg ? avg.toFixed(1) : '—'

  const conf = Math.min(100, Math.round((n / 20) * 100))
  fiConfTextEl.textContent = `${conf}%`
  fiConfBarEl.style.width = `${conf}%`
}

/**
 * ✅ 아바타 HTML (CSS 깨짐 방지용: 인라인 스타일)
 * - 지금 단계에서는 "내 리뷰"만 내 프사(localStorage fi_profile_img)로 노출
 * - 타인 리뷰는 기본 그라데이션(나중에 user_id/프로필 join 붙이면 확장 가능)
 */
function renderAvatarInline({ isMine }) {
  const myUrl = String(localStorage.getItem('fi_profile_img') || '').trim()
  const url = (isMine && myUrl) ? myUrl : ''

  // 공통 박스(원형)
  const boxStyle = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'width:30px',
    'height:30px',
    'border-radius:999px',
    'overflow:hidden',
    'vertical-align:middle',
    'margin-right:6px',
    'border:1px solid rgba(0,0,0,0.08)',
    'flex:0 0 30px',
    'transform:translateY(-1px)',
  ].join(';')

  if (!url) {
    // 기본(파란 그라데이션)
    const bgStyle = [
      boxStyle,
      'background:linear-gradient(135deg,#7b61ff,#00d2ff)'
    ].join(';')
    return `<span aria-hidden="true" style="${bgStyle}"></span>`
  }

  // 이미지(꽉 채움)
  const imgStyle = [
    'width:100%',
    'height:100%',
    'object-fit:cover',
    'display:block'
  ].join(';')

  // 캐시 깨기: ?v=
  const safeUrl = escapeHtml(`${url}?v=${Date.now()}`)
  return `
    <span aria-hidden="true" style="${boxStyle}">
      <img src="${safeUrl}" alt="" loading="lazy" decoding="async" style="${imgStyle}" />
    </span>
  `
}

/**
 * ✅ 프로필 링크
 * - 지금은 nickname 기반으로 이동: profile.html?u=<nickname>
 * - (나중에 reviews.user_id 저장하면 u=uid로 바꾸는 게 정석)
 */
function buildProfileHref(nickname) {
  const nick = String(nickname || '').trim()
  if (!nick) return 'profile.html'
  return `profile.html?u=${encodeURIComponent(nick)}`
}

/**
 * 리뷰 HTML 렌더
 * - 기존 라이트박스 바인딩: data-review / data-idx 유지
 * - ✅ 기존 DOM/클래스 구조 유지하면서 user span 안에 링크만 삽입
 */
export function renderReviewsHTML({ reviews, photosMap }) {
  if (!reviews?.length) {
    return `<div class="review-item"><div class="text">아직 리뷰가 없어요.</div></div>`
  }

  return reviews.map(r => {
    const photos = photosMap.get(r.id) || []

    const gallery = photos.length
      ? `
        <div class="review-photos">
          ${photos.slice(0, 6).map((p, idx) => {
            const url = escapeHtml(p.url || '')
            return `
              <button class="review-photo btn-photo" type="button"
                      data-review="${escapeHtml(r.id)}" data-idx="${idx}"
                      aria-label="리뷰 사진 보기">
                <span class="photo-frame" style="--bg:url('${url}')">
                  <img src="${url}" alt="review photo" loading="lazy" decoding="async"/>
                </span>
              </button>
            `
          }).join('')}
        </div>
      `
      : ''

    const up = Number(r.helpful_up ?? r.up_count ?? 0) || 0
    const down = Number(r.down_count ?? 0) || 0

    const ratingNum = Number(r.rating)
    const ratingText = Number.isFinite(ratingNum) ? ratingNum.toFixed(1) : '—'

    // ✅ "내 리뷰" 판단 (기존 로직 그대로)
    const mine = isMyReview(r.id)

    const nickname = r.nickname ?? '익명'
    const profileHref = buildProfileHref(nickname)

    // ✅ 링크 스타일로 CSS 깨지는거 방지(밑줄/색 변경 방지)
    const linkStyle = [
      'display:inline-flex',
      'align-items:center',
      'gap:0px',
      'text-decoration:none',
      'color:inherit',
      'cursor:pointer',
    ].join(';')

    return `
      <div class="review-item">
        <div class="head">
          <span class="user">
            <a href="${escapeHtml(profileHref)}" style="${linkStyle}" aria-label="프로필 보기">
              ${renderAvatarInline({ isMine: mine })}
              ${escapeHtml(nickname)}
            </a>
          </span>

          <span class="right">
            <span class="time">${formatTime(r.created_at)}</span>
            <span class="rating-chip">점수 ${escapeHtml(ratingText)}</span>
            ${mine ? `<button class="delete-btn" data-id="${escapeHtml(r.id)}" type="button">삭제</button>` : ''}
          </span>
        </div>

        <div class="text">${escapeHtml(r.content ?? '')}</div>
        ${gallery}

        <div class="review-actions">
          <button class="vote-btn vote-up" type="button" data-id="${escapeHtml(r.id)}" data-vote="up" aria-label="추천">
            👍 <span class="count">${up}</span>
          </button>

          <button class="vote-btn vote-down" type="button" data-id="${escapeHtml(r.id)}" data-vote="down" aria-label="비추천">
            👎 <span class="count">${down}</span>
          </button>
        </div>
      </div>
    `
  }).join('')
}
