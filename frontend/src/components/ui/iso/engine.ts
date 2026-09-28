import type { SpriteImage } from './sprite-images'
import { sculptureSurface } from './sculpture-surface'

/* Isometric drawing in the style of an illustrated map: flat colors, a
 * dark outline, three tones per solid, windows drawn floor by floor.
 *
 * Everything is geometry. A building is a stack of solids lofted through
 * rings of points — a prism, a pyramid, a dome, a gable, a mansard — and a
 * facade is a rule that paints a vertical face. Because it is geometry, a
 * building can be drawn turned by a quarter, which a painted sprite cannot.
 *
 * The module keeps one drawing state, set by `renderSprite` around each
 * recipe: recipes call the shape functions below and never touch it. */

export type Pt = [number, number]
type Screen = [number, number]

/** Half a tile on screen: a tile is 64 × 32 px in the 2:1 projection. */
export const HALF_W = 32
export const HALF_H = 16
/** Screen pixels of height per world unit, for normals and light. */
const Z_UNIT = 39.2

/* ── The scale ───────────────────────────────────────────────────────
 * One ruler for every piece, in metres: a tile is an urban lot of 12 m,
 * a storey is 3.5 m. Recipes speak in storeys and metres, never in loose
 * pixels, so a water tank, an awning and a tower all grow together when
 * the ruler changes — and a window is the same size on a shop and on a
 * skyscraper, because it is the same window. */
export const METERS_PER_TILE = 12
export const METERS_PER_FLOOR = 3.5
/** The true vertical scale: a metre up is as long as a metre along. */
const TRUE_PX_PER_METER = Z_UNIT / METERS_PER_TILE
let pxPerMeter = TRUE_PX_PER_METER
/** Height in screen pixels. */
export const meters = (m: number) => m * pxPerMeter
export const floors = (n: number) => n * METERS_PER_FLOOR * pxPerMeter
/** Stretches heights against the ground, for calibrating the look. 1 is
 *  true scale. Sprites already drawn keep the old one. */
export function setVerticalScale(factor: number) { pxPerMeter = TRUE_PX_PER_METER * factor }
/** Columns of a module of `m` metres along a face `len` tiles long. */
const modules = (len: number, m: number) => Math.max(1, Math.round((len * METERS_PER_TILE) / m))
const OUTLINE = '#2a2024'
const VIEW = [0.612, 0.612, 0.5]
const LIGHT = (() => {
  const v = [0.2, 1, 1.3]
  const length = Math.hypot(...v)
  return v.map(c => c / length)
})()

type Mode = 'draw' | 'measure' | 'shadow'

const state = {
  ctx: null as CanvasRenderingContext2D | null,
  ox: 0,
  oy: 0,
  mode: 'draw' as Mode,
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  rng: Math.random,
  /** Local plan coordinates → turned plan coordinates. */
  turn: (p: Pt): Pt => p,
  /** The solids of a recipe, for its shadow and its volume: the plan, the
   *  top, and the volume in tiles² × screen pixels of height. */
  solids: [] as { poly: Pt[]; top: number; volume: number }[],
  /** While drawing, the parts of the recipe waiting to be put in order. */
  parts: null as Part[] | null,
}

/* A part of a recipe, held back so the parts can be painted back to front
 * for the turn being drawn. The order a recipe lists its parts in holds for
 * one turn only: a church tower written after its nave is behind the nave
 * from one side and in front of it from another. */
interface Part {
  minX: number; maxX: number; minY: number; maxY: number
  /** The convex hull of its plan. */
  hull: Pt[]
  /** Bottom and top, in screen pixels of height. */
  z0: number; z1: number
  /** Where it lands on screen, before the sprite's offset. */
  left: number; right: number; top: number; bottom: number
  ground: boolean
  run: () => void
}

function part(points: Pt[], z0: number, z1: number, run: () => void, ground = false) {
  if (state.mode !== 'draw' || !state.parts) return run()
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const across = points.map(([x, y]) => (x - y) * HALF_W), down = points.map(([x, y]) => (x + y) * HALF_H)
  state.parts.push({
    minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), hull: convexHull(points), z0, z1,
    left: Math.min(...across), right: Math.max(...across), top: Math.min(...down) - z1, bottom: Math.max(...down) - z0,
    ground, run,
  })
}

function convexHull(points: Pt[]): Pt[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length < 3) return sorted
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Pt[]) => list.reduce<Pt[]>((out, p) => {
    while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
    out.push(p)
    return out
  }, [])
  const lower = half(sorted), upper = half([...sorted].reverse())
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Which of two plans is nearer the camera, which looks along (1, 1):
 *  1 if a is behind b, -1 if b is behind a, 0 if their plans overlap, and
 *  null when they are side by side and so can never hide each other. A
 *  line that separates the two plans decides; the edges of either hull
 *  and the two axes are the only lines worth trying. */
function planOrder(a: Part, b: Part): 1 | -1 | 0 | null {
  const e = 1e-6
  const axes: Pt[] = [[1, 0], [0, 1]]
  for (const hull of [a.hull, b.hull]) hull.forEach((p, i) => {
    const q = hull[(i + 1) % hull.length]
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > e) axes.push([p[1] - q[1], q[0] - p[0]])
  })
  const verdicts = new Set<number>()
  let separated = false
  for (const [nx, ny] of axes) {
    const along = (hull: Pt[]) => hull.map(([x, y]) => x * nx + y * ny)
    const pa = along(a.hull), pb = along(b.hull)
    const [aMin, aMax, bMin, bMax] = [Math.min(...pa), Math.max(...pa), Math.min(...pb), Math.max(...pb)]
    const scale = Math.hypot(nx, ny) * e
    const low = aMax <= bMin + scale ? 1 : bMax <= aMin + scale ? -1 : 0
    if (!low) continue
    separated = true
    // The camera looks along (1, 1): the far side of the line is behind.
    const facing = nx + ny
    if (Math.abs(facing) > e) verdicts.add(facing > 0 ? low : -low)
  }
  if (!separated) return 0
  // Separated only sideways, or by lines that disagree: never in front of
  // each other on screen.
  return verdicts.size === 1 ? ([...verdicts][0] as 1 | -1) : null
}

/** Ground first, as listed; then, between parts that cover each other on
 *  screen, whatever separates them decides which is behind — a line
 *  between their plans, seen from the camera's side, or one being wholly
 *  underneath the other — and parts that
 *  share their space go bottom up. When two axes disagree, the parts
 *  cannot hide each other, and they are left unordered too.
 *
 *  Pairs that do not meet on screen are left unordered. Ordering them by
 *  plan alone made cycles: a roof garden 190 m up came out behind a tree on
 *  the ground, the tree behind a tower leg, the leg behind the garden, and
 *  every part caught in the loop was painted last, over the rest. */
