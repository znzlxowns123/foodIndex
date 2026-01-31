// js/utils/topRightUserUI.util.js
import { supabase } from '../api/supabaseClient.js'
import { syncTopRightUserUI } from '../ui/topRightUser.ui.js'

/**
 * 로그인/로그아웃/토큰갱신 때마다 UI 재동기화
 * ✅ "단 하나의 syncTopRightUserUI"만 쓰게 강제
 */
export function bindAuthUIAutoRefresh(opts = {}) {
  // 첫 렌더
  syncTopRightUserUI(opts)

  // 세션 변화 감지
  supabase.auth.onAuthStateChange(() => {
    syncTopRightUserUI(opts)
  })
}
