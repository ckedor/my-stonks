import {
  groundQuad, iso, line, loft, meters, ngon, poly, prism, pyramid, rect, shade,
  type Face, type Facade, type Pt, type Recipe, type Skin,
} from './engine'

/** Woolworth Building. Height: CTBUH, 241.4 m. Plan dimensions
 * follow the historical 152 × 197.83 ft site and 86 × 84 ft lower tower.
 * Intermediate elevations and ornament are interpreted from the reference. */
const HEIGHT = 241.4
const STONE = '#bfb39a', LIGHT = '#d5c9ae', RECESS = '#9a8e78'
const GLASS = '#484b45', COPPER = '#80a998', SEAM = '#577f72'
const plan = (x: number, y: number, w: number, d: number) => rect(x / 12, y / 12, w / 12, d / 12)
const point = (f: Face, u: number, z: number) => iso(
  f.p0[0] + (f.p1[0] - f.p0[0]) * u, f.p0[1] + (f.p1[1] - f.p0[1]) * u, z,
)
const panel = (f: Face, a: number, b: number, lo: number, hi: number, color: string) =>
  poly([point(f, a, lo), point(f, b, lo), point(f, b, hi), point(f, a, hi)], shade(color, f.k), null)

function lancet(f: Face, a: number, b: number, lo: number, hi: number) {
  const spring = hi - (hi - lo) * 0.21
  poly([point(f, a, lo), point(f, b, lo), point(f, b, spring), point(f, (a + b) / 2, hi), point(f, a, spring)], shade(GLASS, f.k), null)
  line([point(f, (a + b) / 2, lo), point(f, (a + b) / 2, spring)], shade(LIGHT, f.k), 0.45)
}

/** Double sash windows in recessed continuous bays; piers remain visually
 * dominant. Pointed heads and tracery terminate the uppermost storey. */
function facade(storeys: number, bayWidth = 3.7, arcade = false): Facade {
  return f => {
    const bays = Math.max(1, Math.round(f.len * 12 / bayWidth))
    const floor = (f.z1 - f.z0) / storeys
    for (let bay = 0; bay < bays; bay++) {
      const a = (bay + 0.16) / bays, b = (bay + 0.84) / bays
      panel(f, a, b, f.z0, f.z1, RECESS)
      for (let row = 0; row < storeys; row++) {
        const lo = f.z0 + row * floor + floor * 0.15, hi = lo + floor * 0.68
        const mid = (a + b) / 2, gap = 0.035 / bays
        if (row === storeys - 1 || (arcade && row === 0)) {
          lancet(f, a, mid - gap, lo, hi); lancet(f, mid + gap, b, lo, hi)
        } else {
          for (const [l, r] of [[a, mid - gap], [mid + gap, b]]) {
            panel(f, l, r, lo, hi, GLASS)
            panel(f, l, r, lo + floor * 0.34, lo + floor * 0.38, '#888577')
            panel(f, l, r, lo, lo + floor * 0.035, LIGHT)
          }
        }
        if (row % 5 === 4) panel(f, a, b, lo - floor * 0.12, lo - floor * 0.055, '#b3a48b')
      }
      panel(f, bay / bays, (bay + 0.065) / bays, f.z0, f.z1, LIGHT)
      panel(f, (bay + 0.925) / bays, (bay + 1) / bays, f.z0, f.z1, '#a89a81')
    }
    panel(f, 0, 1, f.z1 - meters(0.45), f.z1, LIGHT)
  }
}

