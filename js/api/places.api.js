// js/api/places.api.js
import { supabase } from './supabaseClient.js'

export async function fetchPlacesList({
  q = '',
  sit = '',
  food = '',
  sort = 'recent',
  sido = '',
  sigungu = '',
  limit = 30,
  offset = 0,
  page,
} = {}) {
  if (Number.isFinite(Number(page)) && Number(page) >= 1) {
    offset = (Number(page) - 1) * (Number(limit) || 30)
  }

  const safeQ = String(q || '')
    .trim()
    .replaceAll(',', ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 50)

  const safeSit = String(sit || '').trim().slice(0, 50)
  const safeFood = String(food || '').trim().slice(0, 50)
  const safeSido = String(sido || '').trim().slice(0, 50)
  const safeSigungu = String(sigungu || '').trim().slice(0, 50)

  const selectCols = `
    manage_no,
    place_name,
    address_road,
    address_jibun,
    category,
    food_category,
    hygiene_uptae,
    tags,
    region_sido,
    region_sigungu,
    sido,
    sigungu
  `

  const escapeForIlike = (s) =>
    String(s || '')
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')

  function applyCommonFilters(query) {
    if (safeQ) {
      const kw = `%${escapeForIlike(safeQ)}%`
      query = query.or(
        `place_name.ilike.${kw},address_road.ilike.${kw},address_jibun.ilike.${kw}`
      )
    }

    if (safeSit) {
      const sitKw = `%${escapeForIlike(safeSit)}%`
      query = query.or(`tags.cs.{${safeSit}},tags.ilike.${sitKw}`)
    }

    if (safeFood) {
      const foodKw = `%${escapeForIlike(safeFood)}%`
      query = query.or(
        `food_category.ilike.${foodKw},category.ilike.${foodKw},hygiene_uptae.ilike.${foodKw}`
      )
    }

    if (sort === 'name_asc' || sort === 'name') {
      query = query.order('place_name', { ascending: true })
    } else {
      query = query.order('manage_no', { ascending: false })
    }

    const from = Number(offset) || 0
    const to = from + (Number(limit) || 30) - 1
    query = query.range(from, to)

    return query
  }

  async function runOnce({ useRegionCols }) {
    let query = supabase
      .from('places_v2')
      // ✅ (필수) 페이지네이션 숫자 유지하려면 total 필요 → count는 estimated만 사용
      .select(selectCols, { count: 'estimated' })

    if (safeSido) {
      query = query.eq(useRegionCols ? 'region_sido' : 'sido', safeSido)
    }
    if (safeSigungu) {
      query = query.eq(useRegionCols ? 'region_sigungu' : 'sigungu', safeSigungu)
    }

    query = applyCommonFilters(query)

    // ✅ count도 함께 받음
    const { data, count, error } = await query
    if (error) throw error

    // ✅ 반환형 유지: { rows, total }
    return {
      rows: data ?? [],
      total: Number.isFinite(Number(count)) ? Number(count) : 0,
    }
  }

  try {
    // 1차: region_* 로 조회
    const r1 = await runOnce({ useRegionCols: true })

    // region_* 에 값이 없을 수도 있으니,
    // 결과가 0개이고 region 조건을 걸었을 때만 2차 시도
    if ((safeSido || safeSigungu) && r1.rows.length === 0) {
      const r2 = await runOnce({ useRegionCols: false })
      return r2
    }

    return r1
  } catch (e) {
    const code = e?.code || ''
    const msg = String(e?.message || '')
    const isTimeout =
      code === '57014' ||
      msg.includes('statement timeout') ||
      msg.includes('canceling statement') ||
      msg.includes('Internal Server Error')

    if (isTimeout) {
      console.warn('[fetchPlacesList] timeout → retry other column set', e)
      const rAlt = await runOnce({ useRegionCols: false })
      return rAlt
    }

    console.error('[fetchPlacesList error]', e)
    throw e
  }
}

 async function fetchPlaceByManageNo(manageNo) {
  const mn = String(manageNo ?? '').trim()
  if (!mn) throw new Error('fetchPlaceByManageNo: manageNo is required')

  const { data, error } = await supabase
    .from('places_v2')
    .select(
      `
      manage_no,
      place_name,
      address_road,
      address_jibun,
      category,
      food_category,
      hygiene_uptae,
      tags,
      region_sido,
      region_sigungu,
      sido,
      sigungu
      `
    )
    .eq('manage_no', mn)
    .maybeSingle()

  if (error) throw error
  return data || null
}
