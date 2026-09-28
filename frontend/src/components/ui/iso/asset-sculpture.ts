import bullModel from './models/bull.json'
import turtleModel from './models/turtle.json'
import piggyModel from './models/piggy.json'
import octopusModel from './models/octopus.json'
import { phoenixSprite, PHOENIX_SPAN, PHOENIX_CROP } from './phoenix-sprite'
import { sculptureNormals } from './sculpture-normals'
import { fontStacks } from '@/theme/tokens'
import {
  brickwork, groundQuad, lettering, meters, prism, rect, sculptureMesh, sculptureBillboard,
  type Recipe, type SculptureMaterial, type SculptureMesh,
} from './engine'

export type AssetSculptureStyle = 'bull' | 'piggy' | 'octopus' | 'turtle' | 'arch' | 'knot' | 'shield' | 'phoenix' | 'flame'
export type AssetSculptureMaterial = SculptureMaterial
export const ASSET_SCULPTURE_MATERIALS: { value: SculptureMaterial; label: string }[] = [
  { value: 'gold', label: 'Ouro' }, { value: 'silver', label: 'Prata' }, { value: 'bronze', label: 'Bronze' },
  { value: 'stone', label: 'Pedra' }, { value: 'wood', label: 'Madeira' },
  { value: 'topiary', label: 'Planta ornamental' }, { value: 'glass', label: 'Vidro' },
  { value: 'fire', label: 'Fogo · amarelo ao vermelho' },
]

// Muted NYC masonry: brownstone, terracotta, buff brick and smoked brick.
const PEDESTALS = [
  { brick: ['#886653', '#936f5c', '#7e604f', '#9b7560'], mortar: '#b19b83', cap: '#a99981', edge: '#716555' },
  { brick: ['#a2765e', '#ad8068', '#946b58', '#b2876d'], mortar: '#bfaa8d', cap: '#b2a289', edge: '#80705c' },
  { brick: ['#aa9574', '#b29f80', '#9c896e', '#baa689'], mortar: '#c4b69e', cap: '#b9ae97', edge: '#877d68' },
  { brick: ['#746c68', '#807570', '#6b6461', '#8a7e76'], mortar: '#a99c8e', cap: '#96928a', edge: '#66635d' },
  { brick: ['#8d7066', '#997b70', '#80675f', '#a28476'], mortar: '#b7a191', cap: '#aaa091', edge: '#756c60' },
]

type Vec = [number, number, number]
const TAU = Math.PI * 2
const plus = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s, a[2] * s]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (v: Vec) => mul(v, 1 / (Math.hypot(...v) || 1))
const empty = (): SculptureMesh => ({ vertices: [], faces: [] })

function signedVolume(mesh: SculptureMesh) {
  return mesh.faces.reduce((sum, face) => {
    const a = mesh.vertices[face[0]]
    for (let i = 1; i < face.length - 1; i++) {
      const c = cross(mesh.vertices[face[i]], mesh.vertices[face[i + 1]])
      sum += (a[0] * c[0] + a[1] * c[1] + a[2] * c[2]) / 6
    }
    return sum
  }, 0)
}
function append(to: SculptureMesh, from: SculptureMesh) {
  const offset = to.vertices.length
  const reverse = signedVolume(from) < 0
  to.vertices.push(...from.vertices)
  to.faces.push(...from.faces.map(face => (reverse ? [...face].reverse() : face).map(i => i + offset)))
}

function ellipsoid(to: SculptureMesh, center: Vec, radius: Vec, segments = 24) {
  const mesh = empty(), bands = 14
  for (let j = 0; j <= bands; j++) {
    const latitude = Math.PI * j / bands
    for (let i = 0; i < segments; i++) {
      const a = TAU * i / segments
      mesh.vertices.push(plus(center, [radius[0] * Math.sin(latitude) * Math.cos(a), radius[1] * Math.sin(latitude) * Math.sin(a), radius[2] * Math.cos(latitude)]))
    }
  }
  for (let j = 0; j < bands; j++) for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    mesh.faces.push([j * segments + i, j * segments + next, (j + 1) * segments + next, (j + 1) * segments + i])
  }
  append(to, mesh)
}