function paintParts(parts: Part[]) {
  const ground = parts.filter(p => p.ground)
  const standing = parts.filter(p => !p.ground)
  const e = 1e-6
  const meet = (a: Part, b: Part) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  // Per axis: 1 if a lies wholly behind b along it, -1 if b behind a.
  const side = (aMin: number, aMax: number, bMin: number, bMax: number) => aMax <= bMin + e ? 1 : bMax <= aMin + e ? -1 : 0
  const behind = (a: Part, b: Part) => {
    const plan = planOrder(a, b)
    if (plan === null) return false
    const verdicts = [plan, side(a.z0, a.z1, b.z0, b.z1)].filter(v => v)
    // Plan and height that disagree — behind in plan but wholly above, say
    // — mean the two never hide each other; only their boxes meet.
    if (verdicts.length) return verdicts.every(v => v === 1)
    return a.z0 !== b.z0 ? a.z0 < b.z0 : a.minX + a.minY < b.minX + b.minY
  }
  const incoming = standing.map(() => 0)
  const edges = standing.map(() => [] as number[])
  standing.forEach((a, i) => standing.forEach((b, j) => { if (i !== j && meet(a, b) && behind(a, b)) { edges[i].push(j); incoming[j]++ } }))
  const low = (i: number, j: number) => standing[i].z0 - standing[j].z0 || standing[i].minX + standing[i].minY - standing[j].minX - standing[j].minY
  const ready = standing.map((_, i) => i).filter(i => incoming[i] === 0)
  const done = standing.map(() => false)
  const order: Part[] = []
  while (order.length < standing.length) {
    // Parts that pass through each other — boxes on a roof, a mast among
    // them — can still close a loop. Then release the lowest, rearmost part
    // of the loop and go on, rather than painting the loop over everything.
    if (!ready.length) ready.push(standing.map((_, i) => i).filter(i => !done[i]).sort(low)[0])
    ready.sort(low)
    const i = ready.shift()!
    if (done[i]) continue
    done[i] = true
    order.push(standing[i])
    for (const j of edges[i]) if (--incoming[j] === 0 && !done[j]) ready.push(j)
  }
  for (const p of [...ground, ...order]) p.run()
}

export const iso = (x: number, y: number, z = 0): Screen => [state.ox + (x - y) * HALF_W, state.oy + (x + y) * HALF_H - z]
const at = (p: Pt, z = 0) => { const [x, y] = state.turn(p); return iso(x, y, z) }

export function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const channels = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)))
export const shade = (hex: string, f: number) => `rgb(${channels(hex).map(c => clamp(c * f)).join(',')})`
export function mix(a: string, b: string, t: number) {
  const A = channels(a)
  const B = channels(b)
  return '#' + A.map((c, i) => clamp(c + (B[i] - c) * t).toString(16).padStart(2, '0')).join('')
}

function track(points: Screen[]) {
  const b = state.bounds
  for (const [x, y] of points) {
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x)
    b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y)
  }
}

/** A filled and outlined polygon in screen coordinates. */
export function poly(points: Screen[], fill: string | CanvasGradient | null, stroke: string | null = OUTLINE, width = 1) {
  if (state.mode === 'measure') return track(points)
  const ctx = state.ctx
  if (state.mode !== 'draw' || !ctx) return
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke() }
}

export function line(points: Screen[], stroke: string, width = 1, dash?: number[]) {
  if (state.mode === 'measure') return track(points)
  const ctx = state.ctx
  if (state.mode !== 'draw' || !ctx) return
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (dash) ctx.setLineDash(dash)
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke()
  if (dash) ctx.setLineDash([])
}

/* ── Plan shapes, in tiles ───────────────────────────────────────── */

export const rect = (x: number, y: number, w: number, d: number): Pt[] => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]
export const chamfer = (x: number, y: number, w: number, d: number, c: number): Pt[] =>
  [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + d - c], [x + w - c, y + d], [x + c, y + d], [x, y + d - c], [x, y + c]]
export function rounded(x: number, y: number, w: number, d: number, r: number, steps = 3): Pt[] {
  const corners: [number, number, number][] = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + d - r, 0], [x + r, y + d - r, Math.PI / 2], [x + r, y + r, Math.PI]]
  const out: Pt[] = []
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * Math.PI / 2
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return out
}
export const ngon = (cx: number, cy: number, r: number, n: number, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] })
export const centroid = (p: Pt[]): Pt => p.reduce<Pt>((s, [x, y]) => [s[0] + x / p.length, s[1] + y / p.length], [0, 0])
export const scaleAbout = (p: Pt[], k: number, c = centroid(p)): Pt[] => p.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k])
export const rotate = (p: Pt[], angle: number, c = centroid(p)): Pt[] => p.map(([x, y]) => {
  const dx = x - c[0], dy = y - c[1]
  return [c[0] + dx * Math.cos(angle) - dy * Math.sin(angle), c[1] + dx * Math.sin(angle) + dy * Math.cos(angle)]
})
export function inset(p: Pt[], k: number): Pt[] {
  const c = centroid(p)
  return p.map(([x, y]) => {
    const dx = x - c[0], dy = y - c[1], r = Math.hypot(dx, dy)
    return r < 1e-6 ? [x, y] : [x - (dx / r) * k, y - (dy / r) * k]
  })
}

/* ── Solids ──────────────────────────────────────────────────────── */

type V3 = [number, number, number]
export interface SculptureMesh {
  /** Coordinates in tiles, including height. Closed, outward-wound faces. */
  vertices: [number, number, number][]
  faces: number[][]
  normals?: [number, number, number][]
  /** Optional RGB paint (0..1); negative components retain the chosen metal. */
  colors?: [number, number, number][]
}

export type SculptureMaterial = 'gold' | 'silver' | 'bronze' | 'stone' | 'wood' | 'topiary' | 'glass' | 'fire'

const SCULPTURE_FINISH: Record<SculptureMaterial, { color: string; shine: number }> = {
  silver: { color: '#c6ced6', shine: 0.95 },
  gold: { color: '#d8ac50', shine: 0.85 },
  bronze: { color: '#94704e', shine: 0.5 },
  stone: { color: '#d5ccba', shine: 0 },
  wood: { color: '#966039', shine: 0.08 },
  topiary: { color: '#427644', shine: 0 },
  glass: { color: '#83c3ce', shine: 1 },
  fire: { color: '#de7336', shine: 0.48 },
}

/** A closed sculptural mesh, sorted as one part so intersecting curved
 * surfaces can occlude each other correctly in every camera quarter. */
