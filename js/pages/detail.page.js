// js/pages/detail.page.js

import { getNicknameFromUser } from '../utils/auth.util.js'
import * as PlacesAPI from '../api/places.api.js'

import { fetchReviewsByManageNo, insertReview, deleteReviewById } from '../api/reviews.api.js'
import { fetchReviewPhotosMap, uploadReviewPhotos, deleteReviewImagesFromStorage } from '../api/reviewPhotos.api.js'
import { voteReview } from '../api/votes.api.js'

import { buildMapLink } from '../utils/mapLink.util.js'
import { priceToText } from '../utils/format.util.js'
import { addMyReviewId, removeMyReviewId, getVoterKey } from '../utils/storageKeys.util.js'
import { getAuthState, requireAuthOrRedirect } from '../utils/auth.util.js'

import { supabase } from '../api/supabaseClient.js' // ✅ 프로필(아바타) 스냅샷 조회용

import { setChips } from '../ui/chips.ui.js'
import { createRatingController } from '../ui/rating.ui.js'
import { createPhotoUploadController } from '../ui/photoUpload.ui.js'
import { createLightbox } from '../ui/lightbox.ui.js'
import { createSuggestBox } from '../ui/suggest.ui.js'
import { renderReviewsHTML, setScorePanelFromReviews } from '../ui/reviews.ui.js'

// ✅ 추가: 대표 메뉴(표) 제보/렌더
import { fetchMenuItemsByManageNo, upsertMenuItems } from '../api/menu.api.js'

// ✅ 추가: 제보(전화/영업시간 등) 최신값 로드 (새로고침 유지용)
import { fetchLatestEditsMap } from '../api/placeInfoEdits.api.js'

// ✅ 추가: 대표사진 업로드/조회
import { fetchCoverPhoto, uploadCoverPhoto } from '../api/placePhotos.api.js'

/* ---------------- params ---------------- */
const params = new URLSearchParams(location.search)
const manageNo = params.get('manage_no')

/* ---------------- DOM ---------------- */
const bookmarkStarEl = document.getElementById('bookmarkStar')
const backBtn = document.getElementById('backBtn')
const writeReviewBtn = document.getElementById('writeReviewBtn')
const addPhotoBtn = document.getElementById('addPhotoBtn')

// hero
const heroImgEl = document.getElementById('heroImg')
const heroPlaceholderEl = document.getElementById('heroPlaceholder')

// ✅ hero 클릭 업로드용 file input (html에서 넣어둔 hidden input)
const coverFileEl = document.getElementById('coverFile')

// place header
const nameEl = document.getElementById('name')
const areaEl = document.getElementById('metaArea')
const categoryEl = document.getElementById('metaCategory')
const priceEl = document.getElementById('metaPrice')

// score UI
const fiScoreEl = document.getElementById('fiScore')
const fiCountEl = document.getElementById('fiCount')
const fiConfTextEl = document.getElementById('fiConfText')
const fiConfBarEl = document.getElementById('fiConfBar')

// chips/info
const chipsEl = document.getElementById('chips')
const introBoxEl = document.getElementById('introBox')
const addrEl = document.getElementById('addr')
const phoneEl = document.getElementById('phone')
const uptaeEl = document.getElementById('uptae')
const priceInfoEl = document.getElementById('price')
const hoursEl = document.getElementById('hours')
const menuEl = document.getElementById('menu')

// actions
const mapBtnEl = document.getElementById('mapBtn')
const shareBtnEl = document.getElementById('shareBtn')

// suggestion box
const suggestBoxEl = document.getElementById('suggestBox')
const suggestTitleEl = document.getElementById('suggestTitle')
const suggestHintEl = document.getElementById('suggestHint')
const suggestInputEl = document.getElementById('suggestInput')
const suggestSubmitEl = document.getElementById('suggestSubmit')
const suggestCloseEl = document.getElementById('suggestClose')

// reviews
const reviewsEl = document.getElementById('reviews')
const formEl = document.getElementById('reviewForm')
const inputEl = document.getElementById('reviewInput')
const saveBtn = document.getElementById('saveReviewBtn')

