// js/api/placePhotos.api.js
import { supabase } from './supabaseClient.js'

const BUCKET = 'place_photos'

function prettyErr(e) {
  if (!e) return 'unknown error'
  const msg = e.message || e.error_description || String(e)
  const details = e.details ? `\n(details) ${e.details}` : ''
  const hint = e.hint ? `\n(hint) ${e.hint}` : ''
  const code = e.code ? `\n(code) ${e.code}` : ''
  return `${msg}${details}${hint}${code}`
}

// manageNo 대표사진 1장 가져오기
export async function fetchCoverPhoto(manageNo) {
  const { data, error } = await supabase
    .from('place_photos')
    .select('photo_path')
    .eq('manage_no', manageNo)
    .eq('is_cover', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error

  const path = data?.[0]?.photo_path
  if (!path) return null

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return urlData?.publicUrl || null
}

// 파일 업로드 + 대표사진 등록
export async function uploadCoverPhoto({ manageNo, file }) {
  if (!manageNo) throw new Error('manageNo is required')
  if (!file) throw new Error('file is required')

  // ✅ 로그인 체크
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(`AUTH ERROR:\n${prettyErr(authErr)}`)
  const uid = authData?.user?.id
  if (!uid) throw new Error('LOGIN_REQUIRED (no user)')

  // ✅ Storage 업로드
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`
  const path = `${manageNo}/${filename}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
    })

  if (upErr) {
    // ✅ 여기서 터지면 "storage.objects" RLS 문제임
    throw new Error(`STORAGE UPLOAD FAIL:\n${prettyErr(upErr)}`)
  }

  // ✅ DB insert
  const payload = {
    manage_no: manageNo,
    photo_path: path,
    is_cover: true,
    user_id: uid,
  }

  const { error: insErr } = await supabase.from('place_photos').insert(payload)

  if (insErr) {
    // ✅ 여기서 터지면 "place_photos" RLS / 컬럼 문제임
    throw new Error(`DB INSERT FAIL:\n${prettyErr(insErr)}\n\npayload:\n${JSON.stringify(payload, null, 2)}`)
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return urlData?.publicUrl || null
}
