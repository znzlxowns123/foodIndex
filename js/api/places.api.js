// js/api/places.api.js
import { supabase } from './supabaseClient.js'

// ✅ 리뷰 평점/개수 가져오기 (place_stats 뷰 활용)
async function fetchPlaceStatsMap(manageNos) {
  if (!manageNos || manageNos.length === 0) return new Map()
  const uniqueIds = [...new Set(manageNos)]

  const { data, error } = await supabase
    .from('place_stats')
    .select('place_manage_no, avg_rating, review_count')
    .in('place_manage_no', uniqueIds)

  if (error) return new Map()

  const map = new Map()
  data?.forEach((r) => {
    map.set(r.place_manage_no, { avg: r.avg_rating, count: r.review_count })
  })
  return map
}

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

  // ✅ select 목록에서 더 이상 사용하지 않는 sido, sigungu 컬럼 제거하고 정렬을 위해 created_at 추가
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
    created_at
  `

  const escapeForIlike = (s) =>
    String(s || '')
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')

  try {
    // ✅ runOnce와 fallback 로직을 제거하고 단일 쿼리로 통합
    const hasFilters = !!(safeQ || safeSit || safeFood || safeSido || safeSigungu)
    const countMode = hasFilters ? 'exact' : 'estimated'

    let query = supabase
      .from('places_v2')
      .select(selectCols, { count: countMode })

    // ✅ 지역 필터: region_* 컬럼만 사용
    if (safeSido) {
      query = query.eq('region_sido', safeSido)
    }
    if (safeSigungu) {
      query = query.eq('region_sigungu', safeSigungu)
    }

    // ✅ 공통 필터 로직 통합
    if (safeQ) {
      const kw = `%${escapeForIlike(safeQ)}%`
      query = query.or(
        `place_name.ilike.${kw},address_road.ilike.${kw},address_jibun.ilike.${kw}`
      )
    }
    if (safeSit) {
      // 태그 필터는 배열(text[]) 타입이라 contains로 수정
      query = query.contains('tags', [safeSit])
    }
    if (safeFood) {
      const foodKw = `%${escapeForIlike(safeFood)}%`
      query = query.or(
        `food_category.ilike.${foodKw},category.ilike.${foodKw},hygiene_uptae.ilike.${foodKw}`
      )
    }

    // ✅ 정렬 로직 통합 및 'recent' 기준 수정
    if (sort === 'name_asc' || sort === 'name') {
      query = query.order('place_name', { ascending: true })
    } else if (sort === 'recent') {
      query = query.order('created_at', { ascending: false })
    } else {
      // 기본 정렬(최신순)
      query = query.order('created_at', { ascending: false })
    }

    const from = Number(offset) || 0
    const to = from + (Number(limit) || 30) - 1
    query = query.range(from, to)

    const { data, count, error } = await query
    if (error) throw error

    // ✅ index_score 병합
    const rows = data ?? []
    const manageNos = rows.map((r) => r.manage_no).filter(Boolean)
    const statsMap = await fetchPlaceStatsMap(manageNos)

    const rowsWithStats = rows.map((r) => {
      const stat = statsMap.get(r.manage_no)
      return { ...r, index_score: stat?.avg ?? null, review_count: stat?.count ?? 0 }
    })

    return {
      rows: rowsWithStats,
      total: Number.isFinite(Number(count)) ? Number(count) : 0,
    }
  } catch (e) {
    // ✅ 타임아웃 처리 대신 에러를 직접 throw
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
      region_sigungu
      `
    )
    .eq('manage_no', mn)
    .maybeSingle()

  if (error) throw error
  return data || null
}