// sort/filter
const reviewSortEl = document.getElementById('reviewSort')
const reviewPhotoOnlyEl = document.getElementById('reviewPhotoOnly')

// rating UI
const ratingValueEl = document.getElementById('ratingValue')
const ratingRangeEl = document.getElementById('ratingRange')
const ratingNumberEl = document.getElementById('ratingNumber')
const ratingCapEl = document.getElementById('ratingCap')
const capMaxTextEl = document.getElementById('capMaxText')

// photo upload
const photoInputEl = document.getElementById('photoInput')
const photoPreviewEl = document.getElementById('photoPreview')
const photoFieldEl = document.getElementById('photoField')

// lightbox
const lbEl = document.getElementById('lightbox')
const lbImg = document.getElementById('lbImg')
const lbCount = document.getElementById('lbCount')

/* ---------------- state ---------------- */
let currentPlace = null
let currentPhotosMap = new Map()
let currentReviews = []

// ✅ 추가: 최신 제보값(새로고침 유지)
let latestEdits = {}

/* ---------------- utils ---------------- */
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatKrw(n) {
  if (n === null || n === undefined || n === '') return '가격 미정'
  const num = Number(n)
  if (!Number.isFinite(num)) return '가격 미정'
  return `${num.toLocaleString()}원`
}

/* ---------------- back ---------------- */
backBtn?.addEventListener('click', () => {
  if (history.length > 1) history.back()
  else location.href = 'list.html'
})

/* ---------------- controllers ---------------- */
function getUserLevel() {
  return localStorage.getItem('level') || 'new'
}

const ratingCtl = createRatingController({
  ratingValueEl,
  ratingRangeEl,
  ratingNumberEl,
  ratingCapEl,
  capMaxTextEl,
  getUserLevel,
})

const photoCtl = createPhotoUploadController({
  photoInputEl,
  photoPreviewEl,
})

const lightbox = createLightbox({ lbEl, lbImg, lbCount })

createSuggestBox({
  manageNo,
  suggestBoxEl,
  suggestTitleEl,
  suggestHintEl,
  suggestInputEl,
  suggestSubmitEl,
  suggestCloseEl,
  onSubmitted: async ({ field, value }) => {
    latestEdits = { ...(latestEdits || {}), [field]: value }
    if (field === 'phone_public' && phoneEl) phoneEl.textContent = value
    if (field === 'open_hours_text' && hoursEl) hoursEl.textContent = value
    if (field === 'menu_summary' && menuEl) menuEl.textContent = value
  },
})

/* ---------------- auth helpers ---------------- */
function buildNextUrl() {
  return `/detail.html?manage_no=${encodeURIComponent(manageNo ?? '')}`
}

function openReviewForm({ focus = true } = {}) {
  if (!formEl) return
  formEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (focus) setTimeout(() => inputEl?.focus?.(), 150)
}

function openPhotoField() {
  if (!photoFieldEl) return
  photoFieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => photoInputEl?.click?.(), 180)
}

/* ---------------- header actions ---------------- */
writeReviewBtn?.addEventListener('click', () => {
  const nextUrl = buildNextUrl()
  if (!requireAuthOrRedirect(nextUrl)) return
  openReviewForm()
})

addPhotoBtn?.addEventListener('click', () => {
  const nextUrl = buildNextUrl()
  if (!requireAuthOrRedirect(nextUrl)) return
  openReviewForm({ focus: false })
  openPhotoField()
})