/** A swept tube: also used for tapered horns, legs and the continuous knot. */
function tube(to: SculptureMesh, curve: (t: number) => Vec, radius: (t: number) => number, steps: number, closed = false, sides = 12) {
  const mesh = empty()
  for (let j = 0; j <= steps; j++) {
    const t = j / steps, p = curve(t)
    const tangent = unit(plus(curve(t + 0.0001), mul(curve(t - 0.0001), -1)))
    const u = unit(cross(tangent, Math.abs(tangent[2]) > 0.92 ? [0, 1, 0] : [0, 0, 1]))
    const v = cross(tangent, u)
    for (let i = 0; i < sides; i++) {
      const a = TAU * i / sides
      mesh.vertices.push(plus(p, plus(mul(u, Math.cos(a) * radius(t)), mul(v, Math.sin(a) * radius(t)))))
    }
  }
  for (let j = 0; j < steps; j++) for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides
    mesh.faces.push([j * sides + i, j * sides + next, (j + 1) * sides + next, (j + 1) * sides + i])
  }
  if (!closed) {
    mesh.faces.push(Array.from({ length: sides }, (_, i) => sides - 1 - i))
    mesh.faces.push(Array.from({ length: sides }, (_, i) => steps * sides + i))
  }
  append(to, mesh)
}

function extrude(to: SculptureMesh, outline: [number, number][], depth: number, y = 0) {
  const mesh = empty(), n = outline.length
  for (const side of [-1, 1]) for (const [x, z] of outline) mesh.vertices.push([x, y + side * depth / 2, z])
  mesh.faces.push(Array.from({ length: n }, (_, i) => n - i - 1), Array.from({ length: n }, (_, i) => n + i))
  for (let i = 0; i < n; i++) mesh.faces.push([i, (i + 1) % n, (i + 1) % n + n, i + n])
  append(to, mesh)
}

function model(style: AssetSculptureStyle): SculptureMesh {
  const mesh = empty()
  if (style === 'bull') {
    mesh.vertices = bullModel.vertices as Vec[]
    mesh.faces = bullModel.faces
    mesh.normals = bullModel.normals as Vec[]
  }
  if (style === 'piggy' || style === 'octopus') {
    const model = style === 'piggy' ? piggyModel : octopusModel
    mesh.vertices = model.vertices as Vec[]
    mesh.faces = model.faces
    mesh.normals = model.normals as Vec[]
  }
  if (style === 'turtle') {
    mesh.vertices = turtleModel.vertices as Vec[]
    mesh.faces = turtleModel.faces
    mesh.normals = turtleModel.normals as Vec[]
  }
  if (style === 'knot') {
    tube(mesh, t => {
      const a = t * TAU, r = 0.52 + 0.18 * Math.cos(3 * a)
      return [r * Math.cos(2 * a), 0.24 * Math.sin(3 * a), 0.84 + r * Math.sin(2 * a)]
    }, () => 0.155, 144, true, 14)
  }
  if (style === 'arch') {
    for (const sign of [-1, 1]) extrude(mesh, [[sign * 0.43, 0], [sign * 0.79, 0], [sign * 0.79, 0.79], [sign * 0.43, 0.79]], 0.48)
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI / 9 + 0.012, b = (i + 1) * Math.PI / 9 - 0.012
      const segment = (radius: number, angle: number): [number, number] => [radius * Math.cos(angle), 0.79 + radius * Math.sin(angle)]
      extrude(mesh, [segment(0.43, a), segment(0.79, a), segment(0.79, b), segment(0.43, b)], i === 4 ? 0.58 : 0.48)
    }
  }
  if (style === 'shield') {
    extrude(mesh, [[0, 0], [0.48, 0.36], [0.67, 0.92], [0.64, 1.43], [0, 1.62], [-0.64, 1.43], [-0.67, 0.92], [-0.48, 0.36]], 0.26)
    for (const y of [-0.18, 0.18]) {
      ellipsoid(mesh, [0, y, 0.96], [0.26, 0.085, 0.26])
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12
        const p = (r: number, angle: number): [number, number] => [r * Math.cos(angle), 0.96 + r * Math.sin(angle)]
        extrude(mesh, [p(0.28, a - 0.13), p(0.45, a), p(0.28, a + 0.13)], 0.035, y)
      }
    }
  }
  if (style === 'flame') {
    for (let i = 0; i < 3; i++) {
      tube(mesh, t => {
        const a = i * TAU / 3 + t * 2.6, r = 0.38 * Math.sin(Math.PI * t)
        return [r * Math.cos(a), r * Math.sin(a), 0.12 + t * 1.8]
      }, t => 0.025 + 0.13 * Math.sin(Math.PI * t), 40)
    }
  }
  // Equal solid volume across silhouettes. Uniform scaling preserves each
  // sculpture's proportions; a holding four times larger has 4× the volume.
  const scale = 1 / Math.cbrt(signedVolume(mesh))
  const minZ = Math.min(...mesh.vertices.map(v => v[2]))
  return { faces: mesh.faces, normals: mesh.normals ?? sculptureNormals(mesh), colors: mesh.colors,
    vertices: mesh.vertices.map(([x, y, z]) => [x * scale, y * scale, (z - minZ) * scale]) }
}

const MODELS = new Map<string, SculptureMesh>()
function meshOf(style: AssetSculptureStyle, sign: string) {
  const key = `${style}:${sign}`
  let mesh = MODELS.get(key)
  if (!mesh) { mesh = model(style); MODELS.set(key, mesh) }
  return mesh
}

