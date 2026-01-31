export function createLightbox({ lbEl, lbImg, lbCount }) {
  let lbList = []
  let lbIndex = 0

  // zoom state
  let zoomScale = 1
  let zoomTx = 0
  let zoomTy = 0
  let pinchActive = false
  let pinchStartDist = 0
  let pinchStartScale = 1
  let pinchMidStartX = 0
  let pinchMidStartY = 0
  let pinchStartTx = 0
  let pinchStartTy = 0

  function applyZoom() {
    if (!lbImg) return
    lbImg.style.transform = `translate(${zoomTx}px, ${zoomTy}px) scale(${zoomScale})`
    lbImg.style.transformOrigin = 'center center'
    lbImg.style.willChange = 'transform'
  }
  function resetZoom() {
    zoomScale = 1
    zoomTx = 0
    zoomTy = 0
    pinchActive = false
    applyZoom()
  }
  function clampZoom(v, min, max) {
    return Math.min(max, Math.max(min, v))
  }
  function dist(t1, t2) {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.hypot(dx, dy)
  }
  function mid(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
  }

  function render() {
    if (!lbImg) return
    const item = lbList[lbIndex]
    if (!item?.url) return
    lbImg.src = item.url
    resetZoom()
    if (lbCount) lbCount.textContent = `${lbIndex + 1} / ${lbList.length}`
  }

  function open(list, index = 0) {
    if (!lbEl || !lbImg) return
    lbList = list || []
    if (!lbList.length) return

    lbIndex = Math.max(0, Math.min(index, lbList.length - 1))
    lbEl.hidden = false
    lbEl.setAttribute('aria-hidden', 'false')
    render()
  }

  function close() {
    if (!lbEl) return
    lbEl.hidden = true
    lbEl.setAttribute('aria-hidden', 'true')
    lbList = []
    lbIndex = 0
    resetZoom()
  }

  function prev() {
    if (!lbList.length) return
    lbIndex = (lbIndex - 1 + lbList.length) % lbList.length
    render()
  }
  function next() {
    if (!lbList.length) return
    lbIndex = (lbIndex + 1) % lbList.length
    render()
  }

  // click delegate: data-lb
  document.addEventListener('click', (e) => {
    const action = e.target.closest('[data-lb]')?.getAttribute('data-lb')
    if (!action) return
    if (action === 'close') close()
    if (action === 'prev') prev()
    if (action === 'next') next()
  })

  // ESC / arrows
  document.addEventListener('keydown', (e) => {
    if (!lbEl || lbEl.hidden) return
    if (e.key === 'Escape') close()
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  })

  // swipe
  let touchStartX = 0
  let touchStartY = 0
  let touchEndX = 0
  let touchEndY = 0
  let touchActive = false

  function resetTouch() {
    touchStartX = touchStartY = touchEndX = touchEndY = 0
    touchActive = false
  }
  function handleSwipe() {
    const dx = touchEndX - touchStartX
    const dy = touchEndY - touchStartY
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    const SWIPE_MIN = 40
    const SWIPE_RATIO = 1.2
    if (absX < SWIPE_MIN) return
    if (absX < absY * SWIPE_RATIO) return
    if (dx > 0) prev()
    else next()
  }

  lbEl?.addEventListener('touchstart', (e) => {
    if (lbEl.hidden) return
    if (!e.touches || e.touches.length !== 1) return
    touchActive = true
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
    touchEndX = touchStartX
    touchEndY = touchStartY
  }, { passive: true })

  lbEl?.addEventListener('touchmove', (e) => {
    if (!touchActive) return
    if (!e.touches || e.touches.length !== 1) return
    touchEndX = e.touches[0].clientX
    touchEndY = e.touches[0].clientY
  }, { passive: true })

  lbEl?.addEventListener('touchend', () => {
    if (!touchActive) return
    handleSwipe()
    resetTouch()
  }, { passive: true })

  lbEl?.addEventListener('touchcancel', resetTouch, { passive: true })

  // pinch zoom: prevent page zoom
  lbEl?.addEventListener('touchmove', (e) => {
    if (!lbEl || lbEl.hidden) return
    if (e.touches && e.touches.length === 2) e.preventDefault()
  }, { passive: false })

  lbImg?.addEventListener('touchstart', (e) => {
    if (!lbEl || lbEl.hidden) return
    if (!e.touches) return
    if (e.touches.length === 2) {
      pinchActive = true
      pinchStartDist = dist(e.touches[0], e.touches[1])
      pinchStartScale = zoomScale

      const m = mid(e.touches[0], e.touches[1])
      pinchMidStartX = m.x
      pinchMidStartY = m.y

      pinchStartTx = zoomTx
      pinchStartTy = zoomTy
    }
  }, { passive: true })

  lbImg?.addEventListener('touchmove', (e) => {
    if (!pinchActive) return
    if (!e.touches || e.touches.length !== 2) return

    e.preventDefault()

    const nowDist = dist(e.touches[0], e.touches[1])
    const ratio = nowDist / (pinchStartDist || nowDist)
    const nextScale = clampZoom(pinchStartScale * ratio, 1, 3)

    const m = mid(e.touches[0], e.touches[1])
    const dx = m.x - pinchMidStartX
    const dy = m.y - pinchMidStartY

    zoomScale = nextScale
    zoomTx = pinchStartTx + dx
    zoomTy = pinchStartTy + dy

    applyZoom()
  }, { passive: false })

  lbImg?.addEventListener('touchend', (e) => {
    if (!e.touches || e.touches.length < 2) {
      pinchActive = false
      if (zoomScale <= 1) resetZoom()
    }
  }, { passive: true })

  lbImg?.addEventListener('touchcancel', () => {
    pinchActive = false
  }, { passive: true })

  return { open, close, prev, next }
}
