// js/api/placeInfoEdits.api.js
import { supabase } from './supabaseClient.js'

// place_manage_no에 대한 최신 제보값 맵으로 가져오기
// return: { phone_public: '02...', open_hours_text: '...', menu_summary: '...' }
export async function fetchLatestEditsMap(placeManageNo) {
  if (!placeManageNo) return {}

  const { data, error } = await supabase
    .from('place_info_edits')
    .select('field_name, new_value, created_at')
    .eq('place_manage_no', placeManageNo)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  const map = {}
  for (const row of data || []) {
    const k = row?.field_name
    if (!k) continue
    // 최신순 정렬이니까, 처음 만난 값이 최신값
    if (map[k] === undefined) map[k] = row?.new_value ?? ''
  }
  return map
}