export function sculptureMesh(mesh: SculptureMesh, material: SculptureMaterial) {
  const vertices = mesh.vertices.map(([x, y, z]): V3 => [...state.turn([x, y]), meters(z * METERS_PER_TILE)])
  const plan = convexHull(vertices.map(([x, y]): Pt => [x, y]))
  const zs = vertices.map(v => v[2])
  const z0 = Math.min(...zs), z1 = Math.max(...zs)
  if (state.mode === 'shadow') {
    const volume = Math.abs(mesh.faces.reduce((sum, face) => {
      const a = mesh.vertices[face[0]]
      for (let i = 1; i < face.length - 1; i++) {
        const b = mesh.vertices[face[i]], c = mesh.vertices[face[i + 1]]
        sum += a[0] * (b[1] * c[2] - b[2] * c[1]) / 6
          + a[1] * (b[2] * c[0] - b[0] * c[2]) / 6
          + a[2] * (b[0] * c[1] - b[1] * c[0]) / 6
      }
      return sum
    }, 0))
    state.solids.push({ poly: plan, top: z1, volume: volume * meters(METERS_PER_TILE) })
    return
  }
  part(plan, z0, z1, () => {
    const finish = SCULPTURE_FINISH[material]
    if (state.mode === 'draw' && state.ctx && mesh.normals) {
      const origin = state.turn([0, 0])
      const normals = mesh.normals.map(([x, y, z]): V3 => {
        const p = state.turn([x, y])
        return [p[0] - origin[0], p[1] - origin[1], z]
      })
      const surface = sculptureSurface({ vertices, faces: mesh.faces, normals, colors: mesh.colors }, finish.color,
        ['gold', 'bronze', 'stone', 'wood', 'topiary', 'glass', 'silver', 'fire'].indexOf(material))
      if (surface) {
        state.ctx.drawImage(surface.canvas, state.ox + surface.x, state.oy + surface.y, surface.width, surface.height)
        return
      }
    }
    const faces = mesh.faces.flatMap((face, index) => {
      const points = face.map(i => vertices[i])
      const normal = newell(points.map(([x, y, z]): V3 => [x, y, z / Z_UNIT]))
      if (!normal || dot(normal, VIEW) <= 0) return []
      const center = points.reduce<V3>((s, p) => [s[0] + p[0] / points.length, s[1] + p[1] / points.length, s[2] + p[2] / points.length], [0, 0, 0])
      return [{ points, normal, index, center, depth: center[0] + center[1] + center[2] / Z_UNIT * 0.82 }]
    }).sort((a, b) => a.depth - b.depth)
    for (const f of faces) {
      const screen = f.points.map(([x, y, z]) => iso(x, y, z))
      const sparkle = Math.max(0, dot(f.normal, [0.33, 0.64, 0.69])) ** 18 * finish.shine
      let color = mix(finish.color, material === 'silver' ? '#f2f7ff' : '#fff3cf', sparkle)
      if (material === 'glass') color = mix(color, '#e1faff', (1 - Math.max(0, dot(f.normal, VIEW))) ** 3 * 0.7)
      if (material === 'wood') color = mix(color, '#3e2415', (Math.sin(f.center[2] * 2.5 + f.center[0] * 18) + 1) * 0.14)
      if (material === 'stone' || material === 'topiary') color = mix(color, material === 'stone' ? '#f4edda' : '#9eba69', (Math.sin(f.index * 127.1) + 1) * 0.10)
      if (material === 'fire') {
        const height = Math.max(0, Math.min(1, (f.center[2] - z0) / (z1 - z0)))
        color = height < .55 ? mix('#660509', '#d41c0e', height / .55)
          : height < .79 ? mix('#d41c0e', '#ff7a1f', (height - .55) / .24)
            : mix('#ff7a1f', '#ffe88c', (height - .79) / .21)
        const flameTips = Math.max(0, 1 - Math.abs(height - .17) / .14)
        color = mix(color, '#ffbf4d', flameTips * .92)
      }
      const paint = mesh.colors?.[mesh.faces[f.index][0]]
      if (paint && paint[0] >= 0) color = `#${paint.map(c => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0')).join('')}`
      const fill = shade(color, lightOf(f.normal))
      poly(screen, fill, fill, 0.35)
      if (material === 'topiary' && state.mode === 'draw') {
        const center = screen.reduce<Pt>((s, p) => [s[0] + p[0] / screen.length, s[1] + p[1] / screen.length], [0, 0])
        line([[center[0] - 0.6, center[1] + 0.4], [center[0] + 0.6, center[1] - 0.4]], shade('#a3c477', lightOf(f.normal)), 0.65)
      }
    }
  })
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
function newell(points: V3[]): V3 | null {
  const n: V3 = [0, 0, 0]
  for (let i = 0; i < points.length; i++) {
    const [x1, y1, z1] = points[i]
    const [x2, y2, z2] = points[(i + 1) % points.length]
    n[0] += (y1 - y2) * (z1 + z2); n[1] += (z1 - z2) * (x1 + x2); n[2] += (x1 - x2) * (y1 + y2)
  }
  const l = Math.hypot(...n)
  return l < 1e-9 ? null : [n[0] / l, n[1] / l, n[2] / l]
}
const lightOf = (n: number[]) => Math.max(0.5, Math.min(1.12, 0.6 + 0.48 * dot(n, LIGHT)))

/** A vertical face, handed to a facade rule to paint. */
export interface Face {
  p0: Pt
  p1: Pt
  z0: number
  z1: number
  len: number
  /** Light on this face, as a multiplier for its colors. */
  k: number
  /** Outward horizontal normal. */
  nh: Pt
  color: string
  rand: () => number
}
export type Facade = (face: Face) => void

/** A sloped face, already turned: bottom edge a0–a1, top edge b0–b1. */
export interface Slope { a0: Pt; a1: Pt; b0: Pt; b1: Pt; z0: number; z1: number; k: number; rand: () => number }
export type Skin = (slope: Slope) => void

export interface SolidStyle {
  /** Fine mineral grain over the lit stone faces, baked into the sprite. */
  texture?: 'granite'
  color?: string
  roof?: string
  facade?: Facade
  /** Paints the sloped faces, as `facade` paints the upright ones. */
  skin?: Skin
  cap?: boolean
  /** Inset of a parapet line on the roof, in tiles. */
  parapet?: number
  /** Null lets a detailed skin supply its own panel edges. */
  outline?: string | null
}

export function loft(input: { poly: Pt[]; z: number }[], o: SolidStyle = {}) {
  const rings = input.map(r => ({ poly: r.poly.map(state.turn), z: r.z }))
  const color = o.color ?? '#999999'
  const roof = o.roof ?? mix(color, '#8f8e93', 0.45)
  if (state.mode === 'shadow') {
    // Between two rings the solid is a frustum; the mean of the end areas is
    // close enough for a building.
    const volume = rings.slice(1).reduce((sum, ring, i) =>
      sum + Math.abs(ring.z - rings[i].z) * (planArea(ring.poly) + planArea(rings[i].poly)) / 2, 0)
    state.solids.push({ poly: rings[0].poly, top: Math.max(...rings.map(r => r.z)), volume })
    return
  }
  part(rings.flatMap(r => r.poly), Math.min(...rings.map(r => r.z)), Math.max(...rings.map(r => r.z)), () => paintLoft(rings, o, color, roof))
}

let graniteGrain: HTMLCanvasElement | undefined
function paintGranite(points: Screen[]) {
  if (state.mode !== 'draw' || !state.ctx) return
  if (!graniteGrain) {
    graniteGrain = document.createElement('canvas')
    graniteGrain.width = graniteGrain.height = 128
    const ctx = graniteGrain.getContext('2d')!, pixels = ctx.createImageData(128, 128)
    const random = mulberry(4719)
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const noise = random(), offset = (y * 128 + x) * 4
      const mineral = noise > 0.52 ? 235 : 24
      pixels.data[offset] = mineral; pixels.data[offset + 1] = mineral; pixels.data[offset + 2] = mineral
      pixels.data[offset + 3] = 8 + Math.abs(noise - 0.5) * 45 + 5 * Math.sin(x * 0.16 + Math.sin(y * 0.12))
    }
    ctx.putImageData(pixels, 0, 0)
  }
  const ctx = state.ctx
  ctx.save()
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath(); ctx.clip()
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y
  ctx.fillStyle = ctx.createPattern(graniteGrain, 'repeat')!
  ctx.fillRect(x, y, w, h)
  const sheen = ctx.createLinearGradient(x, y, x + w, y + h)
  sheen.addColorStop(0, 'rgba(232,237,229,0.09)')
  sheen.addColorStop(0.45, 'rgba(232,237,229,0.015)')
  sheen.addColorStop(1, 'rgba(15,21,24,0.12)')
  ctx.fillStyle = sheen; ctx.fillRect(x, y, w, h)
  ctx.restore()
}

