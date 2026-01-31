import { supabase } from '../api/supabaseClient.js'
import { syncTopRightUserUI } from '../ui/topRightUser.ui.js'
import { renderSituationChips } from '../ui/indexChips.ui.js'
import { wireSearchBar } from '../ui/searchBar.ui.js'
import { bindAuthUIAutoRefresh } from '../utils/topRightUserUI.util.js'

/* =========================
   DOM
========================= */
const indexProfileBtn = document.getElementById('indexProfileBtn')
const headerAvatar = document.getElementById('headerAvatar')
const headerAuthBtn = document.getElementById('headerAuthBtn')
const situationEl = document.getElementById('situationChips')
const searchInput = document.getElementById('searchInput')
const clearBtn = document.getElementById('clearSearch')

const regionBreadcrumbEl = document.getElementById('regionBreadcrumb')
const regionBackBtn = document.getElementById('regionBack')
const regionGridEl = document.getElementById('regionGrid')
const regionSubEl = document.getElementById('regionSub')

/* =========================
   Utils
========================= */
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function shortSidoLabel(sido) {
  const map = {
    '서울특별시': '서울',
    '부산광역시': '부산',
    '대구광역시': '대구',
    '인천광역시': '인천',
    '광주광역시': '광주',
    '대전광역시': '대전',
    '울산광역시': '울산',
    '세종특별자치시': '세종',
    '경기도': '경기',
    '강원특별자치도': '강원',
    '충청북도': '충북',
    '충청남도': '충남',
    '전북특별자치도': '전북',
    '전라남도': '전남',
    '경상북도': '경북',
    '경상남도': '경남',
    '제주특별자치도': '제주',
  }
  return map[sido] ?? sido
}

/* =========================
   ✅ 시도 정렬 기준
========================= */
const SIDO_ORDER = [
  '서울특별시',
  '경기도',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경상남도',
  '경상북도',
  '전라남도',
  '전북특별자치도',
  '충청남도',
  '충청북도',
  '강원특별자치도',
  '제주특별자치도',
]

function sortSidoByPriority(rows) {
  const orderMap = new Map(SIDO_ORDER.map((sido, i) => [sido, i]))
  return [...rows].sort((a, b) => {
    const ai = orderMap.get(a) ?? 999
    const bi = orderMap.get(b) ?? 999
    return ai - bi
  })
}

/* =========================
   List 이동
========================= */
function buildListUrl({ sit = '', q = '', sido = '', sigungu = '' } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (sit) params.set('sit', sit)
  if (sido) params.set('sido', sido)
  if (sigungu) params.set('sigungu', sigungu)
  params.set('sort', 'recent')
  return `list.html?${params.toString()}`
}

function goList({ sit = '', sido = '', sigungu = '' } = {}) {
  const q = (searchInput?.value || '').trim()
  location.href = buildListUrl({ sit, q, sido, sigungu })
}

/* =========================
   ✅ Profile Button
   - "표시(아바타/색)"는 syncTopRightUserUI가 최종권한
   - 여기서는 클릭/접근성만 보강 (덮어쓰기 금지)
========================= */
function wireIndexProfileButtonOnly() {
  if (!indexProfileBtn) return

  indexProfileBtn.setAttribute('role', 'button')
  indexProfileBtn.setAttribute('tabindex', '0')

  indexProfileBtn.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      indexProfileBtn.click()
    }
  }

  // 클릭은 syncTopRightUserUI가 세션기반으로 처리하지만,
  // 혹시라도 안전하게 한 번 더.
  indexProfileBtn.onclick = () => {
    const hasCached = !!String(localStorage.getItem('fi_profile_img') || '').trim()
    const isLocal = localStorage.getItem('fi_logged_in') === '1'
    if (hasCached || isLocal) location.href = 'profile.html?u=me'
    else location.href = 'auth.html?next=profile.html?u=me'
  }
}

