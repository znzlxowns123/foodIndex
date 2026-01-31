import { getEditorKey } from '../utils/storageKeys.util.js'
import { submitPlaceEdit } from '../api/edits.api.js'

export function createSuggestBox({
  manageNo,
  suggestBoxEl,
  suggestTitleEl,
  suggestHintEl,
  suggestInputEl,
  suggestSubmitEl,
  suggestCloseEl,

  // ✅ 추가: 제보 성공 콜백(선택)
  onSubmitted
}) {
  let suggestField = null

  function openSuggest(field) {
    suggestField = field
    if (!suggestBoxEl) return

    const labelMap = {
      phone_public: '전화번호 제보',
      open_hours_text: '영업시간 제보',
      menu_summary: '대표 메뉴 제보',
      menu_photo_url: '메뉴 사진 URL 제보'
    }

    suggestTitleEl.textContent = labelMap[field] || '정보 제보'

    if (field === 'phone_public') {
      suggestHintEl.textContent = '예: 02-123-4567 (모르면 지도에서 확인 후 입력)'
      suggestInputEl.placeholder = '전화번호'
    } else if (field === 'open_hours_text') {
      suggestHintEl.textContent = '예: 매일 11:00-21:00 / 브레이크 15:00-17:00 / 일요일 휴무'
      suggestInputEl.placeholder = '영업시간'
    } else if (field === 'menu_summary') {
      suggestHintEl.textContent = '예: 냉면, 칼국수, 만두 (대표 2~5개)'
      suggestInputEl.placeholder = '대표 메뉴'
    } else {
      suggestHintEl.textContent = '예: https://... (임시)'
      suggestInputEl.placeholder = 'URL'
    }

    suggestInputEl.value = ''
    suggestBoxEl.hidden = false
    suggestInputEl.focus()
  }

  function closeSuggest() {
    if (!suggestBoxEl) return
    suggestBoxEl.hidden = true
    suggestField = null
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest]')
    if (btn) openSuggest(btn.getAttribute('data-suggest'))
  })

  suggestCloseEl?.addEventListener('click', closeSuggest)

  suggestSubmitEl?.addEventListener('click', async () => {
    if (!manageNo) return
    if (!suggestField) return

    const v = (suggestInputEl.value ?? '').trim()
    if (v.length < 2) return alert('내용을 조금만 더 자세히 적어줘.')

    suggestSubmitEl.disabled = true
    suggestSubmitEl.textContent = '제보중...'

    try {
      const editorKey = getEditorKey()
      await submitPlaceEdit({
        manageNo,
        fieldName: suggestField,
        newValue: v,
        editorKey
      })

      // ✅ 추가: 성공시 콜백으로 즉시 화면 반영 가능
      try {
        if (typeof onSubmitted === 'function') {
          await onSubmitted({ field: suggestField, value: v, manageNo })
        }
      } catch (e2) {
        console.warn('[onSubmitted failed]', e2)
      }

      alert('제보가 접수됐어요!')
      closeSuggest()
    } catch (err) {
      console.error(err)
      alert(`제보 실패: ${err.message || '콘솔 확인'}`)
    } finally {
      suggestSubmitEl.disabled = false
      suggestSubmitEl.textContent = '제보하기'
    }
  })

  return { openSuggest, closeSuggest }
}
