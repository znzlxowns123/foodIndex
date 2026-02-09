import { TAGS } from '../tags.js'
import { renderButtons } from '../tag-ui.js'
import { escapeHtml } from '../utils/format.util.js'
import { fetchPlacesList } from '../api/places.api.js'
import { renderCards } from '../ui/listCards.ui.js'
import { normalizeTagKey } from '../utils/tag.util.js'
import { mapFoodCategory } from '../utils/foodCategory.util.js'
import { syncTopRightUserUI } from '../ui/topRightUser.ui.js'
import { bindAuthUIAutoRefresh } from '../utils/topRightUserUI.util.js'

/* =========================
   DOM
========================= */
const sortTabs = document.getElementById('sortTabs')
const cardsEl = document.getElementById('cards')
const summaryEl = document.getElementById('summary')
const subSummaryEl = document.getElementById('subSummary')
const chipsEl = document.getElementById('chips')
const sortSelect = document.getElementById('sortSelect')
const backBtn = document.getElementById('backBtn')
const clearFiltersBtn = document.getElementById('clearFilters')
const listProfileBtn = document.getElementById('listProfileBtn')
const headerAvatar = document.getElementById('headerAvatar')
const headerAuthBtn = document.getElementById('headerAuthBtn')

// side filters
const sideSituationEl = document.getElementById('sideSituationChips')
const sideFoodEl = document.getElementById('sideFoodChips')

// ✅ side search
const sideSearchInput = document.getElementById('sideSearchInput')
const sideSearchClear = document.getElementById('sideSearchClear')

// ✅ 더보기 버튼(없으면 JS가 만들어서 붙임)
let moreBtn = document.getElementById('moreBtn')

/* =========================
   Paging
========================= */
// 🔧 FIX: 페이지 번호 방식은 20개씩
const PAGE_SIZE = 20

// 기존 변수 유지(기능 삭제 X) — 다만 페이지번호 모드에서 역할만 조정
let page = 0
let hasMore = true
let loading = false

// ✅ (FIX 1) rowsCache를 배열이 아니라 캐시 객체로
let rowsCache = { rows: [], scanOffset: 0 }

// ✅ reset 중복 호출/경합 방지 토큰
let reqToken = 0

// 🔧 FIX: 페이지 번호 UI용 상태
let totalCount = 0
let totalPages = 0

// 🔧 FIX: 페이지 번호 DOM (없으면 생성)
let pagerEl = document.getElementById('pager')
if (!pagerEl) {
  pagerEl = document.createElement('div')
  pagerEl.id = 'pager'
  pagerEl.style.cssText = `
    display:flex;
    gap:8px;
    justify-content:center;
    align-items:center;
    flex-wrap:wrap;
    margin: 18px 0 42px;
  `
  // cardsEl의 부모(리스트 영역) 맨 아래에 붙임
  cardsEl?.parentElement?.appendChild(pagerEl)
}

/* =========================
   State (URL 기준)
========================= */
const state = {
  q: '',
  sit: '',
  food: '',
  sort: 'recent',
  sido: '',
  sigungu: '',
  // 🔧 FIX: 페이지 번호
  page: 1,
}

const SIT_LABEL = new Map(TAGS.situations.map((s) => [s.key, s.label]))
const FOOD_LABEL = new Map(TAGS.foods.map((f) => [f.key, f.label]))

const labelSit = (key) => SIT_LABEL.get(key) || key
const labelFood = (key) => FOOD_LABEL.get(key) || key

/* =========================
   Food normalize helpers
========================= */
function normalizeFoodKey(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\(.*?\)/g, '')
    .replaceAll('/', '')
}
function displayFoodLabel(label) {
  return String(label ?? '').replace(/\(기타\)/g, '').trim()
}

