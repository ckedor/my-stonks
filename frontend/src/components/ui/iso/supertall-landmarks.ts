import {
  antenna, chamfer, curtain, groundQuad, iso, line, loft, meters,
  ngon, poly, prism, rect, shade,
  type Facade, type Pt, type Recipe, type Skin, type SolidStyle,
} from './engine'

// Heights are sourced; intermediate plans/setbacks are visual approximations.
// Sources and envelope-volume methodology: docs/game-landmarks.md.
const HEIGHT = { centralParkTower: 472.44, taipei101: 508, burjKhalifa: 828, oneWorldTradeCenter: 541.3248 }

/** Quiet glazing, with level horizontal floors even on triangular faces.
 * Mullions follow the envelope; no random bright office windows. */
function glazing(color: string, floorHeight: number, ribEvery = 4, ribs = { thin: '#839ca4', thick: '#bbc9c9' }): Skin {
  return f => {
    const at = (u: number, t: number): Pt => iso(
      (f.a0[0] + (f.a1[0] - f.a0[0]) * u) * (1 - t) + (f.b0[0] + (f.b1[0] - f.b0[0]) * u) * t,
      (f.a0[1] + (f.a1[1] - f.a0[1]) * u) * (1 - t) + (f.b0[1] + (f.b1[1] - f.b0[1]) * u) * t,
      f.z0 + (f.z1 - f.z0) * t,
    )
    poly([at(0, 0), at(1, 0), at(1, 1), at(0, 1)], shade(color, f.k), null)
    for (let i = 0; i < 8; i++) {
      const u = i / 8
      poly([at(u, 0), at(u + 1 / 8, 0), at(u + 1 / 8, 1), at(u, 1)], `rgba(204,225,229,${0.025 + 0.045 * Math.sin(i * 2.1) ** 2})`, null)
    }
    const step = meters(floorHeight)
    for (let z = Math.ceil((f.z0 + 0.01) / step) * step; z < f.z1; z += step) {
      const t = (z - f.z0) / (f.z1 - f.z0)
      line([at(0, t), at(1, t)], 'rgba(194,211,211,0.48)', 0.65)
      line([at(0, t + 0.0008), at(1, t + 0.0008)], 'rgba(18,40,48,0.3)', 0.45)
    }
    const width = Math.max(Math.hypot(f.a1[0] - f.a0[0], f.a1[1] - f.a0[1]), Math.hypot(f.b1[0] - f.b0[0], f.b1[1] - f.b0[1]))
    const count = Math.max(1, Math.round(width * 12 / 1.5))
    // Clip parallel mullions against triangular edges instead of making
    // every mullion converge at the apex like a fan.
    const lowerWidth = Math.hypot(f.a1[0] - f.a0[0], f.a1[1] - f.a0[1])
    const upperWidth = Math.hypot(f.b1[0] - f.b0[0], f.b1[1] - f.b0[1])
    if (Math.min(lowerWidth, upperWidth) < 1e-6) {
      const opensUp = lowerWidth < upperWidth
      for (let i = 1; i < count; i++) {
        const u = i / count
        const tTip = Math.abs(u - 0.5) * 2
        const t0 = opensUp ? tTip : 0
        const t1 = opensUp ? 1 : 1 - tTip
        const edgeU = u < 0.5 ? 0 : 1
        line([at(opensUp ? edgeU : u, t0), at(opensUp ? u : edgeU, t1)], shade('#97aeb5', f.k), 0.55)
      }
    } else {
      for (let i = 0; i <= count; i++) line([at(i / count, 0), at(i / count, 1)], shade(i % ribEvery ? ribs.thin : ribs.thick, f.k), i % ribEvery ? 0.45 : 0.95)
    }
  }
}
function vertical(skin: Skin): Facade {
  return f => skin({ a0: f.p0, a1: f.p1, b0: f.p0, b1: f.p1, z0: f.z0, z1: f.z1, k: f.k, rand: f.rand })
}
function glass(color: string, floorHeight: number, ribEvery = 4, ribs?: { thin: string; thick: string }): SolidStyle {
  const skin = glazing(color, floorHeight, ribEvery, ribs)
  return { color, roof: '#899698', skin, facade: vertical(skin), outline: null }
}
const silver: SolidStyle = { color: '#b6c1c1', roof: '#c3ceca', outline: null }

