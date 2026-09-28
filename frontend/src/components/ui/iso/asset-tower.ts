import { fontStacks } from '@/theme/tokens'
import {
  METERS_PER_FLOOR, METERS_PER_TILE, curtain, dome, floors, glassSkin, groundQuad, lettering, loft,
  meters, ngon, prism, pyramid, rect, rotate, rounded, scaleAbout, strips, tree,
  type Facade, type Pt, type Recipe,
} from './engine'

/* The headquarters of an asset: a family of its own, drawn apart from the
 * rest of the city. What only these buildings have is the brass — a
 * plinth of dark stone with a brass edge, a black sign band lettered in
 * gold, a brass cornice and a brass finial — and a paved forecourt with
 * planters, where the ordinary lots are bare pavement.
 *
 * Each class has its own silhouette, and every one runs straight from the
 * lobby to the crown, so its height reads true:
 *
 *   twist   — glass, the plan turning about its axis as it rises;
 *   ribbed  — a square with rounded corners behind bronze ribs;
 *   column  — a fluted marble column on the steps of a temple, domed;
 *   facet   — a hexagon of black glass with brass edges.
 *
 * The ticker picks one of three tints within the class, so two buildings
 * of the same class are not twins.
 *
 * The size follows from the volume alone. The height grows along a curve,
 * and the plan is then as wide as it must be for floor area times storey
 * height to give the volume; the lot is the smallest of 1 to 6 tiles that
 * holds the plan's widest extent with a forecourt round it. */

export type AssetTowerStyle = 'twist' | 'ribbed' | 'column' | 'facet'
type AssetTowerLot = 1 | 2 | 3 | 4 | 5 | 6

export interface AssetTowerSpec {
  /** m³ above ground, lobby included; plinth and crown do not count. */
  volume: number
  style: AssetTowerStyle
  /** The sign on the crown; a short code reads best. */
  sign: string
  /** A smaller line under the sign. */
  caption?: string
}

export interface AssetTowerShape {
  floors: number
  /** The plan's width, in tiles. */
  side: number
  lot: AssetTowerLot
}

/** A reference point on the height curve: a tower of this volume has
 *  this many floors. */
const REFERENCE = { volume: 1_900_000, floors: 130 }
/** Height grows as volume to this power, width takes the rest: small
 *  towers come out squat, big ones tall but still broad. */
const GROWTH = 0.5
const FORECOURT = 0.14
const MAX_LOT = 6
const FLOOR_M3_PER_TILE = METERS_PER_TILE ** 2 * METERS_PER_FLOOR
/** How far the twisting tower turns per floor, and at most. */
const TWIST_PER_FLOOR = Math.PI / 180 * 1.1
const MAX_TWIST = Math.PI / 4

const BRASS = '#c7a55c'
const BRASS_DARK = '#8f7338'
const GOLD_TEXT = '#f0d690'
const PLINTH = '#3b3a3f'

interface Plan {
  /** The plan centred on (c, c), `s` tiles wide. */
  at: (c: number, s: number) => Pt[]
  /** Its area, as a share of s². */
  area: number
  /** The widest it gets on the ground, as a share of s, for `floors`. */
  extent: (floors: number) => number
}

const twistOf = (count: number) => Math.min(MAX_TWIST, TWIST_PER_FLOOR * Math.max(0, count - 1))
const square = (c: number, s: number) => rect(c - s / 2, c - s / 2, s, s)
const PLANS: Record<AssetTowerStyle, Plan> = {
  twist: { at: square, area: 1, extent: count => Math.cos(twistOf(count)) + Math.sin(twistOf(count)) },
  ribbed: { at: (c, s) => rounded(c - s / 2, c - s / 2, s, s, s * 0.18, 4), area: 1 - (4 - Math.PI) * 0.18 ** 2, extent: () => 1.08 },
  column: { at: (c, s) => ngon(c, c, s / 2, 24), area: 12 * Math.sin(Math.PI / 12) / 4, extent: () => 1 },
  facet: { at: (c, s) => ngon(c, c, s / 2, 6), area: 3 * Math.sqrt(3) / 8, extent: () => 1.06 },
}

/** How tall, how wide and on what lot a tower of this volume stands. A
 *  plan too wide for the largest lot adds floors instead. */