/* =========================
   URL params
========================= */
function parseParams() {
  const params = new URLSearchParams(location.search)

  state.q = (params.get('q') || '').trim()
  state.sit = normalizeTagKey((params.get('sit') || '').trim())
  state.food = normalizeTagKey((params.get('food') || '').trim())
  state.sort = (params.get('sort') || 'recent').trim() || 'recent'
  state.sido = (params.get('sido') || '').trim()
  state.sigungu = (params.get('sigungu') || '').trim()

  // 🔧 FIX: page 파라미터(없으면 1)
  const p = Number(params.get('page') || '1')
  state.page = Number.isFinite(p) && p >= 1 ? p : 1

  if (sortSelect) sortSelect.value = state.sort
  if (sideSearchInput) sideSearchInput.value = state.q
}

function updateUrl() {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.sit) params.set('sit', state.sit)
  if (state.food) params.set('food', state.food)
  if (state.sido) params.set('sido', state.sido)
  if (state.sigungu) params.set('sigungu', state.sigungu)
  if (state.sort) params.set('sort', state.sort)

  // 🔧 FIX: page도 URL에 유지
  if (state.page && state.page !== 1) params.set('page', String(state.page))

  history.replaceState(null, '', `?${params.toString()}`)
}

/* =========================
   Side filters
========================= */
function renderSideFilters() {
  renderButtons({
    el: sideSituationEl,
    items: TAGS.situations,
    getButtonHtml: (t) => {
      const active = state.sit === t.key ? ' active' : ''
      return `
        <button type="button" class="side-chip${active}" data-key="sit" data-value="${escapeHtml(
        t.key
      )}">
          ${escapeHtml(t.label)}
        </button>
      `
    },
  })

  renderButtons({
    el: sideFoodEl,
    items: TAGS.foods,
    getButtonHtml: (t) => {
      const active =
        normalizeFoodKey(state.food) === normalizeFoodKey(t.key) ? ' active' : ''
      const label = displayFoodLabel(t.label)

      return `
        <button type="button" class="side-chip${active}" data-key="food" data-value="${escapeHtml(
        t.key
      )}">
          ${escapeHtml(label)}
        </button>
      `
    },
  })
}

/* =========================
   Chips / header
========================= */
function setChip(label, onRemove) {
  const btn = document.createElement('button')
  btn.className = 'chip'
  btn.textContent = `${label} ×`
  btn.style.cssText = `
    border:1px solid rgba(0,0,0,0.12);
    background:#fff;
    padding:8px 12px;
    border-radius:999px;
    cursor:pointer;
    font-size:13px;
  `
  btn.onclick = onRemove
  chipsEl.appendChild(btn)
}

function renderHeader(total) {
  const parts = []
  if (state.sido) parts.push(state.sido)
  if (state.sigungu) parts.push(state.sigungu)
  if (state.q) parts.push(`"${state.q}"`)
  if (state.sit) parts.push(labelSit(state.sit))
  if (state.food) parts.push(displayFoodLabel(labelFood(state.food)))

  summaryEl.textContent = parts.length ? parts.join(' · ') : '전체'
  subSummaryEl.textContent = total ? `${total}곳` : '결과 없음'

  chipsEl.innerHTML = ''
  if (state.sido)
    setChip(state.sido, () => {
      state.sido = ''
      state.sigungu = ''
      state.page = 1 // 🔧 FIX
      updateUrl()
      resetAndFetch()
    })
  if (state.sigungu)
    setChip(state.sigungu, () => {
      state.sigungu = ''
      state.page = 1 // 🔧 FIX
      updateUrl()
      resetAndFetch()
    })
  if (state.sit)
    setChip(labelSit(state.sit), () => {
      state.sit = ''
      state.page = 1 // 🔧 FIX
      updateUrl()
      resetAndFetch()
    })
  if (state.food)
    setChip(displayFoodLabel(labelFood(state.food)), () => {
      state.food = ''
      state.page = 1 // 🔧 FIX
      updateUrl()
      resetAndFetch()
    })
  if (state.q)
    setChip(`검색: ${state.q}`, () => {
      state.q = ''
      state.page = 1 // 🔧 FIX
      updateUrl()
      resetAndFetch()
    })
}

