import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { PROJECTS, type Project, type ProjectId } from '../data'
import { createGlide, type Fly } from '../hooks'
import { CloseButton, CyclingImage } from './shared'

/** A new object per open, so reopening the same project replays the intro. */
export type ProjectSession = { id: ProjectId; trigger: HTMLElement }

export function ProjectViewer({ session, open, onClose, onLift, fly, cancelFly, flying }: {
  session: ProjectSession | null
  open: boolean
  onClose: () => void
  /** the garment has left its place in the scene (id), or is back (null) */
  onLift: (id: ProjectId | null) => void
  fly: Fly
  cancelFly: () => void
  /** the flying copy's current rect, if it's still in the air */
  flying: () => DOMRect | null
}) {
  const project: Project | null = session ? PROJECTS[session.id] : null
  const [garmentVisible, setGarmentVisible] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const cornerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // vertical wheel pans the gallery; mouse drag with momentum (touch scrolls natively)
  useEffect(() => {
    const el = scrollRef.current!
    let dragging = false, startX = 0, startScroll = 0
    const glide = createGlide((dx) => { el.scrollLeft -= dx })

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return // horizontal trackpad swipes scroll natively
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      dragging = true
      el.classList.add('dragging')
      startX = e.clientX
      startScroll = el.scrollLeft
      glide.start(e.clientX)
      el.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      glide.track(e.clientX)
      el.scrollLeft = startScroll - (e.clientX - startX)
    }
    const onUp = () => {
      if (!dragging) return
      dragging = false
      el.classList.remove('dragging')
      glide.release(2.2, 0.93, 0.5)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      glide.stop()
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [])

  // pad the track so the first page opens centred on screen (page widths vary, so this is measured)
  useEffect(() => {
    const scroller = scrollRef.current!
    const track = trackRef.current!
    const centre = () => {
      const first = track.firstElementChild as HTMLElement | null
      if (first) track.style.paddingLeft = `${Math.max(0, (scroller.clientWidth - first.offsetWidth) / 2)}px`
    }
    centre()
    const ro = new ResizeObserver(centre)
    ro.observe(scroller)
    return () => ro.disconnect()
  }, [project])

  // intro: reset, then fly the clicked garment into the corner
  useEffect(() => {
    if (!open || !session) return
    const p: Project = PROJECTS[session.id]
    setGarmentVisible(false)
    const el = scrollRef.current!
    el.scrollLeft = 0
    el.focus({ preventScroll: true })

    const raf = requestAnimationFrame(() => {
      if (p.flight) {
        // the scene garment itself lifts off: the flying copy starts exactly on it, then it hides
        fly(session.trigger.getBoundingClientRect(), cornerRef.current!.getBoundingClientRect(), p.flight, {
          fromFilter: getComputedStyle(session.trigger).filter,
          onStart: () => onLift(session.id),
          // committed right away so the corner starts fading in on the same frame the copy starts fading out
          onLand: () => flushSync(() => setGarmentVisible(true)),
          dissolve: true,
        })
      } else if (p.garment) {
        setGarmentVisible(true)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [open, session, fly, onLift])

  const handleClose = useCallback(() => {
    // closed mid-flight: turn around from wherever the copy is instead of making it vanish
    const from = garmentVisible ? cornerRef.current!.getBoundingClientRect() : flying()
    if (from && session && project?.flight) {
      // fly back, turning in reverse, and settle exactly onto its place in the scene, which then reappears
      fly(from, session.trigger.getBoundingClientRect(), [...project.flight].reverse(), {
        toFilter: getComputedStyle(session.trigger).filter,
        onLand: () => onLift(null),
      })
    } else {
      cancelFly()
      onLift(null)
    }
    setGarmentVisible(false)
    onClose()
  }, [garmentVisible, session, project, fly, cancelFly, flying, onClose, onLift])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  return (
    <div id="project-viewer" className={open ? 'open' : undefined} role="dialog" aria-modal="true" aria-label={project?.heading} inert={!open}>
      <div className="project-heading bodoni">{project?.heading}</div>
      <CloseButton label="Close project" onClick={handleClose} />

      <div id="board-scroll" ref={scrollRef} tabIndex={-1}>
        <div id="board-track" ref={trackRef}>
          {project?.pages.map((page, i) => (
            <img
              key={page.src}
              src={page.src}
              width={page.width}
              height={page.height}
              style={{ '--ratio': page.width / page.height } as CSSProperties}
              alt={`${project.heading}, page ${i + 1}`}
              decoding="async"
              draggable={false}
            />
          ))}
        </div>
      </div>
      <div className="scroll-hint bodoni">SCROLL TO EXPLORE →</div>

      {/* persistent corner garment, beside the board so it never covers it */}
      <div id="corner-garment" ref={cornerRef} className={project?.cornerScale === 1.25 ? 'cg-scale-125' : undefined}>
        <div className="cg-inner">
          <CyclingImage id="cg-frame" frames={project?.garment ?? []} active={garmentVisible} className={garmentVisible ? 'show' : undefined} />
        </div>
      </div>
    </div>
  )
}