export function assetTowerShape(volume: number, style: AssetTowerStyle): AssetTowerShape {
  const plan = PLANS[style]
  const v = Math.max(1, volume)
  const floorsFor = (side: number) => v / (FLOOR_M3_PER_TILE * plan.area * side ** 2)
  let count = Math.max(1, Math.round(REFERENCE.floors * (v / REFERENCE.volume) ** GROWTH))
  // The widest plan the largest lot holds, for this many floors.
  for (let i = 0; i < 4; i++) {
    const widest = (MAX_LOT - 2 * FORECOURT) / plan.extent(count)
    count = Math.max(count, Math.ceil(floorsFor(widest)))
  }
  const side = Math.sqrt(v / (FLOOR_M3_PER_TILE * plan.area * count))
  const lot = Math.min(MAX_LOT, Math.max(1, Math.ceil(side * plan.extent(count) + 2 * FORECOURT - 1e-9))) as AssetTowerLot
  return { floors: count, side, lot }
}

interface Look {
  body: string
  glass: string
  glass2: string
  /** Ribs, piers, mullions. */
  trim: string
}

/** Three tints per class; the ticker picks one. */
const LOOKS: Record<AssetTowerStyle, Look[]> = {
  twist: [
    { body: '#4e6f82', glass: '#3f6276', glass2: '#9fc0cf', trim: BRASS },
    { body: '#4a6f68', glass: '#3a6159', glass2: '#98c4b8', trim: BRASS },
    { body: '#57607f', glass: '#48516f', glass2: '#a9b3d0', trim: BRASS },
  ],
  ribbed: [
    { body: '#6b5443', glass: '#3e3029', glass2: '#7a6150', trim: '#a57a4d' },
    { body: '#5d5347', glass: '#342d27', glass2: '#6d6152', trim: '#b08a58' },
    { body: '#6e4c43', glass: '#3a2824', glass2: '#7b584c', trim: '#a8764f' },
  ],
  column: [
    { body: '#ece6d8', glass: '#d3cab5', glass2: '#ece6d8', trim: BRASS },
    { body: '#e6e2da', glass: '#cbc6ba', glass2: '#e6e2da', trim: BRASS },
    { body: '#efe3d3', glass: '#d8c6ad', glass2: '#efe3d3', trim: BRASS },
  ],
  facet: [
    { body: '#1f2026', glass: '#23252d', glass2: '#4a4d58', trim: BRASS },
    { body: '#222027', glass: '#27232d', glass2: '#514a5c', trim: BRASS },
    { body: '#1c2224', glass: '#20282b', glass2: '#46565b', trim: BRASS },
  ],
}

const hash = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

