import { supabase } from './supabaseClient.js'

/**
 * places_v2 기반 리스트 조회
 * - 반환 형태: { rows: data[], total: number }
 * - count는 exact 우선, timeout(57014) 등 실패하면 estimated로 자동 fallback
 *
 * ✅ 방탄 포인트
 * 1) region_sido/region_sigungu vs sido/sigungu 혼재 대비 (OR로 둘 다 매칭)
 * 2) q 검색 ilike 와일드카드: * 가 아니라 % 사용 + 간단 sanitize
 * 3) tags가 jsonb 배열/문자열 섞인 경우 대비 (contains + ilike OR)
 * 4) food_category / category / hygiene_uptae 중 어디에 있든 잡히게 OR
 */
export async function fetchPlacesList({
  q = '',
  sit = '',
  food = '',
  sort = 'recent',
  sido = '',
  sigungu = '',
  limit = 30,
  offset = 0,
  page, // (선택) page가 오면 offset 대신 page 기반으로 계산
} = {}) {
  // page가 들어오면 offset 계산(기존 offset도 유지)
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

  // ✅ select: 기존에 쓰던 컬럼들 + 혼재 대비 region_ 컬럼도 함께
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

  // count exact 우선 → 실패하면 estimated fallback
  async function run(countMode = 'exact') {
    let query = supabase
      .from('places_v2')
      .select(selectCols, { count: countMode })

    // ✅ region/sido 혼재 방탄 (OR 문법에 괄호 쓰면 400 나므로 절대 괄호 금지)
    if (safeSido) {
      query = query.or(`region_sido.eq.${safeSido},sido.eq.${safeSido}`)
    }
    if (safeSigungu) {
      query = query.or(`region_sigungu.eq.${safeSigungu},sigungu.eq.${safeSigungu}`)
    }

    // ✅ q 검색: ilike는 % 와일드카드 사용
    if (safeQ) {
      const kw = `%${safeQ.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
      query = query.or(
        `place_name.ilike.${kw},address_road.ilike.${kw},address_jibun.ilike.${kw}`
      )
    }

    // ✅ sit: tags가 jsonb 배열이면 contains / 문자열이면 ilike
    if (safeSit) {
      // tags.cs.{혼밥} (jsonb/text[] contains) OR tags ilike
      query = query.or(`tags.cs.{${safeSit}},tags.ilike.%${safeSit}%`)
    }

    // ✅ food: food_category / category / hygiene_uptae 어디든 걸리게
    if (safeFood) {
      query = query.or(
        `food_category.ilike.%${safeFood}%,category.ilike.%${safeFood}%,hygiene_uptae.ilike.%${safeFood}%`
      )
    }

    // ✅ sort (기존 recent=최근, manage_no desc 유지)
    // created_at이 없는 테이블에서도 안전하게 manage_no로만 정렬
    if (sort === 'name_asc' || sort === 'name') {
      query = query.order('place_name', { ascending: true })
    } else {
      query = query.order('manage_no', { ascending: false })
    }

    // ✅ paging
    const from = Number(offset) || 0
    const to = from + (Number(limit) || 30) - 1
    query = query.range(from, to)

    const { data, count, error } = await query
    if (error) throw error

    return {
      rows: data ?? [],
      total: Number.isFinite(Number(count)) ? Number(count) : 0,
    }
  }

  try {
    return await run('exact')
  } catch (e) {
    // timeout(57014) / 서버 500 등일 때 count 부담 줄여 재시도
    const code = e?.code || ''
    const msg = e?.message || ''
    const isTimeout =
      code === '57014' ||
      msg.includes('statement timeout') ||
      msg.includes('canceling statement') ||
      msg.includes('Internal Server Error')

    if (isTimeout) {
      console.warn('[fetchPlacesList] exact count failed → retry estimated', e)
      return await run('estimated')
    }
    console.error('[fetchPlacesList error]', e)
    throw e
  }
}

/**
 * places_v2에서 manage_no로 단건 조회 (detail용)
 * - select('*') 사용: 컬럼 변화에 안전
 * - 없으면 null 반환
 */
export async function fetchPlaceByManageNo(manageNo) {
  const key = String(manageNo ?? '').trim()
  if (!key) throw new Error('fetchPlaceByManageNo: manageNo is required')

  const { data, error } = await supabase
    .from('places_v2')
    .select('*')
    .eq('manage_no', key)
    .maybeSingle()

  if (error) {
    console.error('[fetchPlaceByManageNo error]', error)
    throw error
  }

  return data ?? null
}