function syncSideActive() {
  document.querySelectorAll('.side-chip').forEach((btn) => {
    const key = btn.dataset.key
    const val = btn.dataset.value
    const on =
      (key === 'sit' && state.sit === val) ||
      (key === 'food' && normalizeFoodKey(state.food) === normalizeFoodKey(val))
    btn.classList.toggle('active', on)
  })

  sortTabs?.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.sort === state.sort)
  })
}

/* =========================
   Profile Button (임시)
========================= */
function getAuthStateLocal() {
  const loggedIn = localStorage.getItem('fi_logged_in') === '1'
  const profileImg = localStorage.getItem('fi_profile_img') || ''
  return { loggedIn, profileImg }
}

function renderListProfileButton() {
  if (!listProfileBtn) return

  const { loggedIn, profileImg } = getAuthStateLocal()

  listProfileBtn.style.cursor = 'pointer'
  listProfileBtn.setAttribute('role', 'button')
  listProfileBtn.setAttribute('tabindex', '0')

  listProfileBtn.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      listProfileBtn.click()
    }
  }

  if (!loggedIn) {
    listProfileBtn.textContent = '로그인'
    listProfileBtn.setAttribute('aria-label', '로그인/회원가입')
    listProfileBtn.style.backgroundImage = ''
    listProfileBtn.onclick = () => {
      location.href = 'auth.html'
    }
    return
  }

  listProfileBtn.textContent = ''
  listProfileBtn.setAttribute('aria-label', '마이페이지')
  listProfileBtn.onclick = () => {
    location.href = 'profile.html?u=me'
  }

  if (profileImg) {
    listProfileBtn.style.backgroundImage = `url("${profileImg}")`
    listProfileBtn.style.backgroundSize = 'cover'
    listProfileBtn.style.backgroundPosition = 'center'
    listProfileBtn.style.backgroundRepeat = 'no-repeat'
  } else {
    listProfileBtn.style.backgroundImage = ''
  }
}

/* =========================
   Helpers
========================= */
function normalizeRows(rows) {
  return (rows ?? [])
    .map((r) => {
      const rawFood = String(r.food_category ?? r.category ?? r.hygiene_uptae ?? '').trim()

      const n = Number(r.index_score)
      const index_score = Number.isFinite(n) ? n : 0

      return {
        manage_no: r.manage_no,
        name: String(r.place_name ?? '').trim(),
        area: String(r.address_road ?? r.address_jibun ?? '').trim(),
        category: mapFoodCategory(rawFood, r.place_name),
        food_category: mapFoodCategory(rawFood, r.place_name),

        // ✅ (기존 너가 넣은 tags 보강 유지)
        tags: Array.isArray(r.tags)
          ? r.tags
          : typeof r.tags === 'string'
            ? r.tags
                .split(/[,\s]+/)
                .map((t) => t.trim())
                .filter(Boolean)
            : [],

        index_score,
      }
    })
    .filter((p) => p.manage_no && p.name)
}

// ✅ 중복 제거 (데이터 중복 + 중복 누적 둘 다 방어)
function dedupeRows(rows) {
  const map1 = new Map()
  for (const r of rows ?? []) {
    if (!map1.has(r.manage_no)) map1.set(r.manage_no, r)
  }
  const step1 = [...map1.values()]

  const map2 = new Map()
  for (const r of step1) {
    const key = `${r.name}||${r.area}` // 같은 이름+주소면 1개만
    if (!map2.has(key)) map2.set(key, r)
  }
  return [...map2.values()]
}

// 🔧 FIX: fetchPlacesList 결과가 배열이든 {rows,total}든 모두 대응
function unwrapFetchResult(res) {
  if (Array.isArray(res)) return { rows: res, total: null }
  const rows = Array.isArray(res?.rows) ? res.rows : []
  const total = Number.isFinite(Number(res?.total))
    ? Number(res.total)
    : Number.isFinite(Number(res?.count))
      ? Number(res.count)
      : null
  return { rows, total }
}