export function assetTowerRecipe(spec: AssetTowerSpec): Recipe {
  const { style } = spec
  const plan = PLANS[style]
  const look = LOOKS[style][hash(spec.sign) % 3]
  const { floors: count, side, lot } = assetTowerShape(spec.volume, style)
  const c = lot / 2
  const outline = plan.at(c, side)
  const twist = style === 'twist' ? twistOf(count) : 0
  const top = rotate(outline, twist, [c, c])
  const sign: Facade = lettering({
    text: spec.sign.toUpperCase(), caption: spec.caption, background: '#141416', color: GOLD_TEXT,
    font: fontStacks.grotesk, minLength: side * 0.3,
  })

  return {
    size: [lot, lot],
    draw() {
      // The forecourt: paving with a brass-edged border and two planters.
      groundQuad(rect(0, 0, lot, lot), '#d6cdbb')
      groundQuad(rect(0.05, 0.05, lot - 0.1, lot - 0.1), '#e2dac9', BRASS_DARK, 0.8)
      if (lot >= 2) {
        for (const [x, y] of [[lot - 0.3, 0.1], [0.1, lot - 0.3]]) {
          groundQuad(rect(x, y, 0.2, 0.2), '#5f8a47', '#3c5a2e', 0.8)
          tree(x + 0.1, y + 0.1, 0.5 + lot * 0.05)
        }
      }

      // The plinth every class stands on; the column's is a temple's three
      // steps.
      if (style === 'column') {
        ;[1.24, 1.16, 1.08].forEach((k, i) => prism(scaleAbout(outline, k), meters(0.55 * i), meters(0.55), { color: '#d9d2c3', roof: '#e7e1d4' }))
      } else {
        prism(scaleAbout(outline, 1.1), 0, meters(1.2), { color: PLINTH, roof: '#57565c' })
        prism(scaleAbout(outline, 1.1), meters(1.2), meters(0.3), { color: BRASS, roof: BRASS })
      }
      const base = style === 'column' ? meters(1.65) : meters(1.5)

      // The lobby: dark glass between brass fins.
      prism(outline, base, floors(1) - base, { color: PLINTH, facade: curtain({ glass: '#1d2129', finsEvery: 1, fin: BRASS, spandrel: 0, glints: false }) })

      // The shaft, straight to the crown.
      if (count > 1) {
        const from = floors(1), to = floors(count)
        if (style === 'twist') {
          const steps = Math.max(1, Math.min(count - 1, 24))
          loft(Array.from({ length: steps + 1 }, (_, i) => ({
            poly: rotate(outline, twist * i / steps, [c, c]),
            z: from + (to - from) * i / steps,
          })), { color: look.body, roof: look.body, skin: glassSkin({ glass: look.glass, glass2: look.glass2, span: [from, to], mullion: look.trim, glints: false }) })
        } else if (style === 'ribbed') {
          prism(outline, from, to - from, { color: look.body, facade: curtain({ glass: look.glass, glass2: look.glass2, finsEvery: 2, fin: look.trim, spandrel: 0.25, glints: false }) })
          // Bronze ribs along the straight part of every side.
          const [x0, r] = [c - side / 2, side * 0.18]
          const ribs = Math.max(2, Math.round((side - 2 * r) * 3.2))
          for (let i = 0; i <= ribs; i++) {
            const t = x0 + r + (side - 2 * r) * i / ribs
            for (const rib of [rect(t - 0.025, x0 - 0.05, 0.05, 0.06), rect(t - 0.025, x0 + side - 0.01, 0.05, 0.06),
              rect(x0 - 0.05, t - 0.025, 0.06, 0.05), rect(x0 + side - 0.01, t - 0.025, 0.06, 0.05)]) {
              prism(rib, from, to - from, { color: look.trim, roof: look.trim })
            }
          }
        } else if (style === 'column') {
          prism(outline, from, to - from, { color: look.body, facade: strips({ glass: look.glass, module: 1.1, base: 0, top: 0 }) })
        } else {
          prism(outline, from, to - from, { color: look.body, facade: curtain({ glass: look.glass, glass2: look.glass2, finsEvery: 3, fin: '#3a3a42', spandrel: 0.2, glints: false }) })
          // Brass on every edge of the hexagon.
          for (const [x, y] of outline) prism(rect(x - 0.03, y - 0.03, 0.06, 0.06), base, to - base, { color: BRASS, roof: BRASS })
        }
      }

      // The crown: the sign band, a brass cornice, then the class's finial.
      const z = floors(count)
      const band = count >= 30 ? floors(2.8) : count >= 10 ? floors(2.1) : meters(4.4)
      const bandPlan = style === 'column' ? ngon(c, c, side / 2, 8, Math.PI / 8) : top
      prism(bandPlan, z, band, { color: '#141416', roof: '#2a2a2e', facade: sign })
      // Brass at the rim only; the roof itself is dark.
      prism(scaleAbout(bandPlan, 1.06), z + band, meters(0.9), { color: BRASS, roof: '#3a393e', parapet: 0.05 })
      const roof = z + band + meters(0.9)
      const reach = side / 2
      if (style === 'column') {
        dome(ngon(c, c, reach * 0.62, 16), roof, meters(reach * METERS_PER_TILE * 0.5), { color: BRASS, roof: BRASS })
      } else if (style === 'facet') {
        prism(ngon(c, c, reach * 0.55, 6), roof, meters(3), { color: '#141416', roof: '#2a2a2e' })
        pyramid(ngon(c, c, reach * 0.16, 6), roof + meters(3), meters(4 + count * 0.12), { color: BRASS, roof: BRASS })
      } else {
        prism(scaleAbout(top, 0.4), roof, meters(3.5), { color: '#141416', roof: '#2a2a2e' })
        pyramid(rect(c - 0.06, c - 0.06, 0.12, 0.12), roof + meters(3.5), meters(6 + count * 0.18), { color: BRASS, roof: BRASS })
      }
    },
  }
}