function paintLoft(rings: { poly: Pt[]; z: number }[], o: SolidStyle, color: string, roof: string) {
  const all: V3[] = rings.flatMap(r => r.poly.map(([x, y]): V3 => [x, y, r.z / Z_UNIT]))
  const center = all.reduce<V3>((s, p) => [s[0] + p[0] / all.length, s[1] + p[1] / all.length, s[2] + p[2] / all.length], [0, 0, 0])
  const faces: { a0: Pt; a1: Pt; b0: Pt; b1: Pt; z0: number; z1: number; normal: V3; vertical: boolean; depth: number }[] = []
  for (let i = 0; i < rings.length - 1; i++) {
    const lo = rings[i], hi = rings[i + 1], n = lo.poly.length
    const winding = lo.poly.reduce((sum, [x, y], j) => { const q = lo.poly[(j + 1) % n]; return sum + x * q[1] - q[0] * y }, 0)
    for (let j = 0; j < n; j++) {
      const a0 = lo.poly[j], a1 = lo.poly[(j + 1) % n], b1 = hi.poly[(j + 1) % n], b0 = hi.poly[j]
      const quad: V3[] = [[...a0, lo.z / Z_UNIT], [...a1, lo.z / Z_UNIT], [...b1, hi.z / Z_UNIT], [...b0, hi.z / Z_UNIT]]
      let normal = newell(quad)
      if (!normal) continue
      const fc = quad.reduce<V3>((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0])
      const same = (p: Pt, q: Pt) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6
      const vertical = same(a0, b0) && same(a1, b1)
      // Courtyards and H-shaped blocks are concave: their inner walls face
      // toward the plan's centre. Winding, not the centre, defines outside.
      if (vertical ? winding < 0 : dot(normal, [fc[0] - center[0], fc[1] - center[1], fc[2] - center[2]]) < 0) normal = [-normal[0], -normal[1], -normal[2]]
      if (dot(normal, VIEW) <= 0.001) continue
      faces.push({ a0, a1, b0, b1, z0: lo.z, z1: hi.z, normal, vertical, depth: fc[0] + fc[1] + fc[2] * 0.2 })
    }
  }
  faces.sort((a, b) => a.depth - b.depth)
  for (const f of faces) {
    const screen = [iso(...f.a0, f.z0), iso(...f.a1, f.z0), iso(...f.b1, f.z1), iso(...f.b0, f.z1)]
    const k = lightOf(f.normal)
    poly(screen, shade(f.vertical ? color : roof, k), null)
    if (o.texture === 'granite') paintGranite(screen)
    if (!f.vertical && o.skin && state.mode === 'draw') {
      const rand = mulberry(Math.round(f.a0[0] * 977 + f.a0[1] * 131 + f.b1[0] * 61 + f.b1[1] * 17 + f.z0 * 7))
      o.skin({ a0: f.a0, a1: f.a1, b0: f.b0, b1: f.b1, z0: f.z0, z1: f.z1, k, rand })
    }
    if (f.vertical && o.facade && state.mode === 'draw') {
      const nl = Math.hypot(f.normal[0], f.normal[1]) || 1
      // Each face draws its own luck, so a face looks the same every time.
      const rand = mulberry(Math.round(f.a0[0] * 977 + f.a0[1] * 131 + f.a1[0] * 61 + f.a1[1] * 17 + f.z0 * 7))
      o.facade({ p0: f.a0, p1: f.a1, z0: f.z0, z1: f.z1, len: Math.hypot(f.a1[0] - f.a0[0], f.a1[1] - f.a0[1]), k, nh: [f.normal[0] / nl, f.normal[1] / nl], color, rand })
    }
    poly(screen, null, o.outline === undefined ? OUTLINE : o.outline, 0.9)
  }
  const top = rings[rings.length - 1]
  const area = top.poly.reduce((s, [x, y], i) => { const [x2, y2] = top.poly[(i + 1) % top.poly.length]; return s + x * y2 - x2 * y }, 0)
  if (o.cap !== false && Math.abs(area) > 1e-4) {
    poly(top.poly.map(([x, y]) => iso(x, y, top.z)), shade(roof, lightOf([0, 0, 1])), o.outline === undefined ? OUTLINE : o.outline, 0.9)
    if (o.texture === 'granite') paintGranite(top.poly.map(([x, y]) => iso(x, y, top.z)))
    if (o.parapet) poly(inset(top.poly, o.parapet).map(([x, y]) => iso(x, y, top.z)), shade(roof, 0.9), shade(OUTLINE, 1.8), 0.7)
  }
}

export const prism = (p: Pt[], z0: number, h: number, o?: SolidStyle) => loft([{ poly: p, z: z0 }, { poly: p, z: z0 + h }], o)
export function pyramid(p: Pt[], z0: number, h: number, o?: SolidStyle) {
  const c = centroid(p)
  loft([{ poly: p, z: z0 }, { poly: p.map(() => c), z: z0 + h }], { ...o, cap: false })
}
export const mansard = (p: Pt[], z0: number, h: number, k: number, o?: SolidStyle) => loft([{ poly: p, z: z0 }, { poly: inset(p, k), z: z0 + h }], o)
export function dome(p: Pt[], z0: number, h: number, o?: SolidStyle, steps = 6) {
  const rings = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI / 2
    rings.push({ poly: scaleAbout(p, Math.max(0.02, Math.cos(t))), z: z0 + Math.sin(t) * h })
  }
  loft(rings, { ...o, cap: false })
}
/** A gable roof over a rectangle, the ridge along x or along y. */
export function gable(x: number, y: number, w: number, d: number, z0: number, h: number, alongX: boolean, o?: SolidStyle) {
  const ridge: Pt[] = alongX
    ? [[x, y + d / 2], [x + w, y + d / 2], [x + w, y + d / 2], [x, y + d / 2]]
    : [[x + w / 2, y], [x + w / 2, y], [x + w / 2, y + d], [x + w / 2, y + d]]
  loft([{ poly: rect(x, y, w, d), z: z0 }, { poly: ridge, z: z0 + h }], { ...o, cap: false })
}

/* ── Facades ─────────────────────────────────────────────────────── */

const wp = (F: Face, u: number, z: number) => iso(F.p0[0] + (F.p1[0] - F.p0[0]) * u, F.p0[1] + (F.p1[1] - F.p0[1]) * u, z)
const wq = (F: Face, u0: number, u1: number, za: number, zb: number) => [wp(F, u0, za), wp(F, u1, za), wp(F, u1, zb), wp(F, u0, zb)]
const outward = (F: Face, u: number, z: number, d: number) =>
  iso(F.p0[0] + (F.p1[0] - F.p0[0]) * u + F.nh[0] * d, F.p0[1] + (F.p1[1] - F.p0[1]) * u + F.nh[1] * d, z)

export interface Storefront { floors?: number; color: string; glass?: string; awnings?: string[]; trim?: string }

/** A shop floor: glass bays of about 5.5 m, an awning over some of them. */
export function storefront(F: Face, z0: number, h: number, s: Storefront) {
  poly(wq(F, 0, 1, z0, z0 + h), shade(s.color, F.k), null)
  const bays = modules(F.len, 5.5)
  for (let b = 0; b < bays; b++) {
    const u0 = (b + 0.1) / bays, u1 = (b + 0.9) / bays
    poly(wq(F, u0, u1, z0 + meters(0.4), z0 + h - meters(1.4)), shade(s.glass ?? '#2f3a44', F.k), null)
    if (s.awnings && F.rand() > 0.35) {
      const color = s.awnings[Math.floor(F.rand() * s.awnings.length)]
      const top = z0 + h - meters(0.9)
      poly([wp(F, u0, top), wp(F, u1, top), outward(F, u1, top - meters(1.8), 0.13), outward(F, u0, top - meters(1.8), 0.13)], shade(color, F.k * 1.05), OUTLINE, 0.7)
    }
  }
  line([wp(F, 0, z0 + h), wp(F, 1, z0 + h)], shade(s.trim ?? '#e6dccb', F.k), 1.4)
}

