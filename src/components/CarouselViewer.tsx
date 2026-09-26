import { useCallback, useEffect, useRef, useState } from 'react'
import { CAROUSEL_CORNER_FRAMES, IMAGES, SOCIAL_PHOTOS } from '../data'
import { createGlide } from '../hooks'
import { CloseButton, CyclingImage } from './shared'

/** the photo set is repeated so the rail can wrap around seamlessly */
const REPEAT = 5

export function CarouselViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // photos are only rendered once the carousel has been opened
  const [built, setBuilt] = useState(false)
  if (open && !built) setBuilt(true)

  const wrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const rail = useRef({
    offset: 0, dragStartOffset: 0, setWidth: 0, centered: false,
    /** half the rail's width, and each card's center within the track, measured once instead of every frame */
    half: 0, centers: [] as number[],
    /** last distance written per card, so unchanged cards aren't touched */
    norms: [] as number[],
  })

  const measure = useCallback(() => {
    const s = rail.current
    const track = trackRef.current
    const wrap = wrapRef.current
    if (!track || !wrap) return
    const t = track.getBoundingClientRect()
    // scaling a card keeps its center, so these don't depend on the current frame
    s.centers = Array.from(track.children, (card) => {
      const r = card.getBoundingClientRect()
      return r.left + r.width / 2 - t.left
    })
    s.half = wrap.getBoundingClientRect().width * 0.5
    s.setWidth = track.scrollWidth / REPEAT
    s.norms = []
  }, [])

  const applyOffset = useCallback(() => {
    const s = rail.current
    const track = trackRef.current
    if (!track) return

    if (s.setWidth > 0) {
      const shift = s.setWidth * (REPEAT - 2)
      if (s.offset > -s.setWidth) {
        s.offset -= shift
        s.dragStartOffset -= shift
      } else if (s.offset < -s.setWidth * (REPEAT - 1)) {
        s.offset += shift
        s.dragStartOffset += shift
      }
    }
    track.style.transform = `translateX(${s.offset}px)`

    // scale and fade cards by distance from the center (computed, no layout reads)
    const cards = track.children as HTMLCollectionOf<HTMLElement>
    if (s.centers.length !== cards.length) measure()
    if (!s.half) return
    for (let i = 0; i < cards.length; i++) {
      const norm = Math.min(Math.abs(s.offset + s.centers[i]) / s.half, 1)
      if (s.norms[i] === norm) continue
      s.norms[i] = norm
      const card = cards[i]
      card.style.transform = `scale(${1.18 - norm * 0.42})`
      card.style.opacity = (1 - norm * 0.55).toFixed(2)
      card.style.zIndex = String(Math.round((1 - norm) * 100))
    }
  }, [measure])

  // wheel + drag with momentum; input only moves the offset, drawing happens once per frame
  useEffect(() => {
    const wrap = wrapRef.current!
    const s = rail.current
    let dragging = false, startX = 0, raf = 0

    const draw = () => { raf = 0; applyOffset() }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw) }
    const glide = createGlide((dx) => { s.offset += dx; applyOffset() })

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      s.offset -= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      schedule()
    }
    const onDown = (e: PointerEvent) => {
      dragging = true
      wrap.classList.add('dragging')
      startX = e.clientX
      s.dragStartOffset = s.offset
      glide.start(e.clientX)
      wrap.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      glide.track(e.clientX)
      s.offset = s.dragStartOffset + (e.clientX - startX)
      schedule()
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      wrap.classList.remove('dragging')
      glide.release(1.8, 0.93, 0.4)
    }

    // cards and gaps are sized in vh/vw, so re-measure whenever the rail or track resizes
    const ro = new ResizeObserver(() => {
      measure()
      if (s.centered) schedule()
    })
    ro.observe(wrap)
    ro.observe(trackRef.current!)

    wrap.addEventListener('wheel', onWheel, { passive: false })
    wrap.addEventListener('pointerdown', onDown)
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerup', onUp)
    wrap.addEventListener('pointercancel', onUp)
    wrap.addEventListener('pointerleave', onUp)
    return () => {
      cancelAnimationFrame(raf)
      glide.stop()
      ro.disconnect()
      wrap.removeEventListener('wheel', onWheel)
      wrap.removeEventListener('pointerdown', onDown)
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerup', onUp)
      wrap.removeEventListener('pointercancel', onUp)
      wrap.removeEventListener('pointerleave', onUp)
    }
  }, [applyOffset, measure])

  // center the rail the first time it opens
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      const s = rail.current
      const track = trackRef.current!
      if (s.centered) return
      measure()
      s.offset = -track.scrollWidth / 2 + 40
      applyOffset()
      s.centered = true
    })
    return () => cancelAnimationFrame(raf)
  }, [open, applyOffset, measure])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div id="carousel-viewer" className={open ? 'open' : undefined} role="dialog" aria-modal="true" aria-label="Social carousel" inert={!open}>
      <CloseButton label="Close carousel" onClick={onClose} />

      <div id="corner-garment-2">
        <CyclingImage id="cg2-frame" frames={CAROUSEL_CORNER_FRAMES} active={open} />
      </div>

      <div id="carousel-stage">
        <img src={IMAGES.socialCarousel} alt="Social carousel" draggable={false} />
      </div>

      <div id="photo-rail-wrap" ref={wrapRef}>
        <div id="photo-track" ref={trackRef}>
          {built && Array.from({ length: REPEAT }, (_, r) =>
            SOCIAL_PHOTOS.map((src) => (
              <div key={`${r}-${src}`} className="photo-card" style={{ backgroundImage: `url(${src})` }} />
            )),
          )}
        </div>
      </div>

      <div className="scroll-hint bodoni" style={{ bottom: '5%' }}>DRAG OR SCROLL TO BROWSE</div>
    </div>
  )
}