/* ---------------- bookmark star (local MVP) ---------------- */
function getBookmarkSet() {
  try {
    const raw = localStorage.getItem('bookmarks')
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveBookmarkSet(set) {
  localStorage.setItem('bookmarks', JSON.stringify([...set]))
}

function refreshBookmarkStar() {
  if (!bookmarkStarEl) return
  const set = getBookmarkSet()
  const on = !!(manageNo && set.has(manageNo))
  bookmarkStarEl.textContent = on ? '★' : '☆'
  bookmarkStarEl.classList.toggle('on', on)
}

bookmarkStarEl?.addEventListener('click', () => {
  if (!manageNo) return
  const set = getBookmarkSet()
  if (set.has(manageNo)) set.delete(manageNo)
  else set.add(manageNo)
  saveBookmarkSet(set)
  refreshBookmarkStar()
})

/* =========================================================
   ✅ 대표사진(커버) 로드 + hero 클릭 업로드
========================================================= */
async function renderCoverPhotoIfExists() {
  if (!manageNo) return
  try {
    const url = await fetchCoverPhoto(manageNo)
    if (url) {
      heroImgEl.style.background = `center/cover no-repeat url("${url}")`
      if (heroPlaceholderEl) heroPlaceholderEl.style.display = 'none'
    }
  } catch (e) {
    console.warn('[cover load fail]', e)
  }
}

function bindHeroClickCoverUpload() {
  if (!heroImgEl || !coverFileEl) return

  heroImgEl.style.cursor = 'pointer'
  heroImgEl.title = '클릭해서 대표사진 업로드'

  heroImgEl.addEventListener('click', () => {
    const nextUrl = buildNextUrl()
    if (!requireAuthOrRedirect(nextUrl)) return
    coverFileEl.click()
  })

  coverFileEl.addEventListener('change', async () => {
    const nextUrl = buildNextUrl()
    if (!requireAuthOrRedirect(nextUrl)) return

    const file = coverFileEl.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('5MB 이하 사진만 올릴 수 있어요.')
      coverFileEl.value = ''
      return
    }

    const prevText = heroPlaceholderEl?.textContent
    if (heroPlaceholderEl) {
      heroPlaceholderEl.style.display = 'flex'
      heroPlaceholderEl.textContent = '업로드 중...'
    }

    try {
      const url = await uploadCoverPhoto({ manageNo, file })
      if (url) {
        heroImgEl.style.background = `center/cover no-repeat url("${url}")`
        if (heroPlaceholderEl) heroPlaceholderEl.style.display = 'none'
      }
      alert('대표사진이 반영되었습니다.')
    } catch (e) {
      console.error(e)
      alert(`업로드 실패: ${e?.message || '콘솔 확인'}`)
      if (heroPlaceholderEl) {
        heroPlaceholderEl.style.display = 'flex'
        heroPlaceholderEl.textContent = prevText || '사진 준비중'
      }
    } finally {
      coverFileEl.value = ''
    }
  })
}

/* ---------------- place ---------------- */
async function renderPlace(place) {
  const placeName = (place?.place_name ?? '').trim()
  const addr = (place?.address_road || place?.address_jibun || '').trim()
  const cat = (place?.subcategory || place?.category || place?.uptae || place?.hygiene_uptae || '').trim()

  nameEl.textContent = placeName || '—'
  areaEl.textContent = addr || '—'
  categoryEl.textContent = cat || '—'
  priceEl.textContent = priceToText(null)

  const img = place?.image_url || place?.image || place?.photo_url || place?.menu_photo_url || null
  if (img) {
    heroImgEl.style.background = `center/cover no-repeat url("${img}")`
    if (heroPlaceholderEl) heroPlaceholderEl.style.display = 'none'
  } else {
    heroImgEl.style.background = ''
    if (heroPlaceholderEl) heroPlaceholderEl.style.display = 'flex'
  }

  const intro = (place?.intro || place?.description || '').trim()
  if (introBoxEl) {
    introBoxEl.textContent = intro || '아직 소개가 없어요. 리뷰가 쌓일수록 점수가 정교해집니다.'
  }

  addrEl.textContent = addr || '—'
  uptaeEl.textContent = (place?.hygiene_uptae || place?.uptae || cat || '').trim() || '—'
  priceInfoEl.textContent = priceToText(null)

  const phoneFromEdit = (latestEdits?.phone_public || '').trim()
  const hoursFromEdit = (latestEdits?.open_hours_text || '').trim()
  const menuSummaryFromEdit = (latestEdits?.menu_summary || '').trim()

  phoneEl.textContent = phoneFromEdit || (place?.phone_public || place?.phone || '').trim() || '—'
  hoursEl.textContent = hoursFromEdit || (place?.open_hours_text || '').trim() || '—'
  menuEl.textContent = menuSummaryFromEdit || (place?.menu_summary || '').trim() || '—'

  const tags = Array.isArray(place?.tags) ? place.tags : []
  const fallbackTags = [place?.subcategory, place?.category, place?.hygiene_uptae, place?.uptae].filter(Boolean)
  setChips(chipsEl, tags.length ? tags : fallbackTags)

  if (mapBtnEl) mapBtnEl.href = buildMapLink(placeName, addr)

  if (shareBtnEl) {
    shareBtnEl.onclick = async () => {
      const url = location.href
      try {
        if (navigator.share) {
          await navigator.share({ title: placeName || 'foodIndex', url })
          return
        }
      } catch {}
      try {
        await navigator.clipboard.writeText(url)
        alert('링크를 복사했어요!')
      } catch {
        prompt('복사가 안 되면 이 링크를 복사해줘:', url)
      }
    }
  }

  await renderMenuSection(manageNo)
}

/* ---------------- 대표 메뉴 표 렌더 ---------------- */
async function renderMenuSection(placeManageNo) {
  if (!menuEl) return
  if (!placeManageNo) return

  try {
    const list = await fetchMenuItemsByManageNo(placeManageNo)
    if (!list.length) return

    const top = list.slice(0, 5)
    menuEl.innerHTML = `
      <div class="fi-menu-table">
        ${top
          .map(
            (it) => `
            <div class="fi-menu-row">
              <div class="fi-menu-name">${escapeHtml(it.menu_name)}</div>
              <div class="fi-menu-price">${escapeHtml(formatKrw(it.price_krw))}</div>
            </div>
          `
          )
          .join('')}
      </div>
    `
  } catch (e) {
    console.warn('[menu render fail]', e)
  }
}

/* ---------------- sort/filter helpers ---------------- */
function getVoteScore(r) {
  const up = Number(r?.up_count ?? r?.helpful_up ?? 0) || 0
  const down = Number(r?.down_count ?? 0) || 0
  return up - down
}

function sortReviews(list, sortKey) {
  const arr = [...list]
  if (sortKey === 'helpful') {
    arr.sort((a, b) => getVoteScore(b) - getVoteScore(a))
    return arr
  }
  if (sortKey === 'rating_desc') {
    arr.sort((a, b) => Number(b?.rating ?? 0) - Number(a?.rating ?? 0))
    return arr
  }
  if (sortKey === 'rating_asc') {
    arr.sort((a, b) => Number(a?.rating ?? 0) - Number(b?.rating ?? 0))
    return arr
  }
  arr.sort((a, b) => new Date(b?.created_at ?? 0).getTime() - new Date(a?.created_at ?? 0).getTime())
  return arr
}

function applySortAndRender() {
  const sortKey = reviewSortEl?.value || 'recent'
  const photoOnly = !!reviewPhotoOnlyEl?.checked

  let list = sortReviews(currentReviews, sortKey)

  if (photoOnly) {
    list = list.filter((r) => {
      const photos = currentPhotosMap.get(r?.id) || []
      return photos.length > 0
    })
  }

  reviewsEl.innerHTML = renderReviewsHTML({ reviews: list, photosMap: currentPhotosMap })
  setScorePanelFromReviews({ reviews: currentReviews, fiScoreEl, fiCountEl, fiConfTextEl, fiConfBarEl })
}

reviewSortEl?.addEventListener('change', applySortAndRender)
reviewPhotoOnlyEl?.addEventListener('change', applySortAndRender)

/* ---------------- reviews ---------------- */
async function loadAndRenderReviews() {
  try {
    const reviews = await fetchReviewsByManageNo(manageNo)
    currentReviews = Array.isArray(reviews) ? reviews : []

    currentReviews = currentReviews.map((r) => ({
      ...r,
      author_nickname: r?.author_nickname || r?.nickname || '',
      author_avatar_url: r?.author_avatar_url || null,
    }))

    const reviewIds = currentReviews.map((r) => r.id).filter(Boolean)
    currentPhotosMap = await fetchReviewPhotosMap(reviewIds)

    applySortAndRender()
  } catch (err) {
    console.error(err)
    reviewsEl.innerHTML = `<div class="review-item"><div class="text">리뷰를 불러오지 못했어요.</div></div>`
    currentReviews = []
    currentPhotosMap = new Map()
    setScorePanelFromReviews({ reviews: [], fiScoreEl, fiCountEl, fiConfTextEl, fiConfBarEl })
  }
}

/* --- delegate clicks: photo/delete/report/vote --- */
reviewsEl?.addEventListener('click', async (e) => {
  const photoBtn = e.target.closest('.btn-photo')
  if (photoBtn) {
    const rid = photoBtn.dataset.review
    const idx = Number(photoBtn.dataset.idx || '0')
    const list = currentPhotosMap.get(rid) || []
    if (list.length) lightbox.open(list, idx)
    return
  }

  const del = e.target.closest('.delete-btn')
  if (del) {
    const nextUrl = buildNextUrl()
    if (!requireAuthOrRedirect(nextUrl)) return

    const id = del.dataset.id
    if (!id) return
    if (!confirm('이 리뷰를 삭제할까요?')) return

    try {
      await deleteReviewImagesFromStorage(id)
      await deleteReviewById(id)
      removeMyReviewId(id)
      await loadAndRenderReviews()
    } catch (err) {
      console.error(err)
      alert('삭제 중 오류가 발생했어요. (콘솔 확인)')
    }
    return
  }

  const reportBtn = e.target.closest('.report-btn')
  if (reportBtn) {
    const nextUrl = buildNextUrl()
    if (!requireAuthOrRedirect(nextUrl)) return
    const reviewId = reportBtn.dataset.id
    if (!reviewId) return
    alert('신고가 접수됐어요. (베타: 운영자가 확인 후 조치합니다)')
    return
  }

  const voteBtn = e.target.closest('.vote-btn')
  if (voteBtn) {
    const nextUrl = buildNextUrl()
    if (!requireAuthOrRedirect(nextUrl)) return

    const reviewId = voteBtn.dataset.id
    const voteType = voteBtn.dataset.vote
    if (!reviewId || !voteType) return

    const voterKey = getVoterKey()

    const wrap = voteBtn.closest('.actions-row') || voteBtn.parentElement
    const sameReviewBtns = wrap?.querySelectorAll?.(`.vote-btn[data-id="${reviewId}"]`) || []
    sameReviewBtns.forEach((btn) => (btn.disabled = true))

    try {
      await voteReview({ reviewId, voterKey, voteType })

      sameReviewBtns.forEach((btn) => {
        btn.disabled = true
        btn.classList.toggle('on', btn.dataset.vote === voteType)
      })

      await loadAndRenderReviews()
    } catch (error) {
      if (error?.name === 'ALREADY_VOTED' || error?.message === 'ALREADY_VOTED') {
        alert('이미 투표')
      } else {
        console.error(error)
        alert(`처리 실패: ${error?.message || '콘솔 확인'}`)
      }
      sameReviewBtns.forEach((btn) => (btn.disabled = false))
    }
    return
  }
})

/* ---------------- submit review ---------------- */
formEl?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const nextUrl = buildNextUrl()
  if (!requireAuthOrRedirect(nextUrl)) return
  if (!manageNo) return alert('manage_no가 없어요.')

  const content = (inputEl?.value ?? '').trim()
  const rating = Number(ratingRangeEl?.value ?? ratingCtl.getRating())

  if (content.length < 20) return alert('리뷰는 최소 20자 이상 작성해줘.')
  if (!Number.isFinite(rating)) return alert('점수를 확인해줘.')

  const auth = await getAuthState()
  const user = auth?.user || null
  const nickname = getNicknameFromUser(user)

  saveBtn.disabled = true
  saveBtn.textContent = '저장중...'

  try {
    let authorAvatarUrl = null
    let authorNickname = nickname

    try {
      if (user?.id) {
        const { data, error } = await supabase
          .from('fi_profiles')
          .select('nickname, avatar_url')
          .eq('id', user.id)
          .maybeSingle()

        if (!error && data) {
          authorAvatarUrl = data.avatar_url || null
          authorNickname = data.nickname || nickname
        }
      }
    } catch (e2) {
      console.warn('[author snapshot read failed]', e2)
    }

    const inserted = await insertReview({
      manageNo,
      nickname,
      rating,
      content,
      authorUid: user?.id || null,
      authorNickname,
      authorAvatarUrl,
    })

    const reviewId = inserted?.id
    if (reviewId) addMyReviewId(reviewId)

    const files = photoCtl.getFiles()
    if (reviewId && files.length) {
      try {
        await uploadReviewPhotos({ reviewId, files })
      } catch (upErr) {
        console.error(upErr)
        alert('리뷰는 저장됐지만, 사진 업로드에 실패했어요.')
      }
    }

    inputEl.value = ''
    photoCtl.reset()

    await loadAndRenderReviews()
    alert('리뷰가 저장됐어요!')
  } catch (err) {
    console.error(err)
    alert('리뷰 저장에 실패했어요.')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = '저장'
  }
})

