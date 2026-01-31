// js/utils/foodCategory.util.js
export function mapFoodCategory(raw, placeName) {
  const v = String(raw ?? '').trim()
  const n = String(placeName ?? '').trim()

  // 둘 다 비면 기타
  if (!v && !n) return '기타'

  // 검사 문자열(원본 + 상호) 합쳐서 한 번에 매칭
  const s = `${v} ${n}`

  // ===== 1) 우선순위 높은 것들(명확 키워드) =====
  if (hasAny(s, ['김밥', '김밥천국', '김밥나라'])) return '김밥'
  if (hasAny(s, ['치킨', '통닭', '닭강정'])) return '치킨'
  if (hasAny(s, ['피자'])) return '피자'
  if (hasAny(s, ['버거', '햄버거'])) return '햄버거'
  if (hasAny(s, ['초밥', '스시', '회전초밥', '돈까스', '라멘', '우동', '일식'])) return '일식'
  if (hasAny(s, ['중식', '중국', '짜장', '짬뽕', '마라', '훠궈'])) return '중식'
  if (hasAny(s, ['파스타', '스테이크', '리조또', '양식', '경양식'])) return '양식'
  if (hasAny(s, ['횟집', '회', '참치', '수산', '어시장'])) return '횟집'

  // ===== 2) 고기(회/참치 같은 “회”보다 아래) =====
  if (hasAny(s, ['고기', '갈비', '삼겹', '돼지', '소고기', '한우', '숯불', '바베큐', '불고기'])) return '고기'

  // ===== 3) 카페/베이커리 =====
  // 베이커리 먼저(카페가 함께 들어간 이름 많음)
  if (hasAny(s, ['베이커리', '제과', '빵집', '파티세리'])) return '베이커리카페'
  if (hasAny(s, ['카페', '커피', '로스터', '디저트'])) return '카페전문점'
  if (hasAny(s, ['전통찻집', '찻집', '다방'])) return '전통찻집'

  // ===== 4) 술집 =====
  if (hasAny(s, ['주점', '호프', '포차', '이자카야', '바', '펍'])) return '술집'

  // ===== 5) 외국/아시아 =====
  if (hasAny(s, ['베트남', '쌀국수', '태국', '팟타이', '인도', '커리', '멕시칸', '타코', '터키', '케밥', '외국', '아시아'])) {
    return '아시아/외국음식'
  }

  // ===== 6) 분식 =====
  if (hasAny(s, ['분식', '떡볶이', '순대', '튀김'])) return '분식(기타)'

  // ===== 7) 한식(가장 넓어서 뒤쪽) =====
  if (hasAny(s, ['한식', '국밥', '해장국', '백반', '찌개', '김치', '냉면', '칼국수', '비빔밥', '정식', '탕', '찜'])) {
    return '한식'
  }

  return '기타'
}

function hasAny(str, keywords) {
  return keywords.some(k => str.includes(k))
}
