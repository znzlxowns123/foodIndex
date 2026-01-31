// js/api/menu.api.js
import { supabase } from './supabaseClient.js'

// ✅ 메뉴 불러오기
export async function fetchMenuItemsByManageNo(placeManageNo) {
  const { data, error } = await supabase
    .from('place_menu_items')
    .select('menu_name, price_krw, updated_at')
    .eq('place_manage_no', placeManageNo)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

// ✅ 메뉴 upsert (같은 메뉴명 있으면 업데이트)
export async function upsertMenuItems({ placeManageNo, items, submittedBy = null }) {
  // items: [{ menu_name, price_krw }]
  const rows = items.map((it) => ({
    place_manage_no: placeManageNo,
    menu_name: String(it.menu_name || '').trim(),
    price_krw: it.price_krw === null || it.price_krw === undefined || it.price_krw === ''
      ? null
      : Number(it.price_krw),
    submitted_by: submittedBy,
    source: 'user',
  }))

  const { error } = await supabase
    .from('place_menu_items')
    .upsert(rows, {
      onConflict: 'place_manage_no,menu_name',
      ignoreDuplicates: false,
    })

  if (error) throw error
  return true
}
