import {
  antenna,
  balconies,
  centroid,
  chamfer,
  clutter,
  curtain,
  dome,
  floors,
  gable,
  groundLine,
  groundQuad,
  inset,
  mansard,
  meters,
  ngon,
  prism,
  punched,
  pyramid,
  rect,
  ribbons,
  rotate,
  rounded,
  scaleAbout,
  storefront,
  strips,
  tank,
  tree,
  type Recipe,
} from './engine'
import { RESIDENTIAL_RECIPES } from './residential'
import { VEGETATION_RECIPES } from './vegetation'
import { REFERENCE_TOWERS } from './reference-towers'
import { REFERENCE_MIDRISE } from './reference-midrise'
import { GHERKIN } from './gherkin'
import { EMPIRE_STATE } from './empire-state'
import { WOOLWORTH } from './woolworth'
import { SUPERTALL_LANDMARKS } from './supertall-landmarks'

/* The drawings: what each piece of the city looks like, in plan
 * coordinates of its own footprint. Knowing a piece's name and look is
 * art, like an icon set; what a piece means or costs is not here.
 *
 * Every size follows the ruler in `engine.ts` — a tile is a 12 m lot, a
 * storey is 3.5 m — so plans are in tiles and heights in storeys or metres:
 *
 *   house, row house   1 tile or less     2–4 storeys
 *   walk-up            2 × 1 to 2 × 2     5–8
 *   mid-rise           2 × 2              10–20
 *   tower              2 × 2 to 3 × 3     30–60
 *   supertall, landmark 3 × 3 to 4 × 4    60+
 */

const ASPHALT = '#5b5d64'
const PAVING = '#cbc5ba'
const GRASS = '#7aa452'
const PATH = '#d9cfb9'

const tile = (fill: string) => groundQuad(rect(0, 0, 1, 1), fill)