// Meter-based solids shared by drawing and volume estimation. The model volume
// excludes landscaping, decorative fins, thin cornices, antennas and basements.
type Mass = { bottom: number; top: number; plan: Pt[]; upper?: Pt[] }
const box = (x: number, y: number, w: number, d: number, bottom: number, top: number): Mass => ({ plan: rect(x, y, w, d), bottom, top })
function drawMass(m: Mass, style: SolidStyle) {
  loft([{ poly: m.plan, z: meters(m.bottom) }, { poly: m.upper ?? m.plan, z: meters(m.top) }], style)
}
function area(plan: Pt[]) {
  return Math.abs(plan.reduce((sum, p, i) => { const q = plan[(i + 1) % plan.length]; return sum + p[0] * q[1] - q[0] * p[1] }, 0)) * 144 / 2
}
function volume(masses: Mass[]) {
  return Math.round(masses.reduce((sum, m) => {
    const upper = m.upper ?? m.plan
    const mid = m.plan.map((p, i): Pt => [(p[0] + upper[i][0]) / 2, (p[1] + upper[i][1]) / 2])
    return sum + (m.top - m.bottom) * (area(m.plan) + 4 * area(mid) + area(upper)) / 6
  }, 0))
}

const centralPark: Mass[] = [
  box(0.15, 0.15, 4.7, 4.7, 0, 32),
  box(0.9, 1.0, 2.45, 3.0, 32, 88),
  // East cantilever of 8.4 m from 88 m up; progressively inset shoulders.
  box(0.9, 0.75, 3.15, 3.25, 88, 224),
  box(0.9, 0.75, 3.15, 2.8, 224, 310),
  box(0.9, 0.75, 2.7, 2.8, 310, 402),
  box(0.9, 0.75, 2.7, 2.35, 402, 447),
  box(0.9, 0.75, 2.3, 2.35, 447, HEIGHT.centralParkTower),
]
/** Graphite glass with a violet cast behind grey steel pinstripes; pale
 *  stone ledges at the setbacks, as in the reference the owner picked. */
const CENTRAL_PARK_GLASS = '#4a4b56'
const PINSTRIPES = { thin: '#666873', thick: '#9a9ba4' }
const LEDGE: SolidStyle = { color: '#d5cfc1', roof: '#bdb7aa', outline: null }
const BLADE: SolidStyle = { color: '#8d8e96', roof: '#a4a4aa', outline: null }
const CENTRAL_PARK: Recipe = {
  size: [5, 5],
  draw() {
    groundQuad(rect(0, 0, 5, 5), '#bcb6aa')
    centralPark.forEach((m, i) => drawMass(m, i === 0 ? glass('#5d6470', 5, 6, PINSTRIPES) : glass(CENTRAL_PARK_GLASS, 4.5, 2, PINSTRIPES)))
    // Steel corner blades follow each setback instead of a uniform box.
    for (const m of centralPark.slice(1)) for (const [x, y] of m.plan) {
      prism(rect(x - 0.025, y - 0.025, 0.05, 0.05), meters(m.bottom), meters(m.top - m.bottom), BLADE)
    }
    for (const h of [32, 88, 224, 310, 402, 447]) {
      const m = centralPark.find(p => p.top === h)!
      prism(m.plan, meters(h - 2.2), meters(2.2), LEDGE)
    }
    const crown = centralPark[centralPark.length - 1]
    drawMass({ ...crown, bottom: 451 }, { color: '#5c5d66', roof: '#8e8d8c', facade: curtain({ glass: '#44454f', finsEvery: 1, fin: '#8d8e96', spandrel: 0.02 }), outline: null })
    // Rooftop plant stays below the architectural parapet.
    prism(rect(1.35, 1.15, 1.3, 1.1), meters(HEIGHT.centralParkTower - 3), meters(2), { color: '#9a9894', roof: '#b3b0a9', outline: null })
  },
}

