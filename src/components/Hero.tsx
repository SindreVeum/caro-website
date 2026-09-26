import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { HERO_GARMENTS, sceneImage, type HeroGarment, type ProjectId } from '../data'
import { HeroPhoto } from './shared'

const MASK_WIDTH = 200
const ALPHA_HIT = 16 // low enough that sheer mesh and lace count as garment
const HIT_SLOP = 5 // px of forgiveness around the silhouette, for the small garments

type Mask = { alpha: Uint8ClampedArray; width: number; height: number }

/** Downsampled alpha channel of a loaded cut-out, for hit-testing its actual silhouette. */
function readMask(img: HTMLImageElement): Mask | null {
  const width = MASK_WIDTH
  const height = Math.round((width * img.naturalHeight) / img.naturalWidth)
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx || !height) return null
  ctx.canvas.width = width
  ctx.canvas.height = height
  ctx.drawImage(img, 0, 0, width, height)
  return { alpha: ctx.getImageData(0, 0, width, height).data, width, height }
}

/** topmost first */
const HIT_ORDER = [...HERO_GARMENTS].reverse()

const layerStyle = (g: HeroGarment) => ({ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%` }) as CSSProperties

/** The garments as they sit in the backdrop behind open overlays (not interactive). */
export function SceneGarments({ lifted }: { lifted: ProjectId | null }) {
  return HERO_GARMENTS.map((g) => (
    <div key={g.project} className={`garment${g.inside ? ' inside' : ''}${lifted === g.project ? ' lifted' : ''}`} style={layerStyle(g)}>
      <img src={sceneImage(g)} alt="" draggable={false} />
    </div>
  ))
}

export function Hero({ lifted, onOpenProject }: {
  /** the garment currently flown out of the scene */
  lifted: ProjectId | null
  onOpenProject: (id: ProjectId, trigger: HTMLElement) => void
}) {
  const imgs = useRef(new Map<ProjectId, HTMLImageElement>())
  const masks = useRef(new Map<ProjectId, Mask>())
  const [hovered, setHovered] = useState<ProjectId | null>(null)
  // hover tip follows the cursor above garments; moved directly so mouse moves don't re-render
  const tipRef = useRef<HTMLDivElement>(null)
  const [tipLabel, setTipLabel] = useState('')

  /** topmost garment whose opaque pixels are under the point */
  const hitTest = (x: number, y: number) => {
    for (const g of HIT_ORDER) {
      const img = imgs.current.get(g.project)
      const mask = masks.current.get(g.project)
      if (!img || !mask || g.project === lifted) continue
      const r = img.getBoundingClientRect()
      if (x < r.left - HIT_SLOP || x > r.right + HIT_SLOP || y < r.top - HIT_SLOP || y > r.bottom + HIT_SLOP) continue
      const scale = mask.width / r.width
      const mx = Math.floor((x - r.left) * scale)
      const my = Math.floor((y - r.top) * scale)
      const slop = Math.min(8, Math.ceil(HIT_SLOP * scale))
      for (let dy = -slop; dy <= slop; dy++) {
        for (let dx = -slop; dx <= slop; dx++) {
          const px = mx + dx, py = my + dy
          if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) continue
          if (mask.alpha[(py * mask.width + px) * 4 + 3] > ALPHA_HIT) return g
        }
      }
    }
    return null
  }

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const g = hitTest(e.clientX, e.clientY)
    setHovered(g?.project ?? null)
    if (!g) return
    setTipLabel(g.label)
    const tip = tipRef.current
    if (tip) {
      tip.style.left = `${e.clientX}px`
      tip.style.top = `${e.clientY}px`
    }
  }

  const open = (g: HeroGarment) => {
    const img = imgs.current.get(g.project)
    if (!img) return
    setHovered(null)
    onOpenProject(g.project, img)
  }

  const onClick = (e: MouseEvent) => {
    const g = hitTest(e.clientX, e.clientY)
    if (g) open(g)
  }

  const hoveredGarment = HERO_GARMENTS.find((g) => g.project === hovered)

  return (
    <>
      <section id="hero" className="scene">
        <HeroPhoto
          className={hovered ? 'has-hover' : undefined}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHovered(null)}
          onClick={onClick}
        >
          {HERO_GARMENTS.map((g) => (
            // pointer input is hit-tested on the silhouette above; the button is for keyboard and screen readers
            <button
              key={g.project}
              type="button"
              className={`garment${g.inside ? ' inside' : ''}${hovered === g.project ? ' hover' : ''}${lifted === g.project ? ' lifted' : ''}`}
              style={layerStyle(g)}
              aria-label={`Open ${g.label}`}
              onClick={(e) => { e.stopPropagation(); open(g) }}
            >
              <img
                ref={(el) => { if (el) imgs.current.set(g.project, el); else imgs.current.delete(g.project) }}
                src={sceneImage(g)}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const mask = readMask(e.currentTarget)
                  if (mask) masks.current.set(g.project, mask)
                }}
              />
            </button>
          ))}
        </HeroPhoto>

        <p id="hero-cue">CLICK ON A <br />GARMENT TO <br />SEE PROJECT</p>

        <div id="hero-identity">
          <h1 id="hero-name" className="script">Caroline Ehrngren</h1>
          <p id="hero-title" className="bodoni">Fashion Designer &amp; Product Developer</p>
        </div>
      </section>

      <div id="hover-tip" ref={tipRef} className={hoveredGarment ? 'bodoni show' : 'bodoni'} aria-hidden="true">
        {hoveredGarment?.label ?? tipLabel}
      </div>
    </>
  )
}