function fireEscape(F: Face, z0: number, z1: number, cols: number) {
  const fl = floors(1)
  const c0 = Math.floor(cols / 2) - 1, u0 = c0 / cols + 0.02, u1 = (c0 + 2) / cols - 0.02
  const iron = '#262126'
  for (let z = z0 + fl; z < z1 - 1; z += fl) {
    poly([wp(F, u0, z), wp(F, u1, z), outward(F, u1, z, 0.1), outward(F, u0, z, 0.1)], 'rgba(30,25,30,0.55)', iron, 0.6)
    line([outward(F, u0, z + meters(1), 0.1), outward(F, u1, z + meters(1), 0.1)], iron, 0.6)
    const up = Math.round(z / fl) % 2 ? [u0 + 0.02, u1 - 0.02] : [u1 - 0.02, u0 + 0.02]
    if (z + fl < z1 - 1) line([outward(F, up[0], z, 0.08), outward(F, up[1], z + fl, 0.08)], iron, 0.7)
  }
}

export interface Punched {
  base?: Storefront & { floors: number }
  /** Window spacing in metres. 3 m unless the building says otherwise. */
  module?: number
  /** Window width as a share of its module. */
  w?: number
  glass?: string
  lit?: string
  litChance?: number
  frame?: string
  band?: string
  bandEvery?: number
  cornice?: string
  piers?: string
  pairs?: boolean
  tall?: boolean
  fire?: boolean
}

/** Punched windows in rows, with an optional shop floor, bands, a
 *  cornice, piers, and a fire escape on walls that face right. */
export function punched(o: Punched): Facade {
  return F => {
    const fl = floors(1)
    let z = F.z0
    if (o.base) { const h = o.base.floors * fl * 1.3; storefront(F, z, h, o.base); z += h }
    const top = F.z1 - (o.cornice ? meters(1.2) : 0)
    const count = Math.floor((top - z) / fl)
    const cols = modules(F.len, o.module ?? 3)
    const w = o.w ?? 0.5
    for (let f = 0; f < count; f++) {
      const za = z + f * fl + fl * 0.24, zb = z + f * fl + fl * (o.tall ? 0.86 : 0.8)
      for (let c = 0; c < cols; c++) {
        if (o.pairs && c % 3 === 2) continue
        const u0 = (c + (1 - w) / 2) / cols, u1 = (c + (1 + w) / 2) / cols
        const lit = F.rand() < (o.litChance ?? 0.08)
        poly(wq(F, u0, u1, za, zb), lit ? (o.lit ?? '#c9d3da') : shade(o.glass ?? '#3a3340', F.k), o.frame ? shade(o.frame, F.k) : null, 0.5)
      }
      if (o.bandEvery && f > 0 && f % o.bandEvery === 0) poly(wq(F, 0, 1, z + f * fl - fl * 0.08, z + f * fl + fl * 0.08), shade(o.band ?? '#e2d6c1', F.k), null)
    }
    if (o.piers) for (let c = 0; c <= cols; c++) line([wp(F, c / cols, z), wp(F, c / cols, top)], shade(o.piers, F.k), 1)
    if (o.cornice) {
      poly(wq(F, 0, 1, top, F.z1), shade(o.cornice, F.k * 1.05), null)
      line([outward(F, 0, F.z1, 0.04), outward(F, 1, F.z1, 0.04)], OUTLINE, 0.8)
    }
    if (o.fire && F.nh[0] > 0.6 && F.len > 1) fireEscape(F, z, top, cols)
  }
}

export interface Curtain { glass: string; glass2?: string; finsEvery?: number; fin?: string; spandrel?: number; crown?: number; crownColor?: string; /** Panes that catch the sky. Default: true. */ glints?: boolean }

/** A glass curtain wall: a gradient, a mullion every 1.5 m, a line per
 *  floor, fins on every few mullions, and a few panes that catch the sky.
 *  `crown` is a solid band at the top, in storeys. */
export function curtain(o: Curtain): Facade {
  return F => {
    const ctx = state.ctx
    if (!ctx) return
    const fl = floors(1)
    const zTop = F.z1 - floors(o.crown ?? 0)
    const lo = wp(F, 0.5, F.z0), hi = wp(F, 0.5, zTop)
    const g = ctx.createLinearGradient(lo[0], lo[1], hi[0], hi[1])
    g.addColorStop(0, shade(o.glass, F.k * 0.85))
    g.addColorStop(0.7, shade(o.glass, F.k))
    g.addColorStop(1, shade(o.glass2 ?? o.glass, F.k * 1.1))
    poly(wq(F, 0, 1, F.z0, zTop), g, null)
    const cols = modules(F.len, 1.5)
    for (let z = F.z0 + fl; z < zTop; z += fl) line([wp(F, 0, z), wp(F, 1, z)], `rgba(0,0,0,${o.spandrel ?? 0.22})`, 0.7)
    for (let c = 1; c < cols; c++) {
      const fin = !!o.finsEvery && c % o.finsEvery === 0
      line([wp(F, c / cols, F.z0), wp(F, c / cols, zTop)], fin ? shade(o.fin ?? '#d9dde2', F.k) : 'rgba(255,255,255,0.16)', fin ? 1.3 : 0.6)
    }
    for (let i = 0; o.glints !== false && i < F.len * 10; i++) {
      const c = Math.floor(F.rand() * cols), f = Math.floor((F.rand() * (zTop - F.z0)) / fl)
      poly(wq(F, c / cols + 0.01, (c + 1) / cols - 0.01, F.z0 + f * fl + fl * 0.12, F.z0 + f * fl + fl * 0.88), `rgba(214,226,238,${0.18 + F.rand() * 0.2})`, null)
    }
    if (o.crown) poly(wq(F, 0, 1, zTop, F.z1), shade(o.crownColor ?? '#c9ccd2', F.k), null)
  }
}

/** Glass on a sloped face: mullions every 1.5 m that follow the slope, a
 *  line per floor, a few panes catching the sky. The gradient runs over
 *  `span` (from, to) rather than the face, so faces stacked or side by
 *  side read as one skin. */
