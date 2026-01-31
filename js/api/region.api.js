import { supabase } from './supabaseClient.js'

// 1) 시/도별 전체 카운트 (DB group by)
export async function fetchSidoCounts() {
  const { data, error } = await supabase.rpc('get_sido_counts')
  if (error) throw error
  // data: [{sido, cnt}, ...]
  return (data || []).map(r => ({ sido: r.sido, cnt: Number(r.cnt || 0) }))
}

// 2) 특정 시/도의 시군구별 카운트 (DB group by)
export async function fetchSigunguCounts(sido) {
  const { data, error } = await supabase.rpc('get_sigungu_counts', { p_sido: sido })
  if (error) throw error
  return (data || []).map(r => ({ sigungu: r.sigungu, cnt: Number(r.cnt || 0) }))
}