/* =========================
   Region Drilldown (기존 유지)
========================= */
let regionState = { level: 'sido', sido: '' }

const regionCache = {
  sidoCounts: null,
  sigunguBySido: new Map(),
}

async function fetchSidoCounts() {
  const { data, error } = await supabase.from('place_region_counts').select('sido')
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.sido))]
}

async function fetchSigunguCounts(sido) {
  const { data, error } = await supabase
    .from('place_region_counts')
    .select('sigungu')
    .eq('sido', sido)
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.sigungu ?? '미분류'))]
}

function updateRegionHeader() {
  if (regionState.level === 'sido') {
    regionBreadcrumbEl.textContent = '지역'
    regionBackBtn.style.display = 'none'
    regionSubEl.style.display = 'none'
  } else {
    regionBreadcrumbEl.textContent = `지역 > ${shortSidoLabel(regionState.sido)}`
    regionBackBtn.style.display = ''
  }
}

function renderSidoGrid(rows) {
  regionGridEl.innerHTML = rows
    .map(
      (sido) => `
    <button class="region-card" data-sido="${escapeHtml(sido)}" type="button">
      <div class="region-name">${escapeHtml(shortSidoLabel(sido))}</div>
    </button>
  `
    )
    .join('')

  regionGridEl.querySelectorAll('.region-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      goSigungu(btn.dataset.sido)
    })
  })
}

function renderSigunguPanel(sido, rows) {
  regionSubEl.style.display = ''
  regionSubEl.innerHTML = rows
    .map(
      (sigungu) => `
    <button class="sigungu-chip" type="button">
      ${escapeHtml(sigungu)}
    </button>
  `
    )
    .join('')

  regionSubEl.querySelectorAll('.sigungu-chip').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      goList({ sido, sigungu: rows[i] })
    })
  })
}

async function goSido() {
  regionState = { level: 'sido', sido: '' }
  updateRegionHeader()

  if (!regionCache.sidoCounts) {
    regionGridEl.innerHTML = `<div style="padding:14px;color:#777;">지역 불러오는 중…</div>`
    regionCache.sidoCounts = await fetchSidoCounts()
  }

  const sorted = sortSidoByPriority(regionCache.sidoCounts)
  renderSidoGrid(sorted)
}

async function goSigungu(sido) {
  regionState = { level: 'sigungu', sido }
  updateRegionHeader()

  renderSidoGrid([sido])

  if (!regionCache.sigunguBySido.has(sido)) {
    regionSubEl.innerHTML = `<div style="padding:14px;color:#777;">세부 지역 불러오는 중…</div>`
    const rows = await fetchSigunguCounts(sido)
    regionCache.sigunguBySido.set(sido, rows)
  }

  renderSigunguPanel(sido, regionCache.sigunguBySido.get(sido))
}

/* =========================
   Init
========================= */
async function init() {
  if (window.__fi_index_inited) return
  window.__fi_index_inited = true

  // ✅ 자동 갱신도 "indexProfileBtn"을 대상으로
  bindAuthUIAutoRefresh({ avatarEl: indexProfileBtn, loginBtnEl: headerAuthBtn })

  // ✅ 표시 최종권한: syncTopRightUserUI
  await syncTopRightUserUI({
    avatarEl: indexProfileBtn,
    loginBtnEl: headerAuthBtn,
    afterLoginRedirect: location.pathname.replace(/^\//, '') + location.search,
  })

  // ✅ 여기서는 절대 backgroundImage 초기화하지 않음
  wireIndexProfileButtonOnly()

  renderSituationChips({
    el: situationEl,
    onSelect: (sit) => goList({ sit: sit === 'all' ? '' : sit }),
  })

  wireSearchBar({
    inputEl: searchInput,
    clearBtnEl: clearBtn,
    onChange: () => {},
  })

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      goList({})
    }
  })

  regionBackBtn?.addEventListener('click', goSido)
  goSido()
}

init()
