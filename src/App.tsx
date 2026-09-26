import { useCallback, useEffect, useState } from 'react'
import { CAROUSEL_CORNER_FRAMES, PROJECTS, SOCIAL_PHOTOS, type Project, type ProjectId } from './data'
import { useFlyGarment } from './hooks'
import { BelowFold } from './components/BelowFold'
import { CarouselViewer } from './components/CarouselViewer'
import { Hero, SceneGarments } from './components/Hero'
import { ProjectViewer, type ProjectSession } from './components/ProjectViewer'
import { HeroPhoto } from './components/shared'

export default function App() {
  const [session, setSession] = useState<ProjectSession | null>(null)
  const [projectOpen, setProjectOpen] = useState(false)
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [lifted, setLifted] = useState<ProjectId | null>(null)
  const flyer = useFlyGarment()

  // fetch and decode what the overlays show while idle, so nothing pops in when one opens:
  // flight and corner frames first, then the opening pages of each project and the carousel photos
  useEffect(() => {
    const warm = () => {
      const projects: Project[] = Object.values(PROJECTS)
      const srcs = [
        ...projects.flatMap((p) => [...(p.flight ?? []), ...(p.garment ?? [])]),
        ...projects.flatMap((p) => p.pages.slice(0, 2).map((page) => page.src)),
        ...CAROUSEL_CORNER_FRAMES,
        ...SOCIAL_PHOTOS,
      ]
      for (const src of srcs) {
        const img = new Image()
        img.src = src
        img.decode().catch(() => {})
      }
    }
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(warm, { timeout: 2000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(warm, 1000)
    return () => clearTimeout(id)
  }, [])

  const overlayOpen = projectOpen || carouselOpen
  useEffect(() => {
    document.body.classList.toggle('locked', overlayOpen)
  }, [overlayOpen])

  const openProject = useCallback((id: ProjectId, trigger: HTMLElement) => {
    setSession({ id, trigger })
    setProjectOpen(true)
  }, [])
  const closeProject = useCallback(() => setProjectOpen(false), [])
  const openCarousel = useCallback(() => setCarouselOpen(true), [])
  const closeCarousel = useCallback(() => setCarouselOpen(false), [])

  return (
    <>
      <Hero lifted={lifted} onOpenProject={openProject} />
      <BelowFold onOpenProject={openProject} onOpenCarousel={openCarousel} />

      {/* dimmed hero behind the overlays, so opening one never scrolls the page */}
      <div id="backdrop" className={overlayOpen ? 'scene open' : 'scene'} aria-hidden="true">
        <HeroPhoto>
          <SceneGarments lifted={lifted} />
        </HeroPhoto>
      </div>

      <ProjectViewer session={session} open={projectOpen} onClose={closeProject} onLift={setLifted} fly={flyer.fly} cancelFly={flyer.cancel} flying={flyer.flying} />
      <CarouselViewer open={carouselOpen} onClose={closeCarousel} />

      <div id="fly-garment" ref={flyer.ref} aria-hidden="true" />
    </>
  )
}