// Eight inverted truncated pyramids, 35 m per module, over the tapered base.
const taipei: Mass[] = [
  { bottom: 0, top: 95, plan: chamfer(0.5, 0.5, 5, 5, 0.2), upper: chamfer(1.0, 1.0, 4, 4, 0.2) },
  ...Array.from({ length: 8 }, (_, i): Mass => ({ bottom: 95 + i * 35, top: 130 + i * 35,
    plan: chamfer(1, 1, 4, 4, 0.22), upper: chamfer(0.7, 0.7, 4.6, 4.6, 0.22) })),
  { bottom: 375, top: 411, plan: chamfer(1.25, 1.25, 3.5, 3.5, 0.25), upper: chamfer(1.5, 1.5, 3, 3, 0.25) },
  box(1.75, 1.75, 2.5, 2.5, 411, 438),
  box(2.08, 2.08, 1.84, 1.84, 438, 448),
  { bottom: 448, top: 480, plan: ngon(3, 3, 0.53, 12), upper: ngon(3, 3, 0.22, 12) },
  { bottom: 480, top: 503, plan: ngon(3, 3, 0.18, 12), upper: ngon(3, 3, 0.055, 12) },
]
const TAIPEI: Recipe = {
  size: [6, 6],
  draw() {
    groundQuad(rect(0, 0, 6, 6), '#adae9d')
    taipei.slice(1).forEach(m => drawMass(m, glass('#497b7d', 4.375, 5)))
    for (let i = 0; i < 8; i++) {
      const h = 130 + i * 35
      const edge = chamfer(0.69, 0.69, 4.62, 4.62, 0.23)
      prism(edge, meters(h - 1.1), meters(1.1), { color: '#a7b8ac', roof: '#a7b8ac', outline: null })
      // Projecting ruyi brackets at the four corners of each bamboo segment.
      for (const x of [0.72, 5.08]) for (const y of [0.72, 5.08]) {
        prism(rect(x, y, 0.2, 0.2), meters(h - 6), meters(7.2), { color: '#7faaa0', roof: '#afc7b6', outline: null })
      }
    }
    // Large circular medallions mounted on the vertical lower facade.
    const baseSkin = glazing('#497b7d', 4.375, 5)
    drawMass(taipei[0], { ...glass('#497b7d', 4.375, 5), skin: f => {
      baseSkin(f)
      if (Math.hypot(f.a1[0] - f.a0[0], f.a1[1] - f.a0[1]) < 2) return
      const t = 0.86
      const cx = ((f.a0[0] + f.a1[0]) * (1 - t) + (f.b0[0] + f.b1[0]) * t) / 2
      const cy = ((f.a0[1] + f.a1[1]) * (1 - t) + (f.b0[1] + f.b1[1]) * t) / 2
      const dx = f.a1[0] - f.a0[0], dy = f.a1[1] - f.a0[1], len = Math.hypot(dx, dy)
      const ring = Array.from({ length: 24 }, (_, j) => { const a = j * Math.PI / 12; return iso(cx + dx / len * Math.cos(a) * 0.36, cy + dy / len * Math.cos(a) * 0.36, meters(82 + Math.sin(a) * 4.3)) })
      poly(ring, shade('#a6bcb0', f.k), '#608f86', 1)
    } })
    antenna(3, 3, meters(503), HEIGHT.taipei101 - 503)
  },
}

function wingPlan(lengths: number[], half: number): Pt[] {
  const out: Pt[] = [], inner = half * 2 / Math.sqrt(3)
  lengths.forEach((length, k) => {
    const a = -Math.PI / 2 + k * 2 * Math.PI / 3
    out.push([5 + Math.cos(a - Math.PI / 3) * inner, 5 + Math.sin(a - Math.PI / 3) * inner])
    for (let j = 0; j <= 10; j++) {
      const t = a - Math.PI / 2 + j * Math.PI / 10
      const reach = Math.max(length - half, half / Math.sqrt(3))
      out.push([5 + Math.cos(a) * reach + Math.cos(t) * half, 5 + Math.sin(a) * reach + Math.sin(t) * half])
    }
  })
  return out
}
const burj: Mass[] = []
const reaches = [4.55, 4.1, 3.7]
const levels = [0, 28, 72, 116, 158, 200, 242, 284, 326, 368, 410, 452, 494, 532, 568, 600, 624]
for (let i = 0; i < levels.length - 1; i++) {
  const half = 0.98 - i * 0.029
  burj.push({ plan: wingPlan([...reaches], half), bottom: levels[i], top: levels[i + 1] })
  reaches[i % 3] = Math.max(half * 1.2, reaches[i % 3] - 0.67)
}
for (const [radius, bottom, top] of [[0.58, 624, 654], [0.43, 654, 686], [0.3, 686, 724], [0.18, 724, 768], [0.085, 768, 818]]) {
  burj.push({ plan: ngon(5, 5, radius, 24), bottom, top })
}
const BURJ: Recipe = {
  size: [10, 10],
  draw() {
    groundQuad(rect(0, 0, 10, 10), '#c8bea8')
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 6 + i * Math.PI * 2 / 3
      groundQuad(ngon(5 + Math.cos(a) * 3.3, 5 + Math.sin(a) * 3.3, 0.85, 28), '#648e9b')
    }
    burj.forEach((m, i) => {
      drawMass(m, i < 17 ? glass('#638793', 3.6, 2) : silver)
      if (i < 16) prism(m.plan, meters(m.top - 1.5), meters(1.5), { color: '#a0b5ba', roof: '#b8c6c5', outline: null })
    })
    antenna(5, 5, meters(818), HEIGHT.burjKhalifa - 818)
  },
}

