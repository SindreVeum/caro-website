// Builds web-ready images in public/img from the originals in assets/.
// Run with `npm run images` whenever an original changes.
import sharp from 'sharp'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const OUT = 'public/img'
// Drive files are named asset-<hash>.<ext>; other files in assets/ are referenced by their full name
const src = (f) => `assets/${/^[0-9a-f]{10}\./.test(f) ? `asset-${f}` : f}`
const webp = { quality: 82, alphaQuality: 90, effort: 5 }

// board strips: pages separated by fully transparent gaps
const BOARDS = {
  esmod: 'fc16e87112.png',
  livyCyclone: '3bbfceb80d.png',
  livyBloom: 'af37a9df7b.png',
  cvmindmap: '23d59a8119.png',
}

// output path -> [source, resize]
const SINGLES = {
  // the hero scene: empty room, garments are layered on top as cut-outs
  'hero.webp': ['bakground-caro.png'],
  'cv-plaque.webp': ['f1379c86f9.png'],
  'social-carousel.webp': ['0421561489.webp'],
  'carousel/1.webp': ['658e73e05f.png'],
  'carousel/2.webp': ['1587c35645.png'],
  'carousel/3.webp': ['7874ba2f19.png'],
  'carousel/4.webp': ['1696793614.png'],
  'garments/esmod-1.webp': ['a00ba0f944.png', { height: 800 }],
  'garments/esmod-2.webp': ['c532b76808.png', { height: 800 }],
  'garments/esmod-3.webp': ['90a488924b.png', { height: 800 }],
  'garments/esmod-4.webp': ['1b5f341df0.png', { height: 800 }],
  'garments/cyclone-1.webp': ['8065a75bd6.png', { height: 800 }],
  'garments/cyclone-2.webp': ['2b0a5bd266.png', { height: 800 }],
  'garments/cyclone-3.webp': ['935e3defdf.png', { height: 800 }],
  'garments/bloom-1.webp': ['e3d578b3ca.png', { height: 800 }],
  'garments/bloom-2.webp': ['601d1dcdc3.png', { height: 800 }],
  'garments/bloom-3.webp': ['bc06a269db.png', { height: 800 }],
  'garments/bloom-still.webp': ['ac84d67364.png', { height: 800 }],
}

// turn sheets: one image with the views side by side (any order), split into frames that turn
// side -> front, ordered by width (the side view is the narrowest, the front the widest). Frames share one canvas, pinned at the hanger hook, framed like `match` (the front
// cut-out already used elsewhere) so the turn ends exactly on it.
const TURNS = {
  bloom: { sheet: 'black garmet 1.png', match: 'ac84d67364.png' },
  cyclone: { sheet: 'black garmet 2.png', match: '8065a75bd6.png' },
}

const SOCIAL = [
  '7c2251534f.jpg', '9efcd42b30.jpg', 'bd6591c000.jpg', '8f10ebdfdd.jpg', 'b5d081e9b3.jpg', 'f13f4c2d33.jpg',
  '1aaf11add2.jpg', '8f1e73a148.jpg', '22f554e449.jpg', '66d993fd25.jpg', 'b839d20ad8.jpg', '8d1e3adfc0.jpg',
  '938517c59f.jpg', 'd05608db88.jpg', 'e52092390b.jpg', '4d6cb5f8d3.jpg', '062626cb31.jpg', 'c9eae92245.jpg',
  '954393eb3c.jpg', '883cc189a6.jpg', '37fc46384f.jpg', '5f81a787e9.jpg', '8d1f8f0a1e.jpg',
]
SOCIAL.forEach((f, i) => { SINGLES[`social/${String(i + 1).padStart(2, '0')}.webp`] = [f, { width: 480 }] })

async function save(pipeline, out) {
  await mkdir(dirname(`${OUT}/${out}`), { recursive: true })
  return pipeline.webp(webp).toFile(`${OUT}/${out}`)
}

