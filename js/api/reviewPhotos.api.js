import { supabase } from './supabaseClient.js'

export const REVIEW_PHOTO_BUCKET = 'review-images'

export async function fetchReviewPhotosMap(reviewIds) {
  if (!reviewIds?.length) return new Map()

  const { data, error } = await supabase
    .from('review_photos')
    .select('review_id, url, path')
    .in('review_id', reviewIds)

  if (error) throw error

  const map = new Map()
  for (const row of (data ?? [])) {
    const rid = row.review_id
    if (!rid) continue
    if (!map.has(rid)) map.set(rid, [])
    map.get(rid).push({ url: row.url, path: row.path })
  }
  return map
}

function safeExt(file) {
  const raw = (file?.name || '').split('.').pop() || 'jpg'
  const ext = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext || 'jpg'
}

export async function uploadReviewPhotos({ reviewId, files }) {
  if (!files?.length) return []
  if (!reviewId) throw new Error('reviewId required')

  // ✅ 출시버전: 로그인 필수 (auth.uid 기반 Storage 정책)
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const user = authData?.user
  if (!user) throw new Error('로그인이 필요합니다.')

  // 5장 제한 유지 (원하면 제거 가능)
  const picked = Array.from(files).slice(0, 5)

  const uploaded = []

  for (const file of picked) {
    // (가벼운 안전장치) 이미지 아닌 파일 방지
    if (file?.type && !file.type.startsWith('image/')) continue

    const ext = safeExt(file)
    // ✅ 핵심: auth.uid() 폴더 아래로 업로드해야 Storage RLS 통과
    const path = `${user.id}/${reviewId}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase
      .storage
      .from(REVIEW_PHOTO_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })

    if (upErr) throw upErr

    // ✅ PUBLIC 버킷이면 publicUrl 사용 가능
    const { data } = supabase.storage.from(REVIEW_PHOTO_BUCKET).getPublicUrl(path)
    const url = data?.publicUrl || null

    uploaded.push({ url, path })
  }

  // ✅ review_photos DB 저장 (user_id 포함 필수: RLS 정책 통과)
  if (uploaded.length) {
    const rows = uploaded.map((x) => ({
      review_id: reviewId,
      user_id: user.id,
      url: x.url,
      path: x.path,
    }))

    const { error: insErr } = await supabase.from('review_photos').insert(rows)
    if (insErr) throw insErr
  }

  return uploaded
}

export async function deleteReviewImagesFromStorage(reviewId) {
  if (!reviewId) return

  // ✅ 로그인 필수 (본인 것만 삭제)
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const user = authData?.user
  if (!user) throw new Error('로그인이 필요합니다.')

  // ✅ 본인(user_id) + 해당 리뷰의 사진만 가져오기
  const { data, error } = await supabase
    .from('review_photos')
    .select('path')
    .eq('review_id', reviewId)
    .eq('user_id', user.id)

  if (error) throw error

  const paths = (data ?? [])
    .map((r) => (r.path || '').trim())
    .filter(Boolean)

  if (!paths.length) return

  // ✅ Storage 정책도 "본인 폴더만" 삭제 허용
  const { error: rmErr } = await supabase
    .storage
    .from(REVIEW_PHOTO_BUCKET)
    .remove(paths)

  if (rmErr) throw rmErr
}