export function glassSkin(o: { glass: string; glass2?: string; span: [number, number]; mullion?: string; glints?: boolean }): Skin {
  return S => {
    const ctx = state.ctx
    if (!ctx) return
    const at = (u: number, z: number) => {
      const t = (z - S.z0) / (S.z1 - S.z0 || 1)
      const bx = S.a0[0] + (S.a1[0] - S.a0[0]) * u, by = S.a0[1] + (S.a1[1] - S.a0[1]) * u
      const tx = S.b0[0] + (S.b1[0] - S.b0[0]) * u, ty = S.b0[1] + (S.b1[1] - S.b0[1]) * u
      return iso(bx + (tx - bx) * t, by + (ty - by) * t, z)
    }
    const [m0, m1] = [at(0.5, o.span[0]), at(0.5, o.span[1])]
    const g = ctx.createLinearGradient(m0[0], m0[1], m1[0], m1[1])
    g.addColorStop(0, shade(o.glass, S.k * 0.85))
    g.addColorStop(0.6, shade(o.glass, S.k))
    g.addColorStop(1, shade(o.glass2 ?? o.glass, S.k * 1.1))
    poly([at(0, S.z0), at(1, S.z0), at(1, S.z1), at(0, S.z1)], g, null)
    const fl = floors(1)
    for (let z = S.z0 + fl; z < S.z1; z += fl) line([at(0, z), at(1, z)], 'rgba(0,0,0,0.16)', 0.6)
    const width = Math.max(Math.hypot(S.a1[0] - S.a0[0], S.a1[1] - S.a0[1]), Math.hypot(S.b1[0] - S.b0[0], S.b1[1] - S.b0[1]))
    const cols = modules(width, 1.5)
    for (let c = 1; c < cols; c++) {
      const u = c / cols
      const main = c % 4 === 0
      line([at(u, S.z0), at(u, S.z1)], main ? (o.mullion ? shade(o.mullion, S.k) : 'rgba(230,236,242,0.4)') : 'rgba(255,255,255,0.14)', main ? 0.9 : 0.5)
    }
    for (let i = 0; o.glints !== false && i < width * 30; i++) {
      const u = S.rand(), z = S.z0 + S.rand() * (S.z1 - S.z0)
      poly([at(u - 0.004, z), at(u + 0.004, z), at(u + 0.004, z + fl * 2), at(u - 0.004, z + fl * 2)], `rgba(214,226,238,${0.15 + S.rand() * 0.2})`, null)
    }
  }
}

/** Staggered masonry courses with muted variation between individual bricks. */
export function brickwork(o: { colors: string[]; mortar: string; rows: number }): Facade {
  return F => {
    const height = (F.z1 - F.z0) / o.rows
    const columns = Math.max(2, Math.round(F.len * HALF_W / (height * 2.8)))
    const gap = Math.min(0.65, height * 0.08)
    poly(wq(F, 0, 1, F.z0, F.z1), shade(o.mortar, F.k), null)
    for (let row = 0; row < o.rows; row++) {
      const offset = row % 2 ? 0.5 : 0
      for (let col = -1; col < columns; col++) {
        const left = Math.max(0, (col + offset) / columns)
        const right = Math.min(1, (col + offset + 1) / columns)
        if (right <= left) continue
        const z = F.z0 + row * height
        const inset = gap / Math.max(1, F.len * HALF_W)
        poly(wq(F, left + inset, right - inset, z + gap, z + height - gap),
          shade(o.colors[Math.floor(F.rand() * o.colors.length)], F.k), null)
      }
    }
  }
}

/** A lit sign: a dark band, and the text centred on every face long enough
 *  to carry it, fitted to the face — with an optional smaller `caption`
 *  under it. The text runs along the face as the face runs on screen, and
 *  always reads left to right. */
export function lettering(o: { text: string; caption?: string; background: string; color: string; font: string; minLength?: number; prominentCaption?: boolean }): Facade {
  return F => {
    poly(wq(F, 0, 1, F.z0, F.z1), shade(o.background, F.k), null)
    const ctx = state.ctx
    if (!ctx || !o.text || F.len < (o.minLength ?? 0)) return
    const z = (F.z0 + F.z1) / 2
    let [a, b] = [wp(F, 0, z), wp(F, 1, z)]
    if (b[0] < a[0]) [a, b] = [b, a]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    const band = F.z1 - F.z0
    const line = (text: string, size: number, y: number) => {
      ctx.font = `700 ${size}px ${o.font}`
      const fit = Math.min(1, length * 0.84 / (ctx.measureText(text).width || 1))
      ctx.font = `700 ${size * fit}px ${o.font}`
      ctx.fillText(text, length / 2, y)
    }
    ctx.save()
    ctx.transform((b[0] - a[0]) / length, (b[1] - a[1]) / length, 0, 1, a[0], a[1])
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = o.color
    if (o.caption) {
      line(o.text, band * (o.prominentCaption ? 0.38 : 0.44), -band * 0.22)
      ctx.globalAlpha = o.prominentCaption ? 1 : 0.85
      if (o.prominentCaption) ctx.fillStyle = '#fff4d5'
      line(o.caption, band * (o.prominentCaption ? 0.38 : 0.26), band * 0.24)
    } else {
      line(o.text, band * 0.6, 0)
    }
    ctx.restore()
  }
}

/** A glass ribbon per floor between solid bands; `base` is a solid
 *  plinth in storeys. */
export function ribbons(o: { glass: string; base?: number }): Facade {
  return F => {
    const fl = floors(1)
    const cols = modules(F.len, 2.4)
    for (let z = F.z0 + floors(o.base ?? 0); z + fl <= F.z1 - fl * 0.3; z += fl) {
      poly(wq(F, 0.02, 0.98, z + fl * 0.27, z + fl * 0.8), shade(o.glass, F.k), null)
      for (let c = 1; c < cols; c++) line([wp(F, c / cols, z + fl * 0.27), wp(F, c / cols, z + fl * 0.8)], 'rgba(255,255,255,0.14)', 0.5)
    }
  }
}

/** Apartment balconies: glass set back behind a slab edge per floor and
 *  a pier every `module` metres, so the face reads as a white grid. */
export function balconies(o: { glass: string; module?: number }): Facade {
  return F => {
    const fl = floors(1)
    const cols = modules(F.len, o.module ?? 3.6)
    const pier = 0.14 / 2
    poly(wq(F, 0, 1, F.z0, F.z1), shade(o.glass, F.k), null)
    for (let z = F.z0; z < F.z1 - 1e-6; z += fl) {
      poly(wq(F, 0, 1, z, Math.min(F.z1, z + fl * 0.3)), shade(F.color, F.k), null)
      line([wp(F, 0, z + fl * 0.3), wp(F, 1, z + fl * 0.3)], 'rgba(0,0,0,0.12)', 0.6)
    }
    for (let c = 0; c <= cols; c++) {
      const u = c / cols
      poly(wq(F, Math.max(0, u - pier / cols * 2), Math.min(1, u + pier / cols * 2), F.z0, F.z1), shade(F.color, F.k * 1.04), null)
    }
  }
}

/** Vertical glass strips between piers, a strip every 3.3 m; `base` and
 *  `top` are solid bands in storeys. */
export function strips(o: { glass: string; module?: number; base?: number; top?: number }): Facade {
  return F => {
    const fl = floors(1)
    const cols = Math.max(2, modules(F.len, o.module ?? 3.3))
    const z0 = F.z0 + floors(o.base ?? 0.5), z1 = F.z1 - floors(o.top ?? 0.6)
    for (let c = 0; c < cols; c++) {
      const u0 = (c + 0.28) / cols, u1 = (c + 0.72) / cols
      poly(wq(F, u0, u1, z0, z1), shade(o.glass, F.k), null)
      for (let z = z0 + fl; z < z1; z += fl) line([wp(F, u0, z), wp(F, u1, z)], shade(F.color, F.k * 0.9), 0.8)
    }
  }
}

/* ── Small things ────────────────────────────────────────────────── */

/** A timber water tank on stilts: 4 m across, 6 m of barrel. */
export function tank(x: number, y: number, z: number) {
  const [tx, ty] = state.turn([x, y])
  part([[tx - 0.15, ty - 0.15], [tx + 0.15, ty + 0.15]], z, z + meters(12), () => paintTank(tx, ty, z))
}

