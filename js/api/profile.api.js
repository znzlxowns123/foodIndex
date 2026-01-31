import { supabase } from './supabaseClient.js'

const PROFILE_SELECT = 'id, nickname, bio, trust_score, trust_level, review_count, avatar_url'

export async function fetchProfileByNickname(nickname) {
  const { data, error } = await supabase
    .from('fi_profiles')
    .select('id, nickname, bio, trust_score, trust_level, review_count, avatar_url')
    .eq('nickname', nickname)
    .maybeSingle() // ✅ single() 금지 (없으면 null)

  if (error) throw error
  return data
}

// ✅ 내 프로필: uid로 조회
export async function fetchMyProfileByUid(uid) {
  const { data, error } = await supabase
    .from('fi_profiles')
    .select(PROFILE_SELECT)
    .eq('id', uid)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('MY_PROFILE_NOT_FOUND')
  return data
}

// ✅ 내 프로필이 없으면 "최초 1회" 생성
export async function ensureMyProfile({ uid, fallbackNickname }) {
  // 1) 이미 있으면 반환
  const { data: existing, error: exErr } = await supabase
    .from('fi_profiles')
    .select(PROFILE_SELECT)
    .eq('id', uid)
    .maybeSingle()

  if (exErr) throw exErr
  if (existing) return existing

  // 2) 없으면 생성 시도
  const payload = {
    id: uid,
    nickname: fallbackNickname || 'user',
    bio: '',
    trust_score: 0,
    trust_level: '측정중',
    review_count: 0,
    avatar_url: null, // ✅ 추가
  }

  const { data: created, error: insErr } = await supabase
    .from('fi_profiles')
    .insert(payload)
    .select(PROFILE_SELECT)
    .single()

  if (insErr) throw insErr
  return created
}

export async function fetchTrustHistory(profileId, limit = 30) {
  const { data, error } = await supabase
    .from('fi_trust_history')
    .select('delta, score_after, status, reason, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}