/** Uniform artwork scaling preserves the holding's volume. The pedestal
 * fills the rounded tile rectangle, without stretching the animal. */
export function assetSculptureLayout(valueUsd: number, style: AssetSculptureStyle, sign: string) {
  if (style === 'phoenix') {
    const scale = Math.cbrt(valueUsd / 1_000) * 2.30
    const width = Math.max(1, Math.ceil(PHOENIX_SPAN * scale))
    return { scale, art: scale, width, depth: width, centerX: 0, centerY: 0, lot: width }
  }
  const source = meshOf(style, sign)
  const xs = source.vertices.map(v => v[0]), ys = source.vertices.map(v => v[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = Math.cbrt(valueUsd / 1_000) * 2.30
  const center = { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 }
  const width = Math.max(1, Math.ceil((maxX - minX) * scale))
  const depth = Math.max(1, Math.ceil((maxY - minY) * scale))
  // Enlarge the whole original octopus cast, including its boulder, uniformly.
  // Keep its existing pedestal footprint; never stretch individual axes or parts.
  const art = scale * (style === 'octopus' ? 1.20 : 1)
  return { scale, art, width, depth, ...center, lot: Math.max(width, depth) }
}

export function assetSculptureRecipe(spec: {
  valueUsd: number; style: AssetSculptureStyle; material?: SculptureMaterial
  sign: string; caption: string
}): Recipe {
  const source: SculptureMesh = spec.style === 'phoenix'
    ? { vertices: [], faces: [] } : meshOf(spec.style, spec.sign)
  const { scale, art, width, depth, centerX, centerY } = assetSculptureLayout(spec.valueUsd, spec.style, spec.sign)
  // The pedestal fills exactly the rectangular tile footprint in every turn.
  const cx = width / 2, cy = depth / 2
  const baseHeight = 0.46 * scale, rim = 0.045 * scale
  const mesh: SculptureMesh = {
    vertices: source.vertices.map(([x, y, z]): Vec =>
      [cx + (x - centerX) * art, cy + (y - centerY) * art, baseHeight + rim + z * art]),
    faces: source.faces,
    normals: source.normals,
    colors: source.vertices.map((_, i): Vec =>
      spec.material === 'fire' && source.colors ? source.colors[i] : [-1, -1, -1]),
  }
  const paletteIndex = [...spec.sign].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % PEDESTALS.length
  const palette = PEDESTALS[paletteIndex]
  const masonry = brickwork({ colors: palette.brick, mortar: palette.mortar, rows: 9 })
  const sign = lettering({ text: spec.sign, caption: spec.caption, background: '#18191c', color: '#f0d690', font: fontStacks.grotesk, prominentCaption: true })
  return {
    size: [width, depth],
    ...(spec.style === 'phoenix' ? { ready: phoenixSprite.ready } : {}),
    draw() {
      groundQuad(rect(0, 0, width, depth), '#555958', '#414643', 0.4)
      prism(rect(0, 0, width, depth), 0, meters(rim * 12), { color: palette.edge, roof: palette.cap, outline: palette.edge, texture: 'granite' })
      const w = width - rim * 2, d = depth - rim * 2
      prism(rect(cx - w / 2, cy - d / 2, w, d), meters(rim * 12), meters((baseHeight - rim) * 12), { color: palette.brick[0], roof: palette.cap, outline: palette.edge, facade: masonry })
      // Black and gold identification on every side of the stone pedestal.
      const z = meters((rim + 0.025 * scale) * 12), h = meters(0.36 * scale * 12)
      const plaqueW = w * 0.72, plaqueD = d * 0.72, thickness = 0.006 * scale
      for (const plan of [rect(cx - plaqueW / 2, cy - d / 2 - thickness, plaqueW, thickness),
        rect(cx - plaqueW / 2, cy + d / 2, plaqueW, thickness),
        rect(cx - w / 2 - thickness, cy - plaqueD / 2, thickness, plaqueD),
        rect(cx + w / 2, cy - plaqueD / 2, thickness, plaqueD)]) {
        prism(plan, z, h, { color: '#18191c', roof: '#b79a58', outline: '#b79a58', facade: sign })
      }
      prism(rect(0, 0, width, depth), meters(baseHeight * 12), meters(rim * 12), { color: palette.edge, roof: palette.cap, outline: palette.edge, texture: 'granite' })
      if (spec.style === 'phoenix') {
        sculptureBillboard(phoenixSprite, PHOENIX_CROP, [cx, cy], PHOENIX_SPAN * art,
          meters((baseHeight + rim) * 12), art ** 3, PHOENIX_SPAN * art * .20)
      } else sculptureMesh(mesh, spec.material ?? 'bronze')
    },
  }
}