function paintTank(x: number, y: number, z: number) {
  const [cx, cy] = iso(x, y, z)
  const arc = (yc: number, rx: number, ry: number, a0: number, a1: number): Screen[] =>
    Array.from({ length: 9 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 8; return [cx + Math.cos(a) * rx, yc + Math.sin(a) * ry] })
  const legs = meters(2.5), barrel = meters(5), cone = meters(3)
  for (const dx of [-5, 0, 5]) line([[cx + dx, cy], [cx + dx, cy - legs]], OUTLINE, 1)
  const t = cy - legs
  poly([...arc(t, 7, 3, 0, Math.PI), ...arc(t - barrel, 7, 3, Math.PI, 0)], '#7a5a3d', OUTLINE, 0.9)
  poly([...arc(t - barrel, 7, 3, 0, Math.PI), [cx, t - barrel - cone]], '#5c4430', OUTLINE, 0.9)
}

/** A mast of `h` metres with a red light on top. */
export function antenna(x: number, y: number, z: number, h: number) {
  const [tx, ty] = state.turn([x, y])
  part([[tx, ty]], z, z + meters(h), () => paintAntenna(tx, ty, z, meters(h)))
}

function paintAntenna(x: number, y: number, z: number, h: number) {
  const [a, b] = iso(x, y, z)
  line([[a, b], [a, b - h]], OUTLINE, 1.1)
  poly([[a - 1.6, b - h], [a + 1.6, b - h], [a + 1.6, b - h + 3], [a - 1.6, b - h + 3]], '#c94c3c', null)
}

/** Boxes and vents on a flat roof, 2–4.5 m tall, sometimes a tank. */
export function clutter(p: Pt[], z: number, amount = 3, withTank = false) {
  const c = centroid(p)
  const spread = inset(p, 0.25)
  for (let i = 0; i < amount; i++) {
    const q = spread[Math.floor(state.rng() * spread.length)]
    const t = 0.25 + state.rng() * 0.5
    const x = c[0] + (q[0] - c[0]) * t, y = c[1] + (q[1] - c[1]) * t
    const s = 0.14 + state.rng() * 0.2
    prism(rect(x - s / 2, y - s / 2, s, s * (0.7 + state.rng() * 0.6)), z, meters(2 + state.rng() * 2.5), { color: ['#8e8b87', '#a5a29c', '#77746f'][i % 3], roof: '#b8b4ad' })
  }
  if (withTank) tank(c[0] + 0.25, c[1] - 0.2, z)
}

export type TreeKind = 'canopy' | 'lime' | 'cypress' | 'copper'

/** Mature trees share the metres ruler with buildings. A size of one is
 * about 11 metres high; variants change crown shape, not the scene scale. */
export function tree(x: number, y: number, size = 1, z = 0, kind: TreeKind = 'canopy') {
  const [tx, ty] = state.turn([x, y])
  const radius = (kind === 'cypress' ? 0.12 : 0.43) * size
  const crown = ngon(tx, ty, radius, 12)
  const height = meters(11.2 * size)
  if (state.mode === 'shadow') {
    state.solids.push({ poly: crown, top: z + height * 0.78, volume: 0 })
    return
  }
  const seed = Math.round(x * 739 + y * 1931 + size * 317)
  part(crown, z, z + height, () => paintTree(tx, ty, size, z, kind, seed))
}

function paintTree(x: number, y: number, size: number, z: number, kind: TreeKind, seed: number) {
  const [sx, sy] = iso(x, y, z)
  const random = mulberry(seed)
  const h = meters(11.2 * size), r = 16.5 * size
  const colors = kind === 'copper' ? ['#34342d', '#4c4b37', '#626049', '#777554', '#8a865f']
    : kind === 'lime' ? ['#294531', '#3f6338', '#52783f', '#638b46', '#7b9b50']
      : kind === 'cypress' ? ['#243e32', '#35503b', '#426348', '#507650', '#62835a']
        : ['#263f30', '#38583a', '#486b40', '#597d47', '#6b8d50']
  const outline = '#2e4132'
  const at = (dx: number, dy: number): Screen => [sx + dx, sy - dy]
  // Bark, fork and a lit edge remain visible below the hanging foliage.
  poly([at(-1.3 * size, 0), at(1.6 * size, 0), at(0.8 * size, h * 0.48), at(-0.5 * size, h * 0.50)], '#665b45', '#414332', 0.45)
  line([at(0, h * 0.23), at(-r * 0.32, h * 0.47)], '#5b543f', 1.0 * size)
  line([at(0, h * 0.29), at(r * 0.30, h * 0.53)], '#5b543f', 1.0 * size)
  const patch = (cx: number, cy: number, rx: number, ry: number, fill: string, edge: string | null, phase: number) => {
    const points = Array.from({ length: 28 }, (_, i): Screen => {
      const a = i / 28 * Math.PI * 2
      const scallop = 1 + 0.07 * Math.sin(a * 7 + phase) + 0.035 * Math.sin(a * 13 - phase)
      return at(cx + Math.cos(a) * rx * scallop, cy + Math.sin(a) * ry * scallop)
    })
    poly(points, fill, edge, edge ? Math.max(0.45, size * 0.65) : 0)
  }
  if (kind === 'cypress') {
    patch(0, h * 0.56, r * 0.38, h * 0.43, colors[0], outline, 1)
    for (let i = 0; i < 7; i++) {
      const t = i / 7
      patch(-r * 0.045, h * (0.24 + t * 0.66), r * (0.31 - t * 0.22), h * 0.13, colors[2 + i % 2], null, i)
    }
  } else {
    // One irregular silhouette, then nested foliage planes — no outlined
    // circles stacked like a toy. Lower lobes are darker than the crown.
    patch(0, h * 0.62, r, h * 0.36, colors[0], outline, random() * 6)
    const lobes = [
      [-0.51, 0.51, 0.45, 0.20], [0.47, 0.52, 0.48, 0.23], [0.06, 0.43, 0.54, 0.17],
      [-0.42, 0.71, 0.47, 0.24], [0.43, 0.72, 0.43, 0.24], [0.0, 0.81, 0.51, 0.19],
      [-0.08, 0.65, 0.45, 0.23],
    ]
    lobes.forEach(([cx, cy, rx, ry], i) => {
      const offset = (random() - 0.5) * 0.06
      patch((cx + offset) * r, cy * h, rx * r, ry * h, colors[i < 3 ? 1 : 2], null, i + seed)
      patch((cx - 0.07) * r, (cy + 0.035) * h, rx * r * 0.70, ry * h * 0.72, colors[i < 3 ? 2 : 3], null, i + 1)
      if (i > 2) patch((cx - 0.13) * r, (cy + 0.07) * h, rx * r * 0.32, ry * h * 0.36, colors[4], null, i + 2)
    })
  }
}

/** A palm: a leaning trunk and a crown of fronds. */
export function palm(x: number, y: number, size = 1) {
  const [tx, ty] = state.turn([x, y])
  part([[tx - 0.2, ty - 0.2], [tx + 0.2, ty + 0.2]], 0, 28 * size, () => paintPalm(tx, ty, size))
}