const wtcBase = rect(0.46, 0.46, 5.08, 5.08)
const [a, b, c, d] = wtcBase
// 150 ft square rotated 45 degrees at the parapet (SOM).
const radius = 150 * 0.3048 / Math.SQRT2 / 12
const wtcRoof: Pt[] = [[3, 3 - radius], [3 + radius, 3], [3, 3 + radius], [3 - radius, 3]]
const [n, e, s, w] = wtcRoof
const wtc: Mass[] = [
  { plan: wtcBase, bottom: 0, top: 57 },
  { plan: [a, a, b, b, c, c, d, d], upper: [w, n, n, e, e, s, s, w], bottom: 57, top: 417 },
]
const WTC: Recipe = {
  size: [6, 6],
  draw() {
    groundQuad(rect(0, 0, 6, 6), '#b9b8ac')
    drawMass(wtc[0], { color: '#aebfc0', roof: '#aebfc0', facade: curtain({ glass: '#8babad', finsEvery: 1, fin: '#d2d9d3', spandrel: 0.035 }), outline: null })
    drawMass(wtc[1], glass('#658590', 4.064, 5))
    prism(wtcRoof, meters(417), meters(1), silver)
    // Communication decks are annuli, not a solid cylinder with a painted lid.
    for (const z of [421, 425, 429]) {
      const outer = ngon(3, 3, 1.23, 40), inner = ngon(3, 3, 1.03, 40)
      for (let i = 0; i < outer.length; i++) {
        const next = (i + 1) % outer.length
        prism([outer[i], outer[next], inner[next], inner[i]], meters(z), meters(1.1), silver)
      }
    }
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6
      prism(ngon(3 + Math.cos(angle) * 1.13, 3 + Math.sin(angle) * 1.13, 0.028, 6), meters(418), meters(12.1), silver)
    }
    for (const [r, z0, z1] of [[0.2, 418, 456], [0.15, 456, 492], [0.105, 492, 523], [0.055, 523, 536]]) {
      prism(ngon(3, 3, r, 12), meters(z0), meters(z1 - z0), silver)
      for (let z = z0 + 4; z < z1; z += 4) prism(ngon(3, 3, r + 0.023, 12), meters(z), meters(0.55), { color: '#72848b', outline: null })
    }
    antenna(3, 3, meters(536), HEIGHT.oneWorldTradeCenter - 536)
  },
}

export const SUPERTALL_LANDMARKS = {
  centralParkTower: CENTRAL_PARK, taipei101: TAIPEI,
  burjKhalifa: BURJ, oneWorldTradeCenter: WTC,
}

/** Exterior envelope of the depicted main building, m³; not floor area,
 * concrete quantity, surveyed volume or the bounding box of its sprite. */
export const LANDMARK_DIMENSIONS = {
  centralParkTower: { heightMeters: HEIGHT.centralParkTower, envelopeVolumeM3: volume(centralPark) },
  taipei101: { heightMeters: HEIGHT.taipei101, envelopeVolumeM3: volume(taipei) },
  burjKhalifa: { heightMeters: HEIGHT.burjKhalifa, envelopeVolumeM3: volume(burj) },
  oneWorldTradeCenter: { heightMeters: HEIGHT.oneWorldTradeCenter, envelopeVolumeM3: volume(wtc) },
}
