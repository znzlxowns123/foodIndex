import { supabase } from './supabaseClient.js'

// DB 함수 search_places(q) 호출
export async function searchPlaces(q, { limit = 50 } = {}) {
  const query = String(q || '').trim()
  if (!query) return []

  const { data, error } = await supabase.rpc('search_places', { q: query })
  if (error) throw error

  // rpc 결과는 이미 정렬(match_rank)되어 있음
  return (data || []).slice(0, limit)
}
