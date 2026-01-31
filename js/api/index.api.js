// js/api/index.api.js
import { supabase } from './supabaseClient.js'

/**
 * places_v2 전부 가져오기 (Supabase 페이지네이션)
 * - 1000개씩 끊어서 끝까지 로드
 * - manage_no로 정렬해서 페이지네이션 안정화
 */
export async function fetchPlacesV2All() {
  const pageSize = 1000
  let from = 0
  let all = []

  while (true) {
    const to = from + pageSize - 1

    const { data, error } = await supabase
      .from('places_v2')
      .select('*')
      .order('manage_no', { ascending: true }) // ✅ 안정적인 페이지네이션
      .range(from, to)

    if (error) throw error

    const rows = data ?? []
    all = all.concat(rows)

    // ✅ 마지막 페이지면 종료
    if (rows.length < pageSize) break

    from += pageSize
  }

  return all
}

/**
 * ✅ place_stats(view)에서 가게별 평균점수/리뷰수 맵
 * return: Map(manageNo -> { review_count, avg_rating })
 *
 * ⚠️ manageNos가 많으면 in() 한 번에 못 넣는 경우가 있어 배치 처리
 */
export async function fetchPlaceStatsMap(manageNos) {
  if (!manageNos?.length) return new Map()

  const unique = Array.from(new Set(manageNos.filter(Boolean)))

  const batchSize = 1000
  const map = new Map()

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize)

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
 * 기존 함수 유지: 이제 기본은 "전부" 가져오게 변경
 * - 폐하가 원하면 옵션으로 limit 모드도 가능하게 남겨둠
 */
export async function fetchPlacesV2({ limit } = {}) {
  let data = []

  // limit이 숫자로 들어오면: 개발/테스트용 빠른 로드 모드
  if (Number.isFinite(limit) && limit > 0) {
    const { data: d, error } = await supabase
      .from('places_v2')
      .select('*')
      .order('manage_no', { ascending: true })
      .limit(limit)

    if (error) throw error
    data = d ?? []
  } else {
    // ✅ 기본은 전체 로드
    data = await fetchPlacesV2All()
  }

  // 최신순 정렬(기존 로직 유지)
  const sorted = (data ?? []).slice().sort((a, b) => {
    const ta = a.refresh_date ?? a.created_at ?? 0
    const tb = b.refresh_date ?? b.created_at ?? 0
    return tb > ta ? 1 : tb < ta ? -1 : 0
  })

  // ✅ (핵심) listCards가 읽는 index_score를 붙이기 위해 statsMap 준비
  const manageNos = (sorted ?? []).map(r => r.manage_no).filter(Boolean)
  const statsMap = await fetchPlaceStatsMap(manageNos)

  // UI에서 쓰는 형태로 매핑(기존 로직 유지) + index_score 복구
  return sorted
    .map(row => {
      const area = row.address_road || row.address_jibun || ''
      const category =
        row.subcategory ||
        row.category ||
        row.uptae ||
        row.hygiene_uptae ||
        ''

      const stats = statsMap.get(row.manage_no)
      const avg = stats?.avg_rating ?? null
      const reviewCount = stats?.review_count ?? 0

      return {
        manage_no: row.manage_no,
        name: row.place_name,
        area,
        category: (category || '').trim(),
        tags: Array.isArray(row.tags) ? row.tags : [],

        // ✅ listCards.ui.js가 찾는 키들
        index_score: avg,          // 평균점수 (없으면 null)
        review_count: reviewCount, // 나중에 규칙(리뷰 3개부터 색)에도 필요
      }
    })
    .filter(p => p.manage_no && p.name)
}

export async function fetchReviewCountMap(manageNos) {
  if (!manageNos?.length) return new Map()
  const unique = Array.from(new Set(manageNos.filter(Boolean)))

  const { data, error } = await supabase
    .from('reviews')
    .select('place_manage_no')
    .in('place_manage_no', unique)

  if (error) throw error

  const map = new Map()
  for (const row of (data ?? [])) {
    const key = row?.place_manage_no
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}
