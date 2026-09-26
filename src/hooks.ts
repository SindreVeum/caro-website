import { useEffect, useMemo, useRef, useState } from 'react'

/** Steps through `frames` every `ms` while `active`, starting from the first frame; keeps the last frame when paused. */
export function useFrameCycle(frames: readonly string[], active: boolean, ms = 333): string | undefined {
  const [tick, setTick] = useState(0)
  // warm up the frames so swapping them never waits on a load or decode
  useEffect(() => {
    if (!active) return
    for (const src of frames) {
      const img = new Image()
      img.src = src
      img.decode().catch(() => {})
    }
  }, [active, frames])
  useEffect(() => {
    if (!active) return
    setTick(0)
    const id = setInterval(() => setTick((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return frames.length ? frames[tick % frames.length] : undefined
}

const FRAME_MS = 1000 / 60

/**
 * Drag momentum that feels the same at any refresh rate: velocity is measured in time rather than per event,
 * and `friction` is the decay per 60fps frame. Call `track` on every pointer move, `release` on pointer up.
 */
export function createGlide(step: (dx: number) => void) {
  let samples: { x: number; t: number }[] = []
  let raf = 0

  const stop = () => cancelAnimationFrame(raf)
  return {
    stop,
    start(x: number) {
      stop()
      samples = [{ x, t: performance.now() }]
    },
    track(x: number) {
      const t = performance.now()
      samples.push({ x, t })
      while (samples.length > 2 && t - samples[0].t > 50) samples.shift()
    },
    release(gain: number, friction: number, minSpeed: number) {
      const first = samples[0], last = samples.at(-1)
      const now = performance.now()
      samples = []
      // a pointer that paused before letting go shouldn't be thrown
      if (!first || !last || last.t === first.t || now - last.t > 80) return
      let v = ((last.x - first.x) / (last.t - first.t)) * FRAME_MS * gain
      let prev = now
      const frame = (time: number) => {
        const n = Math.max(0, time - prev) / FRAME_MS
        prev = time
        const decay = friction ** n
        step((v * (1 - decay)) / (1 - friction))
        v *= decay
        if (Math.abs(v) >= minSpeed) raf = requestAnimationFrame(frame)
      }
      if (Math.abs(v) >= minSpeed) raf = requestAnimationFrame(frame)
    },
  }
}

export type FlyOptions = {
  /** CSS filters of the source and destination (tone, shadow, outline), blended during the flight */
  fromFilter?: string
  toFilter?: string
  /** called the moment the flying copy covers the source, so the source can hide */
  onStart?: () => void
  /** called on arrival */
  onLand?: () => void
  /** after landing, hold while the destination fades in underneath, then dissolve; otherwise vanish at once */
  dissolve?: boolean
}
export type Fly = (from: DOMRect, to: DOMRect, frames: readonly string[], opts?: FlyOptions) => void

const EASE = 'cubic-bezier(.22,.61,.24,1)'

/** The largest rect with the given aspect ratio that fits centered inside `box`. */
function fit(box: DOMRect, ratio: number) {
  const width = Math.min(box.width, box.height * ratio)
  const height = width / ratio
  return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height }
}

const DURATION = 720
/** the turn happens over this part of the flight (linear time), so it starts and settles with the move */
const TURN_START = 0.08
const TURN_END = 0.78

/**
 * Opacity keyframes that step a stack of frames from the first to the last. Each frame fades in
 * on top of the previous one before that one fades out, so the silhouette never thins mid-blend.
 */
function turnKeyframes(count: number, index: number): Keyframe[] {
  const span = (TURN_END - TURN_START) / (count - 1)
  const mid = (k: number) => TURN_START + span * (k + 0.5) // blend from frame k to k+1
  const w = span * 0.45
  const keys: Keyframe[] = []
  if (index > 0) keys.push({ opacity: 0, offset: mid(index - 1) - w }, { opacity: 1, offset: mid(index - 1) })
  if (index < count - 1) keys.push({ opacity: 1, offset: mid(index) }, { opacity: 0, offset: mid(index) + w * 0.9 })
  const first = keys[0].opacity, last = keys.at(-1)!.opacity
  return [{ opacity: first, offset: 0 }, ...keys, { opacity: last, offset: 1 }]
}

/** Drives the fixed #fly-garment element between two screen rects using a GPU transform (FLIP). */
export function useFlyGarment() {
  const ref = useRef<HTMLDivElement>(null)
  const run = useRef(0)
  const anim = useRef<Animation | null>(null)

  return useMemo(() => {
    const cancel = () => {
      run.current++
      anim.current = null
      const el = ref.current
      if (!el) return
      el.getAnimations({ subtree: true }).forEach((a) => a.cancel())
      el.style.visibility = 'hidden'
    }

    const fly: Fly = async (from, to, frames, { fromFilter, toFilter, onStart, onLand, dissolve } = {}) => {
      const el = ref.current
      if (!el || !frames.length) return
      cancel()
      const id = run.current
      // frames share one canvas, so they stack exactly; later frames sit on top
      const imgs = frames.map((src) => Object.assign(new Image(), { src, alt: '', draggable: false }))
      await Promise.all(imgs.map((img) => img.decode().catch(() => {})))
      if (id !== run.current) return
      el.replaceChildren(...imgs)

      const ratio = imgs[0].naturalWidth / imgs[0].naturalHeight || 1
      const a = fit(from, ratio)
      const b = fit(to, ratio)
      // lay the image out at the larger size and only ever scale it down, so it stays sharp
      const base = a.width > b.width ? a : b
      Object.assign(el.style, {
        left: `${base.left}px`, top: `${base.top}px`, width: `${base.width}px`, height: `${base.height}px`, visibility: 'visible',
      })
      const at = (r: typeof a) => `translate(${r.left - base.left}px, ${r.top - base.top}px) scale(${r.width / base.width})`

      anim.current = el.animate([
        { transform: at(a), filter: fromFilter || 'none' },
        { transform: at(b), filter: toFilter || 'none' },
      ], { duration: DURATION, easing: EASE, fill: 'forwards' })
      if (imgs.length > 1) imgs.forEach((img, i) => img.animate(turnKeyframes(imgs.length, i), { duration: DURATION, fill: 'forwards' }))
      onStart?.()
      await anim.current.finished.catch(() => {})
      if (id !== run.current) return

      onLand?.()
      if (!dissolve) return cancel()
      anim.current = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, delay: 400, easing: 'ease-out', fill: 'forwards' })
      await anim.current.finished.catch(() => {})
      if (id === run.current) cancel()
    }

    return { ref, fly, cancel }
  }, [])
}