function paintPalm(x: number, y: number, size: number) {
  const [sx, sy] = iso(x, y)
  const top: Screen = [sx + 2 * size, sy - 22 * size]
  line([[sx, sy], [sx + 1.5 * size, sy - 11 * size], top], '#6b5a44', 1.8)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3
    const reach = 9 * size, droop = 4 * size
    const tip: Screen = [top[0] + Math.cos(a) * reach, top[1] + Math.sin(a) * reach * 0.5 + droop]
    const mid: Screen = [top[0] + Math.cos(a) * reach * 0.5 - Math.sin(a) * 1.6 * size, top[1] + Math.sin(a) * reach * 0.25 - 1.5 * size]
    const mid2: Screen = [top[0] + Math.cos(a) * reach * 0.5 + Math.sin(a) * 1.6 * size, top[1] + Math.sin(a) * reach * 0.25 - 1.5 * size]
    poly([top, mid, tip, mid2], i % 2 ? '#5d9443' : '#4a7d36', '#223a1e', 0.8)
  }
}

/** A flat quad on the ground, in plan coordinates. */
export const groundQuad = (p: Pt[], fill: string, stroke: string | null = null, width = 1) => {
  const screen = p.map(q => at(q))
  part([], 0, 0, () => poly(screen, fill, stroke, width), true)
}
export const groundLine = (a: Pt, b: Pt, stroke: string, width = 1, dash?: number[]) => {
  const screen = [at(a), at(b)]
  part([], 0, 0, () => line(screen, stroke, width, dash), true)
}

/** A fixed-view illustration anchored to a rotating pedestal. Size is expressed
 * in tiles, so its screen dimensions follow the same wealth scale as meshes. */
export function sculptureBillboard(resource: SpriteImage, crop: [number, number, number, number],
  center: Pt, span: number, z: number, volume: number, forward = 0) {
  const [cx, cy] = state.turn(center)
  // Fixed-view artwork stays toward the visible front in every camera turn.
  const x = cx + forward, y = cy + forward
  const width = span * HALF_W * 2, height = width * crop[3] / crop[2]
  const bottom = (x + y) * HALF_H - z, left = (x - y) * HALF_W - width / 2
  const plan = rect(center[0] - span * .25, center[1] - span * .25, span * .5, span * .5).map(state.turn).map(([px, py]): Pt => [px + forward, py + forward])
  if (state.mode === 'measure') { track([[left, bottom - height], [left + width, bottom]]); return }
  if (state.mode === 'shadow') {
    state.solids.push({ poly: plan, top: z + height, volume: volume * meters(METERS_PER_TILE) })
    return
  }
  part(plan, z, z + height, () => {
    if (!resource.image || !state.ctx) return
    state.ctx.imageSmoothingEnabled = true
    state.ctx.imageSmoothingQuality = 'high'
    state.ctx.drawImage(resource.image, ...crop, left + state.ox, bottom - height + state.oy, width, height)
  })
}

/* ── Sprites ─────────────────────────────────────────────────────── */

export interface Recipe {
  /** Tiles along x and y at rotation 0. */
  size: Pt
  draw: () => void
  /** Optional local image dependency for exports and previews. */
  ready?: Promise<void>
}

export interface Sprite {
  canvas: HTMLCanvasElement
  /** Ground paint is composited before all shadows; bodies after them. */
  ground: HTMLCanvasElement | null
  /** Its shadow on the ground, in the same frame, drawn in black. */
  shadow: HTMLCanvasElement | null
  /** Where the footprint's corner cell (0, 0) lands, in sprite pixels at scale 1. */
  anchor: Pt
  width: number
  height: number
}

function turned(rotation: number, [w, d]: Pt) {
  return (p: Pt): Pt => {
    let [x, y] = p
    let [cw, cd] = [w, d]
    for (let i = 0; i < rotation; i++) {
      ;[x, y] = [cd - y, x]
      ;[cw, cd] = [cd, cw]
    }
    return [x, y]
  }
}

/** Draws a recipe once into its own canvas, turned by `rotation` quarters,
 *  at `scale` device pixels per screen pixel. */
const planArea = (p: Pt[]) => Math.abs(p.reduce((s, [x, y], i) => { const [nx, ny] = p[(i + 1) % p.length]; return s + x * ny - nx * y }, 0)) / 2

/** A recipe's built volume, in m³, and its height, in m: every solid it
 *  lofts, at true scale. Trees, masts and ground are not solids and count
 *  for neither. */
export function recipeMeasure(recipe: Recipe): { volume: number; height: number } {
  const previous = pxPerMeter
  pxPerMeter = TRUE_PX_PER_METER
  state.turn = p => p
  state.mode = 'shadow'
  state.solids = []
  state.rng = mulberry(1)
  recipe.draw()
  pxPerMeter = previous
  const built = state.solids.filter(s => s.volume > 0)
  const volume = built.reduce((sum, s) => sum + s.volume, 0) * METERS_PER_TILE ** 2 / TRUE_PX_PER_METER
  const height = built.reduce((top, s) => Math.max(top, s.top), 0) / TRUE_PX_PER_METER
  state.solids = []
  return { volume, height }
}

export function renderSprite(recipe: Recipe, rotation: number, scale: number, seed: number): Sprite {
  const [w, d] = recipe.size
  const size: Pt = rotation % 2 ? [d, w] : [w, d]
  state.turn = turned(rotation, recipe.size)
  state.ox = 0; state.oy = 0
  state.mode = 'measure'
  state.bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  state.rng = mulberry(seed)
  recipe.draw()
  const footprint = rect(0, 0, size[0], size[1])
  track(footprint.map(([x, y]) => iso(x, y)))

  // The shadow reaches right of the building by most of its height.
  state.mode = 'shadow'
  state.solids = []
  state.rng = mulberry(seed)
  recipe.draw()
  const shadows = state.solids.map(({ poly: p, top }) => {
    const reach = top * 0.72
    const points: Screen[] = []
    for (const [x, y] of p) { const [sx, sy] = iso(x, y); points.push([sx, sy], [sx + reach, sy - reach * 0.08]) }
    return hull(points)
  })
  for (const s of shadows) track(s)

  const pad = 4
  const b = state.bounds
  const width = Math.ceil(b.maxX - b.minX + pad * 2)
  const height = Math.ceil(b.maxY - b.minY + pad * 2)
  const anchor: Pt = [pad - b.minX, pad - b.minY]

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  state.ctx = ctx
  state.ox = anchor[0]; state.oy = anchor[1]
  state.mode = 'draw'
  state.rng = mulberry(seed)
  state.parts = []
  recipe.draw()
  const parts = state.parts
  state.parts = null
  let ground: HTMLCanvasElement | null = null
  if (parts.some(p => p.ground)) {
    ground = document.createElement('canvas')
    ground.width = canvas.width; ground.height = canvas.height
    const g = ground.getContext('2d')!
    g.setTransform(scale, 0, 0, scale, 0, 0)
    g.lineJoin = 'round'; g.lineCap = 'round'
    state.ctx = g
    paintParts(parts.filter(p => p.ground))
    state.ctx = ctx
  }
  paintParts(parts.filter(p => !p.ground))

  let shadow: HTMLCanvasElement | null = null
  if (shadows.length) {
    shadow = document.createElement('canvas')
    shadow.width = canvas.width
    shadow.height = canvas.height
    const s = shadow.getContext('2d')!
    s.setTransform(scale, 0, 0, scale, anchor[0] * scale, anchor[1] * scale)
    s.fillStyle = '#261e30'
    for (const points of shadows) {
      s.beginPath()
      points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
      s.closePath()
      s.fill()
    }
  }

  state.ctx = null
  state.turn = p => p
  return { canvas, ground, shadow, anchor, width, height }
}

function hull(points: Screen[]): Screen[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Screen, a: Screen, b: Screen) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Screen[] = []
  const upper: Screen[] = []
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}