/** Cuts a board strip into its pages, sharing one vertical crop so pages keep their relative size. */
async function splitBoard(name, file) {
  const { data, info } = await sharp(src(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const filled = new Uint8Array(width)
  let top = height, bottom = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 8) {
        filled[x] = 1
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }

  const runs = []
  for (let x = 0; x < width; x++) {
    if (!filled[x]) continue
    const last = runs.at(-1)
    if (last && x - last.end <= 12) last.end = x // bridge hairline gaps inside a page
    else runs.push({ start: x, end: x })
  }

  const pages = []
  for (const { start, end } of runs.filter((r) => r.end - r.start >= 100)) {
    const out = `boards/${name}-${pages.length + 1}.webp`
    const region = { left: start, top, width: end - start + 1, height: bottom - top + 1 }
    await save(sharp(src(file)).extract(region), out)
    pages.push({ src: `/img/${out}`, width: region.width, height: region.height })
  }
  return pages
}

const ALPHA = 8 // ignore near-invisible stray pixels

async function alphaOf(file) {
  const { data, info } = await sharp(src(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const at = (x, y) => data[(y * info.width + x) * info.channels + 3]
  return { at, width: info.width, height: info.height }
}

function bbox({ at, height }, x0, x1) {
  let top = height, bottom = -1, left = x1, right = x0
  for (let y = 0; y < height; y++) {
    for (let x = x0; x <= x1; x++) {
      if (at(x, y) <= ALPHA) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  return { left, top, right, bottom }
}

async function splitTurn(name, { sheet, match }) {
  const a = await alphaOf(sheet)
  const views = []
  for (let x = 0; x < a.width; x++) {
    let filled = false
    for (let y = 0; y < a.height && !filled; y++) filled = a.at(x, y) > ALPHA
    const last = views.at(-1)
    if (filled && last && x - last.end <= 12) last.end = x
    else if (filled) views.push({ start: x, end: x })
  }
  const kept = views.filter((v) => v.end - v.start >= 30).sort((p, q) => (p.end - p.start) - (q.end - q.start))
  for (const v of kept) {
    // hook tip: centre of the topmost solid row
    for (let y = 0; y < a.height && v.hook === undefined; y++) {
      const xs = []
      for (let x = v.start; x <= v.end; x++) if (a.at(x, y) > 60) xs.push(x)
      if (xs.length) v.hook = { x: xs.reduce((s, x) => s + x, 0) / xs.length, y }
    }
  }

  // scale and place so the front view lands exactly on the matching cut-out
  const m = await alphaOf(match)
  const mb = bbox(m, 0, m.width - 1)
  const front = kept.at(-1)
  const fb = bbox(a, front.start, front.end)
  const scale = (mb.bottom - mb.top) / (fb.bottom - fb.top)
  const hook = { x: mb.left + (front.hook.x - fb.left) * scale, y: mb.top + (front.hook.y - fb.top) * scale }

  const frames = kept // side -> front
  await Promise.all(frames.map(async (v, i) => {
    const b = bbox(a, v.start, v.end)
    const w = b.right - b.left + 1
    const piece = await sharp(src(sheet)).extract({ left: b.left, top: b.top, width: w, height: b.bottom - b.top + 1 })
      .resize({ width: Math.round(w * scale) }).png().toBuffer()
    const left = Math.round(hook.x - (v.hook.x - b.left) * scale)
    const top = Math.round(hook.y - (v.hook.y - b.top) * scale)
    const canvas = await sharp({ create: { width: m.width, height: m.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: piece, left, top }]).png().toBuffer()
    await save(sharp(canvas).resize({ height: 800 }), `garments/${name}-turn-${i + 1}.webp`)
  }))
  return frames.length
}

await rm(OUT, { recursive: true, force: true })

for (const [name, turn] of Object.entries(TURNS)) {
  console.log(`${name}: ${await splitTurn(name, turn)} turn frames`)
}

const manifest = {}
for (const [name, file] of Object.entries(BOARDS)) {
  manifest[name] = await splitBoard(name, file)
  console.log(`${name}: ${manifest[name].length} pages`)
}
await writeFile('src/boards.json', JSON.stringify(manifest, null, 2) + '\n')

await Promise.all(Object.entries(SINGLES).map(([out, [file, resize]]) =>
  save(sharp(src(file)).resize({ ...resize, withoutEnlargement: true }), out)))
console.log(`${Object.keys(SINGLES).length} images`)