/* =========================
   More button (기존 유지)
========================= */
function ensureMoreBtn() {
  if (moreBtn) return

  moreBtn = document.createElement('button')
  moreBtn.id = 'moreBtn'
  moreBtn.type = 'button'
  moreBtn.textContent = '더 보기'
  moreBtn.style.cssText = `
    display:none;
    margin: 18px auto 40px;
    padding: 12px 14px;
    border-radius: 12px;
    border:1px solid rgba(0,0,0,0.12);
    background:#fff;
    cursor:pointer;
    width:min(320px, 92vw);
    font-weight:700;
  `
  cardsEl?.parentElement?.appendChild(moreBtn)
  moreBtn.addEventListener('click', () => {
  state.page += 1
  updateUrl()
  loadNextPage(reqToken)
})

}

function setMoreVisible(on) {
  ensureMoreBtn()
  moreBtn.style.display = on ? 'block' : 'none'
}

function setMoreLoading(on) {
  if (!moreBtn) return
  moreBtn.disabled = on
  moreBtn.textContent = on ? '불러오는 중...' : '더 보기'
}

/* =========================
   🔧 FIX: Pager UI
========================= */
function clearPager() {
  if (!pagerEl) return
  pagerEl.innerHTML = ''
}

function renderPager() {
  if (!pagerEl) return
  clearPager()

  if (!totalPages || totalPages <= 1) return

  const makeBtn = (label, p, active = false, disabled = false) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.disabled = disabled
    b.style.cssText = `
      padding:8px 12px;
      border-radius:10px;
      border:1px solid rgba(0,0,0,0.12);
      background:${active ? '#111' : '#fff'};
      color:${active ? '#fff' : '#111'};
      cursor:${disabled ? 'default' : 'pointer'};
      font-weight:${active ? '800' : '600'};
    `
    if (!disabled) {
      b.addEventListener('click', () => {
        if (p === state.page) return
        state.page = p
        updateUrl()
        resetAndFetch()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
    return b
  }

  pagerEl.appendChild(makeBtn('이전', Math.max(1, state.page - 1), false, state.page <= 1))

  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 20) {
      const show =
        p === 1 ||
        p === totalPages ||
        Math.abs(p - state.page) <= 2

      if (!show) continue
      const prev = pagerEl.lastElementChild?.textContent
      if (prev && prev !== '이전' && prev !== '다음') {
        const prevNum = Number(prev)
        if (Number.isFinite(prevNum) && p - prevNum > 1) {
          const dots = document.createElement('span')
          dots.textContent = '…'
          dots.style.cssText = 'padding:0 4px; color:#666;'
          pagerEl.appendChild(dots)
        }
      }
    }

    pagerEl.appendChild(makeBtn(String(p), p, p === state.page, false))
  }

  pagerEl.appendChild(
    makeBtn('다음', Math.min(totalPages, state.page + 1), false, state.page >= totalPages)
  )
}

