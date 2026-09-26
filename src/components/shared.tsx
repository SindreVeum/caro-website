import type { CSSProperties, HTMLAttributes } from 'react'
import { HERO } from '../data'
import { useFrameCycle } from '../hooks'

export function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="close-x" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#452209" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M4 4L20 20M20 4L4 20" />
      </svg>
    </button>
  )
}

/** An <img> that flip-book animates through frames; isolated so its ticks don't re-render the parent. */
export function CyclingImage({ frames, active, id, className }: {
  frames: readonly string[]
  active: boolean
  id?: string
  className?: string
}) {
  const src = useFrameCycle(frames, active)
  return <img id={id} className={className} src={src} alt="" draggable={false} />
}

/** The hero photo, cropped like background-size: cover but around a focal point, so children positioned in % stay on the photo. */
export function HeroPhoto({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={className ? `hero-photo ${className}` : 'hero-photo'}
      style={{ '--ratio': HERO.width / HERO.height, backgroundImage: `url(${HERO.src})` } as CSSProperties}
    />
  )
}