export const ISO_RECIPES = {
  ...RESIDENTIAL_RECIPES,
  ...VEGETATION_RECIPES,
  ...SUPERTALL_LANDMARKS,
  ...REFERENCE_TOWERS,
  ...REFERENCE_MIDRISE,
  gherkin: GHERKIN,
  empireState: EMPIRE_STATE,
  woolworth: WOOLWORTH,
  road: {
    size: [1, 1],
    draw() {
      tile(ASPHALT)
      groundLine([0, 0.03], [1, 0.03], '#8f8a82', 1.2)
      groundLine([0, 0.97], [1, 0.97], '#8f8a82', 1.2)
      groundLine([0.1, 0.5], [0.9, 0.5], '#e9e3d4', 1.2, [6, 6])
    },
  },
  crossing: {
    size: [1, 1],
    draw() {
      tile(ASPHALT)
      for (let i = 0; i < 6; i++) {
        const t = 0.06 + i * 0.155
        groundQuad(rect(t, 0.02, 0.08, 0.2), '#ece7dc')
        groundQuad(rect(t, 0.78, 0.08, 0.2), '#ece7dc')
        groundQuad(rect(0.02, t, 0.2, 0.08), '#ece7dc')
        groundQuad(rect(0.78, t, 0.2, 0.08), '#ece7dc')
      }
    },
  },
  /** A road with a zebra across it, for the middle of a block. */
  crosswalk: {
    size: [1, 1],
    draw() {
      tile(ASPHALT)
      groundLine([0, 0.03], [1, 0.03], '#8f8a82', 1.2)
      groundLine([0, 0.97], [1, 0.97], '#8f8a82', 1.2)
      for (let i = 0; i < 6; i++) groundQuad(rect(0.3, 0.08 + i * 0.145, 0.4, 0.08), '#ece7dc')
    },
  },
  /** Two tiles wide: two lanes each way, a double yellow line between. */
  avenue: {
    size: [1, 2],
    draw() {
      groundQuad(rect(0, 0, 1, 2), ASPHALT)
      groundLine([0, 0.03], [1, 0.03], '#8f8a82', 1.2)
      groundLine([0, 1.97], [1, 1.97], '#8f8a82', 1.2)
      groundLine([0.05, 0.5], [0.95, 0.5], '#e9e3d4', 1.1, [6, 6])
      groundLine([0.05, 1.5], [0.95, 1.5], '#e9e3d4', 1.1, [6, 6])
      groundLine([0, 0.97], [1, 0.97], '#e3b53f', 1.1)
      groundLine([0, 1.03], [1, 1.03], '#e3b53f', 1.1)
    },
  },
  /** An avenue with a planted median and a tree on it. */
  boulevard: {
    size: [1, 2],
    draw() {
      groundQuad(rect(0, 0, 1, 2), ASPHALT)
      groundLine([0, 0.03], [1, 0.03], '#8f8a82', 1.2)
      groundLine([0, 1.97], [1, 1.97], '#8f8a82', 1.2)
      groundLine([0.05, 0.42], [0.95, 0.42], '#e9e3d4', 1.1, [6, 6])
      groundLine([0.05, 1.58], [0.95, 1.58], '#e9e3d4', 1.1, [6, 6])
      groundQuad(rect(0, 0.82, 1, 0.36), '#bdb6a6')
      groundQuad(rect(0, 0.86, 1, 0.28), GRASS)
      tree(0.5, 1, 0.6)
    },
  },
  /** Where two avenues meet: crosswalks on all four sides. */
  avenueCrossing: {
    size: [2, 2],
    draw() {
      groundQuad(rect(0, 0, 2, 2), ASPHALT)
      for (let i = 0; i < 11; i++) {
        const t = 0.1 + i * 0.165
        groundQuad(rect(t, 0.03, 0.08, 0.22), '#ece7dc')
        groundQuad(rect(t, 1.75, 0.08, 0.22), '#ece7dc')
        groundQuad(rect(0.03, t, 0.22, 0.08), '#ece7dc')
        groundQuad(rect(1.75, t, 0.22, 0.08), '#ece7dc')
      }
    },
  },
  sidewalk: {
    size: [1, 1],
    draw() {
      tile(PAVING)
      groundLine([0.5, 0], [0.5, 1], 'rgba(60,50,60,0.14)', 0.6)
      groundLine([0, 0.5], [1, 0.5], 'rgba(60,50,60,0.14)', 0.6)
    },
  },
  lawn: {
    size: [1, 1],
    draw() { tile(GRASS) },
  },
  tree: {
    size: [1, 1],
    // Only the tree: a tile of paving under it would be drawn after the
    // shadows and cut a light square out of its neighbour's shadow.
    draw() { tree(0.5, 0.5, 1.05) },
  },
  square: {
    size: [3, 3],
    draw() {
      groundQuad(rect(0, 0, 3, 3), GRASS)
      groundQuad(rect(1.28, 0, 0.44, 3), PATH)
      groundQuad(rect(0, 1.28, 3, 0.44), PATH)
      groundQuad(ngon(1.5, 1.5, 0.42, 16), '#c8bca3', '#2a2024', 1)
      groundQuad(ngon(1.5, 1.5, 0.24, 16), '#b0574a', '#2a2024', 1)
      for (const [x, y] of [[0.55, 0.55], [2.45, 0.55], [0.55, 2.45], [2.45, 2.45]]) tree(x, y, 0.95)
    },
  },

  /** 48 m of civic block: a classical base, a mansard, and a tower with a
   *  dome and a lantern. */
  cityHall: {
    size: [4, 4],
    draw() {
      const stone = '#cfae8a'
      const plan = chamfer(0.3, 0.3, 3.4, 3.4, 0.55)
      const h = floors(22)
      prism(plan, 0, h, { color: stone, roof: '#8e8a8e', facade: punched({ base: { floors: 2, color: '#b99a78', glass: '#3a3230', trim: '#efe3cf' }, bandEvery: 6, band: '#eadcc4', cornice: '#e6d6bb', glass: '#3d3431', pairs: true, litChance: 0.04 }) })
      mansard(plan, h, meters(5), 0.28, { color: stone, roof: '#8a8488' })
      const top = h + meters(5)
      for (const [px, py] of [[0.55, 0.55], [2.55, 0.55]]) {
        const pavilion = rect(px, py, 0.95, 0.95)
        prism(pavilion, top, floors(2), { color: stone, facade: punched({ cornice: '#e6d6bb', glass: '#3d3431' }) })
        pyramid(pavilion, top + floors(2), meters(6), { color: '#9c8f86', roof: '#9c8f86' })
      }
      const shaft = rect(1.5, 1.5, 1.0, 1.0)
      const shaftTop = top + floors(6)
      prism(shaft, top, floors(6), { color: stone, parapet: 0.06, facade: punched({ bandEvery: 2, band: '#eadcc4', cornice: '#e6d6bb', glass: '#3d3431' }) })
      for (const [tx, ty] of [[1.56, 1.56], [2.44, 1.56], [1.56, 2.44], [2.44, 2.44]]) {
        const turret = ngon(tx, ty, 0.1, 8)
        prism(turret, shaftTop, meters(5), { color: stone })
        pyramid(turret, shaftTop + meters(5), meters(6), { color: '#8f8a8c', roof: '#8f8a8c' })
      }
      const drum = ngon(2, 2, 0.36, 12, Math.PI / 12)
      prism(drum, shaftTop, floors(2.4), { color: '#d9bd98', facade: punched({ module: 2.2, w: 0.4, tall: true, glass: '#2f2826' }) })
      const drumTop = shaftTop + floors(2.4)
      dome(drum, drumTop, meters(9), { color: '#9b938d', roof: '#9b938d' })
      const lantern = ngon(2, 2, 0.1, 8)
      prism(lantern, drumTop + meters(9), meters(4), { color: '#e2cfae' })
      pyramid(lantern, drumTop + meters(13), meters(6), { color: '#b58f4a', roof: '#b58f4a' })
    },
  },
  /** A supertall: a brick podium and 75 storeys of glass in three setbacks. */
  glassTower: {
    size: [3, 3],
    draw() {
      prism(rect(0.05, 0.05, 2.9, 2.9), 0, floors(6), { color: '#9a5b45', parapet: 0.05, facade: punched({ base: { floors: 1, color: '#7d4a3a', awnings: ['#2f5d50', '#3d4d6b'] }, glass: '#342a2c' }) })
      const glass = { glass: '#39455e', glass2: '#6d7d98', finsEvery: 4 }
      prism(rounded(0.3, 0.35, 2.3, 2.2, 0.5), floors(6), floors(44), { color: '#4a5570', roof: '#8d939c', facade: curtain(glass) })
      prism(rounded(0.5, 0.35, 1.95, 1.85, 0.42), floors(50), floors(15), { color: '#4a5570', roof: '#8d939c', facade: curtain(glass) })
      const top = rounded(0.72, 0.5, 1.5, 1.4, 0.35)
      prism(top, floors(65), floors(10), { color: '#4a5570', roof: '#9aa0a8', parapet: 0.06, facade: curtain({ ...glass, crown: 1, crownColor: '#c3c8cf' }) })
      clutter(top, floors(75), 3)
      antenna(...centroid(top), floors(75), 24)
    },
  },
  /** Broad concrete office slab, with a planted mechanical terrace at
   *  the roof of a separate lower front building, based on the reference. */
  terraceTower: {
    size: [9, 9],
    draw() {
      // Turn the whole composition toward the viewer, including rooftop
      // details. Scale both plan axes equally so the broad facades retain
      // substantial depth. Heights remain independent of the footprint.
      const towerRect = (x: number, y: number, w: number, d: number) =>
        rotate(rect(2 + (x - 2) * 3, 1.7 + (y - 1.7) * 3, w * 3, d * 3), -Math.PI * 40 / 180, [2, 1.7])
          .map(([px, py]): [number, number] => [4.5 + (px - 2) * 0.6, 4.5 + (py - 1.7) * 0.6])
      const concrete = '#b9bcb8'
      const roof = '#969b89'
      const plan = towerRect(0.18, 0.25, 3.64, 1.75)
      const top = floors(48)
      const facade = punched({ module: 2.2, w: 0.72, glass: '#454b58', litChance: 0, cornice: '#cbd0c9' })

      // Glazed lobby and the uninterrupted grid of the main slab.
      prism(plan, 0, floors(2), { color: concrete, facade: curtain({ glass: '#424d56', finsEvery: 2, fin: concrete }) })
      prism(plan, floors(2), floors(46), { color: concrete, roof, parapet: 0.06, facade })

      // A second building rises from street level in front of the tower.
      // Its glazed top floor supports the planted roof and equipment.
      const terrace = towerRect(0.12, 2.0, 3.76, 0.88)
      const terraceTop = floors(17)
      prism(terrace, 0, floors(2), { color: concrete, facade: curtain({ glass: '#424d56', finsEvery: 2, fin: concrete }) })
      prism(terrace, floors(2), floors(13), { color: concrete, facade })
      prism(terrace, floors(15), floors(2), { color: concrete, roof: '#cbd0c9', facade: curtain({ glass: '#424650', finsEvery: 2, fin: concrete }) })
      for (const x of [0.22, 2.8]) {
        prism(towerRect(x, 2.46, 0.95, 0.34), terraceTop, meters(0.25), { color: '#858c68', roof: GRASS })
      }
      for (const x of [1.3, 1.65, 2.0]) {
        prism(towerRect(x, 2.46, 0.22, 0.34), terraceTop, meters(1.6), { color: '#999f9f', roof: '#d0d4ca' })
      }
      prism(towerRect(2.36, 2.45, 0.34, 0.35), terraceTop, meters(1), { color: '#b9bcb0', roof: '#deded0' })

      // Raised roof edges and a compact mechanical penthouse with ducts.
      prism(towerRect(0.18, 0.25, 3.64, 0.06), top, meters(1), { color: concrete })
      prism(towerRect(0.18, 0.31, 0.06, 1.69), top, meters(1), { color: concrete })
      prism(towerRect(3.76, 0.31, 0.06, 1.69), top, meters(1), { color: concrete })
      prism(towerRect(0.24, 1.94, 3.52, 0.06), top, meters(1), { color: concrete })
      prism(towerRect(1.2, 0.8, 1.65, 0.86), top, meters(5), { color: '#8d8e86', roof: '#b9bbac' })
      prism(towerRect(2.48, 0.94, 0.23, 0.5), top + meters(5), meters(0.7), { color: '#525a60' })
      for (const x of [1.25, 1.65, 2.05]) {
        prism(towerRect(x, 1.66, 0.2, 0.28), top, meters(1.5), { color: '#c6c5b7' })
      }

      // Low entrance canopy and planters at street level.
      prism(towerRect(0.25, 2.88, 1.15, 0.42), 0, meters(3.5), { color: concrete, roof: '#a9ae9b', facade: curtain({ glass: '#576667' }) })
      for (const x of [2.0, 2.55, 3.1]) {
        prism(towerRect(x, 3.02, 0.4, 0.22), 0, meters(0.8), { color: '#b49a84', roof: GRASS })
      }
    },
  },
  /** A white residential tower of 44 storeys, after a Tokyo reference: a
   *  long octagon of balconies, a row of green-glass windows under a
   *  louvred crown, a heavy roof slab, a dome set into one cut corner,
   *  and a court on the roof. */
  balconyTower: {
    size: [4, 3],
    draw() {
      const white = '#eef0ec'
      const plan = chamfer(0.4, 0.3, 3.2, 2.4, 0.62)
      // A paved forecourt, a row of trees, the entrance canopy in front.
      groundQuad(rect(0, 0, 4, 3), PAVING)
      groundQuad(rect(3.7, 0.05, 0.25, 2.9), '#7aa452')
      for (let y = 0.35; y < 2.9; y += 0.62) tree(3.83, y, 0.7)
      prism(rect(1.55, 2.7, 0.9, 0.24), meters(3.2), meters(0.4), { color: white, roof: '#c9ccc8' })
      for (const x of [1.6, 2.35]) prism(rect(x, 2.86, 0.05, 0.05), 0, meters(3.2), { color: '#9aa09c' })
      prism(plan, 0, floors(2), { color: '#8c8178', facade: curtain({ glass: '#3f4a52', finsEvery: 2, fin: '#b9b2a8' }) })
      prism(plan, floors(2), floors(38), { color: white, facade: balconies({ glass: '#a4c3d6' }) })
      prism(plan, floors(40), floors(1), { color: white, facade: punched({ module: 3.6, w: 0.62, glass: '#2f6b64' }) })
      prism(plan, floors(41), floors(3), { color: white, facade: strips({ glass: '#9ba9ae', module: 1.1, base: 0.1, top: 0.1 }) })
      // The roof slab overhangs the crown all round.
      const roof = floors(44) + meters(1.4)
      prism(scaleAbout(plan, 1.035), floors(44), meters(1.4), { color: '#8f928f', roof: '#c9ccc8' })
      prism(rect(1.5, 0.95, 1.2, 1.1), roof, meters(0.3), { color: '#3c7a60', roof: '#4b9373' })
      prism(rect(1.62, 1.08, 0.96, 0.84), roof + meters(0.3), meters(0.05), { color: '#e8ece6', roof: '#58a07f' })
      for (const side of [rect(1.3, 0.72, 1.6, 0.1), rect(1.3, 2.18, 1.6, 0.1)]) {
        prism(side, roof, meters(2.2), { color: white, roof: white, facade: strips({ glass: '#b5bfc2', module: 0.9, base: 0, top: 0.15 }) })
      }
      prism(rect(3.0, 0.6, 0.38, 0.5), roof, meters(3.5), { color: '#c3c6c1', roof: '#a3a7a2' })
      // The dome fills the cut corner nearest the street.
      const cupola = ngon(0.98, 2.1, 0.46, 16)
      prism(cupola, roof, meters(1.2), { color: '#d9dcd7', roof: '#c9ccc7' })
      dome(cupola, roof + meters(1.2), meters(6.5), { color: '#bfc4bf', roof: '#bfc4bf' }, 5)
      antenna(0.98, 2.1, roof + meters(7.7), 5)
    },
  },
  /** 36 m of brick, 40 storeys, rounded corners, a tank on the roof. */
  brickTower: {
    size: [3, 3],
    draw() {
      const plan = rounded(0.25, 0.25, 2.5, 2.5, 0.4, 3)
      const h = floors(40)
      prism(plan, 0, h, { color: '#8b5a45', roof: '#9b8a80', parapet: 0.08, facade: punched({ base: { floors: 1, color: '#6d4636', glass: '#2d2a2e' }, glass: '#3a2f33', litChance: 0.1, bandEvery: 10, band: '#a57a64' }) })
      prism(rect(0.95, 0.95, 1.0, 0.8), h, floors(1.5), { color: '#7d5446', facade: punched({ glass: '#3a2f33' }) })
      clutter(plan, h, 3)
      tank(2.2, 1.1, h)
    },
  },
  /** Four setbacks of sandstone and a pyramid crown with a mast. */
  artDeco: {
    size: [3, 3],
    draw() {
      const color = '#d7c29d'
      const tiers: [number, number][] = [[0.1, 18], [0.45, 14], [0.75, 10], [1.0, 8]]
      let z = 0
      tiers.forEach(([k, n], i) => {
        const plan = rect(0.1 + k * 0.9, 0.1 + k * 0.9, 2.8 - k * 1.8, 2.8 - k * 1.8)
        prism(plan, z, floors(n), { color, roof: '#b9a98c', parapet: 0.05, facade: strips({ glass: '#3b3a45', base: i === 0 ? 1.4 : 0.5 }) })
        z += floors(n)
      })
      pyramid(rect(1.18, 1.18, 0.64, 0.64), z, meters(15), { color: '#c8b48a', roof: '#c8b48a' })
      antenna(1.5, 1.5, z + meters(15), 12)
    },
  },
  /** A six-storey walk-up over shops, with a fire escape and a tank. */
  walkUp: {
    size: [2, 2],
    draw() {
      const plan = rect(0.05, 0.05, 1.9, 1.9)
      const h = floors(1) * 1.3 + floors(6) + meters(1.2)
      prism(plan, 0, h, { color: '#a14f3c', roof: '#9d8479', parapet: 0.06, facade: punched({ base: { floors: 1, color: '#5b5f63', glass: '#26303a', awnings: ['#2f6f5b', '#c24b3a', '#e0b13c'] }, cornice: '#e3d8c4', glass: '#352c31', frame: '#e2d6c2', fire: true, litChance: 0.12, lit: '#e2cf9a' }) })
      clutter(plan, h, 2, true)
    },
  },
  /** A glass slab of 46 storeys, turned 30° off the street grid. */
  turnedTower: {
    size: [2, 2],
    draw() {
      const plan = rotate(rect(0.25, 0.5, 1.5, 1.0), Math.PI / 6)
      prism(plan, 0, floors(46), { color: '#dfe3e6', roof: '#aab0b6', parapet: 0.05, facade: ribbons({ glass: '#3f6f78' }) })
      prism(rotate(rect(0.5, 0.68, 1.0, 0.62), Math.PI / 6, centroid(plan)), floors(46), floors(1.5), { color: '#c9ced3', roof: '#aab0b6' })
      antenna(...centroid(plan), floors(47.5), 10)
    },
  },
  /** A one-storey diner with striped awnings and a sign on the roof. */
  diner: {
    size: [2, 1],
    draw() {
      const plan = rect(0.05, 0.05, 1.9, 0.9)
      const h = meters(4.5)
      prism(plan, 0, h, { color: '#e2d7c3', roof: '#a7a39c', parapet: 0.05, facade: F => storefront(F, F.z0, h, { color: '#c8482f', glass: '#2c3a44', awnings: ['#e8e0cf', '#c8482f'], trim: '#f2e9d6' }) })
      prism(rect(0.55, 0.86, 0.9, 0.04), h, meters(3), { color: '#2d5f8a', roof: '#2d5f8a' })
      clutter(plan, h, 2)
    },
  },
  /** A stone nave with a gable roof, and a bell tower with a spire. */
  church: {
    size: [2, 3],
    draw() {
      const stone = '#a8a197'
      prism(rect(0.4, 0.9, 1.2, 2.0), 0, meters(14), { color: stone, facade: punched({ module: 4.5, w: 0.35, tall: true, glass: '#3a3b52', cornice: '#bfb8ad' }) })
      gable(0.4, 0.9, 1.2, 2.0, meters(14), meters(8), false, { color: '#6c5e57', roof: '#6c5e57' })
      const tower = rect(0.65, 0.15, 0.7, 0.75)
      prism(tower, 0, meters(34), { color: stone, facade: punched({ module: 4, w: 0.4, tall: true, glass: '#2d2b36', bandEvery: 4, band: '#c7c0b4' }) })
      prism(inset(tower, 0.06), meters(34), meters(4), { color: '#b5aea3' })
      pyramid(inset(tower, 0.06), meters(38), meters(20), { color: '#5f6a6e', roof: '#5f6a6e' })
    },
  },
  /** A round tower of 30 storeys with a set-back crown. */
  roundTower: {
    size: [2, 2],
    draw() {
      prism(ngon(1, 1, 0.92, 18), 0, floors(30), { color: '#c7b8a4', roof: '#a49b90', parapet: 0.05, facade: ribbons({ glass: '#434b57', base: 1 }) })
      const crown = ngon(1, 1, 0.68, 18)
      prism(crown, floors(30), floors(2), { color: '#b3a590', facade: strips({ glass: '#434b57', base: 0.2, top: 0.2 }) })
      clutter(crown, floors(32), 2)
    },
  },
} satisfies Record<string, Recipe>

export type IsoRecipeKey = keyof typeof ISO_RECIPES