/* =========================
   Fetch (Paging)
========================= */
/* =========================
   Fetch (Paging)
========================= */
async function loadNextPage(token) {
  if (loading) return
  loading = true
  setMoreLoading(true)

  try {
    if (token !== reqToken) return

    // ✅ (FIX) 서버 사이드 필터링을 위해 파라미터 준비
    // food는 key(예: korean) 대신 label(예: 한식)을 보내야 DB ilike 검색이 잘 됨
    const foodParam = state.food ? displayFoodLabel(labelFood(state.food)) : ''

    // ✅ (FIX) while 루프 제거하고 한 번만 호출
    const res = await fetchPlacesList({
      q: state.q,
      sit: state.sit, // 서버로 전달
      food: foodParam, // 서버로 전달
      sort: state.sort,
      sido: state.sido,
      sigungu: state.sigungu,
      page: state.page,
      limit: PAGE_SIZE,
    })

    const { rows, total } = unwrapFetchResult(res)

    if (token !== reqToken) return

    if (Number.isFinite(total)) {
      totalCount = total
    }

    const normalized = normalizeRows(rows)
    // 서버에서 이미 필터링/정렬되어 오므로 추가 필터링 불필요
    const pageRows = dedupeRows(normalized)

    // 페이지 수 계산
    totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 0
    if (totalPages === 0 && pageRows.length > 0) totalPages = 1 // fallback

    renderHeader(Number.isFinite(totalCount) && totalCount > 0 ? totalCount : pageRows.length)


    renderCards({ cardsEl, rows: pageRows })
    syncSideActive()
    renderPager()


const totalKnown = Number.isFinite(totalCount) && totalCount > 0
const canMore = !totalKnown && rows.length === PAGE_SIZE // 서버에서 20개 꽉 찼으면 다음도 있을 가능성 큼
setMoreVisible(canMore)

  } catch (e) {
    console.error('[loadNextPage error]', e)
  } finally {
    loading = false
    setMoreLoading(false)
  }
}

async function resetAndFetch() {
  reqToken += 1
  const token = reqToken

  page = 0
  hasMore = true
  loading = false

  // ✅ (FIX 4) reset 시에도 캐시 객체로 초기화
  rowsCache = { rows: [], scanOffset: 0 }

  totalCount = 0
  totalPages = 0
  cardsEl.innerHTML = `<div style="padding:24px;text-align:center;">불러오는 중...</div>`

  renderSideFilters()
  setMoreVisible(false)
  clearPager()

  await loadNextPage(token)
}

/* =========================
   Events
========================= */
function wire() {
  backBtn?.addEventListener('click', () => {
    window.location.href = 'index.html'
  })

  sideSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      state.q = String(sideSearchInput.value || '').trim()
      state.page = 1
      updateUrl()
      resetAndFetch()
    }
  })

  sideSearchClear?.addEventListener('click', () => {
    if (!sideSearchInput) return
    sideSearchInput.value = ''
    state.q = ''
    state.page = 1
    updateUrl()
    resetAndFetch()
    sideSearchInput.focus()
  })

  sortSelect?.addEventListener('change', () => {
    state.sort = sortSelect.value || 'recent'
    state.page = 1
    updateUrl()
    resetAndFetch()
  })

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('#sortTabs .tab')
    if (tab) {
      state.sort = tab.dataset.sort || 'recent'
      if (sortSelect) sortSelect.value = state.sort
      state.page = 1
      updateUrl()
      resetAndFetch()
      return
    }

    const chip = e.target.closest('.side-chip')
    if (chip) {
      const key = chip.dataset.key
      const val = chip.dataset.value

      if (key === 'sit' || key === 'food') {
        state[key] = state[key] === val ? '' : val
        state[key] = normalizeTagKey(state[key])

        state.page = 1
        updateUrl()
        resetAndFetch()
      }
      return
    }

    if (e.target.closest('#clearFilters') || e.target === clearFiltersBtn) {
      state.q = ''
      state.sit = ''
      state.food = ''
      state.sido = ''
      state.sigungu = ''
      state.page = 1
      if (sideSearchInput) sideSearchInput.value = ''
      updateUrl()
      resetAndFetch()
    }
  })
}

/* =========================
   Init
========================= */
function rehydrate() {
  parseParams()
  updateUrl()
  resetAndFetch()
}

async function init() {
  if (window.__fi_list_inited) return
  window.__fi_list_inited = true

  bindAuthUIAutoRefresh()
  await syncTopRightUserUI({
    avatarEl: headerAvatar,
    loginBtnEl: headerAuthBtn,
    afterLoginRedirect: 'index.html',
  })

  parseParams()
  updateUrl()
  wire()
  renderListProfileButton()
  ensureMoreBtn()
  resetAndFetch()
}

window.addEventListener('popstate', rehydrate)
init()
