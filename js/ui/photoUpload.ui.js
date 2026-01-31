export function createPhotoUploadController({ photoInputEl, photoPreviewEl }) {
  let selectedFiles = []

  function isValidImageFile(file) {
    if (!file) return false
    if (!file.type?.startsWith('image/')) return false
    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) return false
    return true
  }

  function renderPhotoPreview() {
    if (!photoPreviewEl) return
    photoPreviewEl.innerHTML = ''

    selectedFiles.forEach((file, idx) => {
      const url = URL.createObjectURL(file)
      const div = document.createElement('div')
      div.className = 'thumb'
      div.innerHTML = `
        <img src="${url}" alt="preview"/>
        <button type="button" aria-label="삭제">×</button>
      `
      div.querySelector('button').onclick = () => {
        selectedFiles.splice(idx, 1)
        renderPhotoPreview()
      }
      photoPreviewEl.appendChild(div)
    })
  }

  photoInputEl?.addEventListener('change', () => {
    const files = Array.from(photoInputEl.files || [])
    const valid = files.filter(isValidImageFile).slice(0, 5)
    selectedFiles = valid
    renderPhotoPreview()
  })

  function getFiles() {
    return selectedFiles
  }

  function reset() {
    selectedFiles = []
    if (photoInputEl) photoInputEl.value = ''
    renderPhotoPreview()
  }

  // init
  renderPhotoPreview()

  return { getFiles, reset, renderPhotoPreview }
}
