// js/api/placesList.api.js
import { supabase } from './supabaseClient.js'

console.log('[placesList.api] LOADED v6.8 ✅ (region ilike fix + return shape harden)')

function sanitizeKeyword(q) {
  let safe = String(q || '')
    .trim()
    .replaceAll(',', ' ')
    .replaceAll('(', ' ')
    .replaceAll(')', ' ')
    .replaceAll('*', ' ')
    .replaceAll('"', ' ')
    .replaceAll("'", ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (safe.length > 50) safe = safe.slice(0, 50).trim()
  return safe
}

/**
 * ✅ place_stats(view)에서 가게별 평균점수/리뷰수 맵 (배치 in 처리)
 * return: Map(manageNo -> { review_count, avg_rating })
 */
async function fetchPlaceStatsMap(manageNos = []) {
  const ids = [...new Set((manageNos || []).filter(Boolean))]
  if (!ids.length) return new Map()

  const batchSize = 500
  const map = new Map()

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)

    const { data, error } = await supabase
      .from('place_stats')
      .select('place_manage_no, review_count, avg_rating')
      .in('place_manage_no', batch)

    if (error) throw error

    for (const r of (data ?? [])) {
      map.set(r.place_manage_no, {
        review_count: r.review_count ?? 0,
        avg_rating: r.avg_rating ?? null,
      })
    }
  }

  return map
}

/**
 * ✅ rows에 index_score/review_count 붙여서 listCards.ui.js 기존 기능 살리기
 */
async function attachIndexScore(rows = []) {
  if (!rows.length) return rows

  const manageNos = rows.map(r => r.manage_no).filter(Boolean)
  const statsMap = await fetchPlaceStatsMap(manageNos)

  return rows.map(r => {
    const s = statsMap.get(r.manage_no)
    return {
      ...r,
      // listCards.ui.js가 읽는 키들
      index_score: s?.avg_rating ?? null,
      review_count: s?.review_count ?? 0,
    }
  })
}

/**
 * ✅ fetchPlacesList
 * - 기존 기능/호출부 안 깨지게 "배열" 반환 유지
 * - 동시에 {rows,total}로 받아도 되게 rowsWithScore.rows = rowsWithScore, rowsWithScore.total 제공
 */
export async function fetchPlacesList({
  sido,
  sigungu,
  food,
  sit,
  sort = 'recent',
  page = 1,
  limit = 20,
}) {
  const p = Number(page) || 1
  const l = Number(limit) || 20
  const offset = (p - 1) * l

  const sd = sanitizeKeyword(sido)
  const sg = sanitizeKeyword(sigungu)
  const f = sanitizeKeyword(food)
  const s = sanitizeKeyword(sit)

  // ✅ 1) primary (DB 컬럼 기준으로 확실히)
  async function runPrimary() {
    let query = supabase
      .from('places_v2')
      .select('*', { count: 'exact' })
      .range(offset, offset + l - 1)

    // ✅ 핵심: region은 ilike로 (서울특별시/경기도/부산광역시… 대응)
    if (sd) query = query.ilike('region_sido', `%${sd}%`)
    if (sg) query = query.ilike('region_sigungu', `%${sg}%`)

    // ✅ food 로직(기존 유지: OR 검색)
    if (f) {
      query = query.or(
        `food_category.ilike.%${f}%,hygiene_uptae.ilike.%${f}%,category.ilike.%${f}%`
      )
    }

    // ✅ sit 로직(기존 유지: tags 배열 기준)
    if (s) query = query.contains('tags', [s])

    // ✅ 정렬(기존 유지)
    if (sort === 'recent') query = query.order('created_at', { ascending: false })
    else if (sort === 'name_asc' || sort === 'name') query = query.order('place_name', { ascending: true })
    else query = query.order('manage_no', { ascending: false })

    const { data, count, error } = await query
    if (error) throw error
    return { data: data || [], count: count || 0 }
  }

  // ✅ 2) fallback: tags가 문자열로 들어간 경우 대비 (0개일 때만)
  async function runFallback() {
    let query = supabase
      .from('places_v2')
      .select('*', { count: 'exact' })
      .range(offset, offset + l - 1)

    if (sd) query = query.ilike('region_sido', `%${sd}%`)
    if (sg) query = query.ilike('region_sigungu', `%${sg}%`)

    if (f) {
      query = query.or(
        `food_category.ilike.%${f}%,hygiene_uptae.ilike.%${f}%,category.ilike.%${f}%`
      )
    }

    // ✅ tags 문자열 대비: contains 대신 ilike
    if (s) query = query.ilike('tags', `%${s}%`)

    if (sort === 'recent') query = query.order('created_at', { ascending: false })
    else if (sort === 'name_asc' || sort === 'name') query = query.order('place_name', { ascending: true })
    else query = query.order('manage_no', { ascending: false })

    const { data, count, error } = await query
    if (error) throw error
    return { data: data || [], count: count || 0 }
  }

  // ✅ 실행: 1차 -> 0개면 2차
  let { data, count } = await runPrimary()

  const hasFilters = Boolean(sd || sg || f || s)
  if (hasFilters && count === 0) {
    try {
      const fb = await runFallback()
      if (fb.count > 0) {
        data = fb.data
        count = fb.count
      }
    } catch (e) {
      console.warn('[fetchPlacesList] fallback failed:', e?.message || e)
    }
  }

  // ✅ index_score/review_count 붙이기 (기존 기능 유지)
  const rowsWithScore = await attachIndexScore(data || [])

  // ✅ "어떤 호출부든" 안 깨지게: 배열 + {rows,total} 둘 다 제공
  try {
    Object.defineProperty(rowsWithScore, 'rows', {
      value: rowsWithScore, // 자기 자신
      writable: false,
      enumerable: false,
    })
    Object.defineProperty(rowsWithScore, 'total', {
      value: count || 0,
      writable: false,
      enumerable: false,
    })
  } catch (_) {}

  return rowsWithScore || []
}
