// js/tags.js
export const TAGS = {
  situations: [
    { key: "solo", label: "혼자 먹기", icon: "👤" },
    { key: "rain", label: "비 오는 날", icon: "☔" },
    { key: "date", label: "데이트", icon: "❤️" },
    { key: "safe", label: "실패 없음", icon: "✅" },
  ],

  // ✅ DB의 category/subcategory/...에서 최종 category 문자열과 "완전 동일"해야 함
  // (폐하 index.js에서 category 만들 때 (row.subcategory || row.category || ...)로 만든 그 값)
  foods: [
    { key: "한식", label: "한식" },
    { key: "중식", label: "중식" },
    { key: "일식", label: "일식" },
    { key: "양식", label: "양식" },
    { key: "분식(기타)", label: "분식(기타)" },
    { key: "김밥", label: "김밥" },
    { key: "치킨", label: "치킨" },
    { key: "피자", label: "피자" },
    { key: "햄버거", label: "햄버거" },
    { key: "고기", label: "고기" },
    { key: "횟집", label: "횟집" },
    { key: "외국음식", label: "외국음식" },
    { key: "전통찻집", label: "전통찻집" },
    { key: "카페전문점", label: "카페전문점" },
    { key: "베이커리카페", label: "베이커리카페" },
    { key: "술집", label: "술집" },
    { key: "기타", label: "기타" },
  ],
}
