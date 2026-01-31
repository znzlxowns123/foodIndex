// js/utils/tag.util.js
import { TAG_RULES } from '../tags.rules.js'

// 배열(tags) 정리: 치환 + 삭제 + (허용목록 있으면) 필터 + 중복 제거
export function normalizeTags(rawTags) {
  const CANON = TAG_RULES?.CANON ?? {}
  const BLOCKLIST = TAG_RULES?.BLOCKLIST ?? new Set()
  const ALLOWLIST = TAG_RULES?.ALLOWLIST ?? null

  const arr = Array.isArray(rawTags) ? rawTags : []

  const cleaned = arr
    .map(t => String(t ?? '').trim())
    .filter(t => t && !BLOCKLIST.has(t))
    .map(t => CANON[t] ?? t)
    .filter(t => !ALLOWLIST || ALLOWLIST.has(t))

  return [...new Set(cleaned)]
}

// 단일 태그 키 정리(URL/state용): 치환만
export function normalizeTagKey(tag) {
  const t = String(tag ?? '').trim()
  if (!t) return ''
  return (TAG_RULES?.CANON ?? {})[t] ?? t
}