/* =========================================================
   ✅ 대표 메뉴 제보(표 입력) : 기존 suggestBox 재활용 (기존 기능 유지)
========================================================= */
let __menuModeOn = false
let __menuRowsEl = null
let __menuAddBtn = null

function __ensureMenuUI() {
  const body = suggestBoxEl?.querySelector?.('.suggest-body')
  if (!body) return false

  if (!__menuRowsEl) {
    __menuRowsEl = document.createElement('div')
    __menuRowsEl.id = 'fiMenuRowsInline'
    __menuRowsEl.style.display = 'none'
    __menuRowsEl.style.marginTop = '10px'
    body.insertBefore(__menuRowsEl, suggestSubmitEl)
  }

  if (!__menuAddBtn) {
    __menuAddBtn = document.createElement('button')
    __menuAddBtn.type = 'button'
    __menuAddBtn.textContent = '+ 메뉴 추가'
    __menuAddBtn.className = 'btn outline'
    __menuAddBtn.style.display = 'none'
    __menuAddBtn.style.marginTop = '10px'
    body.insertBefore(__menuAddBtn, suggestSubmitEl)

    __menuAddBtn.addEventListener('click', () => __addMenuRowInline())
  }

  return true
}

function __addMenuRowInline(prefill = { name: '', price: '' }) {
  if (!__ensureMenuUI()) return
  const count = __menuRowsEl.querySelectorAll('.fi-menu-input-row').length
  if (count >= 5) return alert('대표 메뉴는 최대 5개까지 제보할 수 있어요.')

  const row = document.createElement('div')
  row.className = 'fi-menu-input-row'
  row.style.display = 'grid'
  row.style.gridTemplateColumns = '1fr 140px 64px'
  row.style.gap = '8px'
  row.style.marginBottom = '8px'

  row.innerHTML = `
    <input class="mi-name suggest-input" placeholder="메뉴명" value="${escapeHtml(prefill.name)}" />
    <input class="mi-price suggest-input" placeholder="가격" inputmode="numeric" value="${escapeHtml(prefill.price)}" />
    <button type="button" class="mi-del btn outline">삭제</button>
  `
  row.querySelector('.mi-del')?.addEventListener('click', () => row.remove())
  __menuRowsEl.appendChild(row)
}

