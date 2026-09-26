import boards from './boards.json'

/* Images are generated into public/img from assets/ by `npm run images`. */
const img = (path: string) => `/img/${path}`
const frames = (name: string, count: number) => Array.from({ length: count }, (_, i) => img(`garments/${name}-${i + 1}.webp`))

export const IMAGES = {
  cvPlaque: img('cv-plaque.webp'),
  socialCarousel: img('social-carousel.webp'),
}

export const HERO = {
  src: img('hero.webp'),
  width: 1672,
  height: 941,
}

export type Page = { src: string; width: number; height: number }

export type Project = {
  heading: string
  pages: Page[]
  /** flip-book frames shown in the corner while the project is open */
  garment?: readonly string[]
  /** frames of the garment as it flies from the scene into the corner: first is how it hangs
      in the scene, last matches the corner; several frames make it turn toward you on the way */
  flight?: readonly string[]
  cornerScale?: number
}

const esmodFrames = frames('esmod', 4)
const cycloneFrames = frames('cyclone', 3)
// side view -> front, cut from one sheet by `npm run images`
const turn = (name: string) => Array.from({ length: 3 }, (_, i) => img(`garments/${name}-turn-${i + 1}.webp`))
const bloomTurn = turn('bloom')

export const PROJECTS = {
  esmod: {
    heading: 'ESMOD FINAL PROJECT — GRADUATION COLLECTION',
    pages: boards.esmod,
    garment: esmodFrames,
    flight: [esmodFrames[0]],
    cornerScale: 1.25,
  },
  livyBloom: {
    heading: 'LIVY — BLOOM GARDEN',
    pages: boards.livyBloom,
    garment: frames('bloom', 3),
    flight: bloomTurn,
  },
  livyCyclone: {
    heading: 'LIVY — CYCLONE',
    pages: boards.livyCyclone,
    garment: cycloneFrames,
    flight: turn('cyclone'),
  },
  cvmindmap: {
    heading: 'CV & MINDMAP',
    pages: boards.cvmindmap,
  },
} satisfies Record<string, Project>

export type ProjectId = keyof typeof PROJECTS

export type HeroGarment = {
  project: ProjectId
  label: string
  /** position in % of the photo (height follows the image) */
  x: number
  y: number
  w: number
  /** hangs inside the wardrobe, so it's toned down to match the shade */
  inside?: boolean
}

export const HERO_GARMENTS: HeroGarment[] = [
  { project: 'esmod', label: 'ESMOD Final Project', x: 27.29, y: 24.14, w: 25.32 },
  { project: 'livyCyclone', label: 'LIVY — Cyclone', x: 42.05, y: 37.44, w: 14.24, inside: true },
  { project: 'livyBloom', label: 'LIVY — Bloom Garden', x: 46.52, y: 37.44, w: 13.02, inside: true },
]

/** the cut-out layered on the empty-room photo: the first frame of the project's flight */
export const sceneImage = (g: HeroGarment) => (PROJECTS[g.project] as Project).flight![0]

export const CAROUSEL_CORNER_FRAMES = Array.from({ length: 4 }, (_, i) => img(`carousel/${i + 1}.webp`))

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const SOCIAL_PHOTOS = shuffle(Array.from({ length: 23 }, (_, i) => img(`social/${String(i + 1).padStart(2, '0')}.webp`)))
