import { supabase } from './supabaseClient.js'

async function fetchAvatarMapByNicknames(nicknames = []) {
  const nicks = [...new Set((nicknames || []).map(v => String(v || '').trim()).filter(Boolean))]
  if (!nicks.length) return new Map()

  // fi_profiles.nickname 기준으로 avatar_url 가져오기
  const { data, error } = await supabase
    .from('fi_profiles')
    .select('nickname, avatar_url')
    .in('nickname', nicks)

  if (error) throw error

  const map = new Map()
  ;(data || []).forEach(row => {
    const k = String(row?.nickname || '').trim()
    if (!k) return
    map.set(k, row?.avatar_url || '')
  })
  return map
}

export async function fetchReviewsByManageNo(manageNo) {
  const { data, error } = await supabase
    .from('reviews_with_votes')
    // ✅ avatar_url은 뷰에 없으니, 여기서는 일단 닉네임까지 가져온 뒤 fi_profiles에서 매핑해 붙임
    .select('id, nickname, rating, content, created_at, up_count, down_count')
    .eq('place_manage_no', manageNo)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = data ?? []
  const nicknames = rows.map(r => r?.nickname).filter(Boolean)
  const avatarMap = await fetchAvatarMapByNicknames(nicknames)

  // ✅ 각 리뷰에 avatar_url 주입
  return rows.map(r => ({
    ...r,
    avatar_url: avatarMap.get(String(r?.nickname || '').trim()) || '',
  }))
}

export async function insertReview({ manageNo, nickname, rating, content }) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({ place_manage_no: manageNo, nickname, rating, content })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function deleteReviewById(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) throw error
}