function __switchSuggestToMenuMode() {
  if (!suggestBoxEl) return
  __ensureMenuUI()
  __menuModeOn = true

  suggestBoxEl.hidden = false

  suggestTitleEl.textContent = '대표 메뉴 제보'
  suggestHintEl.textContent = '메뉴명 + 가격(선택)을 2~5개 입력해줘.'

  suggestInputEl.style.display = 'none'
  suggestInputEl.value = ''

  __menuRowsEl.style.display = 'block'
  __menuAddBtn.style.display = 'inline-flex'
  __menuRowsEl.innerHTML = ''

  __addMenuRowInline()
  __addMenuRowInline()
}

function __switchSuggestToTextMode() {
  __menuModeOn = false
  if (!suggestBoxEl) return
  suggestInputEl.style.display = ''
  if (__menuRowsEl) __menuRowsEl.style.display = 'none'
  if (__menuAddBtn) __menuAddBtn.style.display = 'none'
}

async function __submitMenuInline() {
  if (!manageNo) return alert('manage_no가 없어요.')
  if (!__menuRowsEl) return

  const rows = [...__menuRowsEl.querySelectorAll('.fi-menu-input-row')]
  const items = rows
    .map((r) => {
      const name = r.querySelector('.mi-name')?.value?.trim()
      let priceRaw = r.querySelector('.mi-price')?.value?.trim()

      if (!name) return null

      if (priceRaw) priceRaw = priceRaw.replaceAll(',', '').replaceAll('원', '').trim()
      const price = priceRaw ? Number(priceRaw) : null
      if (price !== null && (!Number.isFinite(price) || price <= 0)) {
        throw new Error(`가격이 올바르지 않습니다: ${name}`)
      }

      return { menu_name: name, price_krw: price }
    })
    .filter(Boolean)

  if (items.length < 1) return alert('메뉴를 1개 이상 입력해줘.')

  const dedup = new Map()
  for (const it of items) dedup.set(it.menu_name.toLowerCase(), it)
  const clean = [...dedup.values()].slice(0, 5)

  await upsertMenuItems({ placeManageNo: manageNo, items: clean })
  await renderMenuSection(manageNo)

  suggestBoxEl.hidden = true
  __switchSuggestToTextMode()

  alert('대표 메뉴가 반영됐어!')
}

