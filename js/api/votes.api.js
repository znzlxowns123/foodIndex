import { supabase } from './supabaseClient.js'

export async function voteReview({ reviewId, voterKey, voteType }) {
  const row = {
    review_id: reviewId,
    voter_key: voterKey,
    vote_type: voteType, // 'up' | 'down'
  }

  const { error } = await supabase.from('review_votes').insert(row)

  if (!error) return { ok: true }

  // 결과적으로 UNIQUE 충돌(이미 투표함) 케이스를 식별
  const msg = String(error.message || '').toLowerCase()
  const code = String(error.code || '')

  // supabase/postgres에서 중복은 보통 23505(Unique violation)
  const isAlready =
    code === '23505' ||
    msg.includes('duplicate') ||
    msg.includes('unique') ||
    msg.includes('already') ||
    msg.includes('violates unique constraint')

  if (isAlready) {
    const e = new Error('ALREADY_VOTED')
    e.name = 'ALREADY_VOTED'
    throw e
  }

  throw error
}