function block(x: number, y: number, w: number, d: number, bottom: number, top: number, storeys: number) {
  prism(plan(x, y, w, d), meters(bottom), meters(top - bottom), {
    color: STONE, roof: '#8c887b', outline: '#766e5c', facade: facade(storeys, 3.7, bottom === 0),
  })
}
function cornice(x: number, y: number, w: number, d: number, z: number) {
  prism(plan(x - 0.22, y - 0.22, w + 0.44, d + 0.44), meters(z), meters(0.8), { color: '#a89b83', roof: LIGHT, outline: '#8e846f' })
}
const roofSkin: Skin = f => {
  const at = (u: number, v: number) => {
    const a: Pt = [f.a0[0] + (f.a1[0] - f.a0[0]) * u, f.a0[1] + (f.a1[1] - f.a0[1]) * u]
    const b: Pt = [f.b0[0] + (f.b1[0] - f.b0[0]) * u, f.b0[1] + (f.b1[1] - f.b0[1]) * u]
    return iso(a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v, f.z0 + (f.z1 - f.z0) * v)
  }
  for (let i = 1; i < 9; i++) line([at(i / 9, 0), at(i / 9, 1)], shade(SEAM, f.k), 0.45)
  for (const v of [0.25, 0.55, 0.8]) line([at(0, v), at(1, v)], shade(COPPER, f.k * 0.88), 0.4)
  // Three small dormers, drawn on the visible roof plane.
  for (const u of [0.25, 0.5, 0.75]) {
    const a = at(u - 0.045, 0.2), b = at(u + 0.045, 0.2), t = at(u, 0.32)
    poly([a, b, [b[0], b[1] - 3], [t[0], t[1] - 4], [a[0], a[1] - 3]], shade(SEAM, f.k), null)
    line([[a[0], a[1] - 3], [t[0], t[1] - 4], [b[0], b[1] - 3]], shade(LIGHT, f.k), 0.65)
  }
}
function copperRoof(x: number, y: number, w: number, d: number, z: number, top: number) {
  loft([{ poly: plan(x, y, w, d), z: meters(z) },
    { poly: plan(x + w * 0.34, y + d * 0.34, w * 0.32, d * 0.32), z: meters(top) }],
  { color: COPPER, roof: COPPER, outline: SEAM, skin: roofSkin })
}
function pinnacle(x: number, y: number, bottom: number, top: number, radius = 0.7) {
  prism(ngon(x / 12, y / 12, radius / 12, 8), meters(bottom), meters(top - bottom - 3), { color: LIGHT, roof: LIGHT, outline: '#9b917d' })
  pyramid(ngon(x / 12, y / 12, radius * 1.15 / 12, 8), meters(top - 3), meters(3), { color: COPPER, roof: COPPER, outline: SEAM })
}

export const WOOLWORTH: Recipe = {
  size: [6, 4],
  draw() {
    groundQuad(rect(0, 0, 6, 4), '#b5afa0', '#898477', 0.5)
    // Broadway front at x=66.1m. The rear light court opens west.
    block(5.8, 0.84, 60.3, 46.32, 0, 9, 2)
    block(39.9, 0.84, 26.2, 46.32, 9, 108, 27)
    block(5.8, 0.84, 34.1, 12.8, 9, 108, 27)
    block(5.8, 34.36, 34.1, 12.8, 9, 108, 27)
    for (const y of [0.84, 34.36]) {
      cornice(5.8, y, 34.1, 12.8, 108)
      copperRoof(5.8, y, 13.2, 12.8, 109, 119)
      copperRoof(24, y, 12, 12.8, 109, 116)
      for (const x of [6.4, 18.3]) pinnacle(x, y + 0.65, 106, 119)
    }
    for (const y of [0.84, 38.4]) {
      cornice(53.7, y, 12.4, 8.76, 108)
      copperRoof(54, y + 0.25, 11.8, 8.2, 109, 118)
    }
    // Documented 86×84 ft lower tower and 71×69 ft intermediate stage.
    block(39.9, 11.2, 26.2, 25.6, 108, 169, 16)
    cornice(39.9, 11.2, 26.2, 25.6, 169)
    block(44.46, 13.485, 21.64, 21.03, 169.8, 190, 5)
    cornice(44.46, 13.485, 21.64, 21.03, 190)
    // Octagonal upper stage, carved out of a rectangular footprint.
    const oct = (x: number, y: number, w: number, d: number, cut: number): Pt[] =>
      [[x + cut, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + d - cut],
        [x + w - cut, y + d], [x + cut, y + d], [x, y + d - cut], [x, y + cut]].map(([a, b]) => [a / 12, b / 12])
    const crown = oct(44.46, 14.7, 21.64, 18.6, 3.2)
    prism(crown, meters(190.8), meters(17.2), { color: STONE, roof: LIGHT, facade: facade(4, 3.5), outline: '#847c69' })
    for (const [x, y] of [[44.7, 14], [65.8, 14], [44.7, 34], [65.8, 34]]) pinnacle(x, y, 185, 211, 0.8)
    loft([{ poly: crown, z: meters(208) },
      { poly: oct(48.5, 18.75, 13.55, 10.5, 2.1), z: meters(222) },
      { poly: oct(53.2, 22.3, 4.15, 3.4, 0.8), z: meters(233) }],
    { color: COPPER, roof: COPPER, outline: SEAM, skin: roofSkin })
    const cx = 55.275 / 12, cy = 24 / 12
    prism(ngon(cx, cy, 1.65 / 12, 8), meters(233), meters(4.4), { color: LIGHT, roof: COPPER, facade: facade(1, 1.5), outline: SEAM })
    pyramid(ngon(cx, cy, 1.9 / 12, 8), meters(237.4), meters(HEIGHT - 237.4), { color: COPPER, roof: COPPER, outline: SEAM })
  },
}
