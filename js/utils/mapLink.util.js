/* js/utils/mapLink.util.js */

/* =========================
   문자열 정리
========================= */
function normalize(str) {
  return String(str ?? '')
    .replaceAll(',', ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* =========================
   주소에서 "○○구" 추출
   ⚠️ \b 사용 금지 (한글에서 안 먹음)
========================= */
function pickGu(address) {
  const a = normalize(address)
  const m = a.match(/([가-힣]+구)/) // ← 핵심 수정
  return m ? m[1] : ''
}

/* =========================
   지도 검색 링크 생성
   1순위: 구 + 상호명
========================= */
export function buildMapLink(placeName, address) {
  const name = normalize(placeName)
  const addr = normalize(address)
  const gu = pickGu(addr)

  let query = ''
  if (gu && name) query = `${gu} ${name}`
  else if (addr && name) query = `${addr} ${name}`
  else query = name || addr

  console.log('[mapLink.util]', { gu, name, addr, query })

  return `https://map.naver.com/v5/search/${encodeURIComponent(query)}`
}