document.addEventListener(
  'click',
  (e) => {
    const btn = e.target.closest?.('button[data-suggest="menu_summary"]')
    if (!btn) return
    e.preventDefault()
    e.stopPropagation()
    __switchSuggestToMenuMode()
  },
  true
)

suggestSubmitEl?.addEventListener(
  'click',
  async (e) => {
    if (!__menuModeOn) return
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    try {
      suggestSubmitEl.disabled = true
      await __submitMenuInline()
    } catch (err) {
      console.error(err)
      alert(err?.message || '메뉴 제보 중 오류가 발생했어.')
    } finally {
      suggestSubmitEl.disabled = false
    }
  },
  true
)

suggestCloseEl?.addEventListener(
  'click',
  () => {
    if (__menuModeOn) __switchSuggestToTextMode()
  },
  true
)

/* ---------------- init ---------------- */

// ✅ 추가: places.api.js 안 건드리고도 “살아있는 함수”로 place 조회하기
async function __fetchPlaceFallback(manageNo) {
  const candidates = [
    'fetchPlaceByManageNo',
    'fetchPlaceByManageNoOrNull',
    'fetchPlaceByManageNoSafe',
    'fetchPlaceByManageNoV2',
    'fetchPlaceById',
    'fetchPlace',
    'fetchPlaceDetail',
    'fetchPlaceInfo',
    'getPlaceByManageNo',
    'getPlace',
  ]

  for (const key of candidates) {
    const fn = PlacesAPI?.[key]
    if (typeof fn === 'function') {
      try {
        const res = await fn(manageNo)
        if (res) return res
      } catch (e) {
        // 다음 후보로 계속
      }
    }
  }

  // 마지막 보험: places.api.js export가 뭐든 없으면, 여기서만 직접 조회 (기존 기능 영향 없음)
  const mn = String(manageNo ?? '').trim()
  if (!mn) return null

  const { data, error } = await supabase
    .from('places_v2')
    .select('manage_no, place_name, address_road, address_jibun, category, hygiene_uptae, tags')
    .eq('manage_no', mn)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function init() {
  console.log('manageNo =', manageNo)

  if (!manageNo) {
    nameEl.textContent = '잘못된 접근입니다 (manage_no 없음)'
    return
  }

  refreshBookmarkStar()

  try {
    // ✅ 여기만 변경: export 이름이 뭐든 가게정보를 “무조건” 가져오게
    currentPlace = await __fetchPlaceFallback(manageNo)

    try {
      latestEdits = await fetchLatestEditsMap(manageNo)
    } catch (e) {
      console.warn('[latestEdits load fail]', e)
      latestEdits = {}
    }

    if (currentPlace) {
      await renderPlace(currentPlace)
      await renderCoverPhotoIfExists()
      bindHeroClickCoverUpload()
    } else {
      nameEl.textContent = '가게 정보를 찾을 수 없어요'
    }
  } catch (err) {
    console.error(err)
    nameEl.textContent = '가게 정보를 찾을 수 없어요'
  }

  await loadAndRenderReviews()
}

;(async () => {
  await init()
})()
