import type { IsoTerrain } from '@/components/ui'

export const CITY_MAP_SIZE = 512

/* The map is authored in the board's projected diamond: u runs left to
 * right on screen, v top to bottom, and the board is |u| + |v| ≤ 1. Both
 * are ground distances, so a shape drawn here is the shape on the ground.
 * On screen v is halved, so an island reads as tall only when it runs
 * more than twice as far in v as in u.
 *
 * An archipelago, with no mainland: two central islands in the manner of
 * Vice City — a big, ragged one to the west and a long, thin beach island
 * to the east, with an islet between them — and islands large and small
 * scattered round them, the desert ones farthest out. The central two are
 * hand-placed points; the rest are irregular outlines grown from a seed.
 * Every coast is smoothed into curves and roughened along its length.
 * Rendering and placement use the same outlines. */

type UV = [number, number]

/** Corner cutting: every pass replaces each corner with two points a
 *  quarter of the way along its edges. An open line keeps its ends. */
function smooth(points: UV[], closed: boolean, passes = 4): UV[] {
  let out = points
  for (let pass = 0; pass < passes; pass++) {
    const n = out.length
    const next: UV[] = closed ? [] : [out[0]]
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const [a, b] = [out[i], out[(i + 1) % n]]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    if (!closed) next.push(out[n - 1])
    out = next
  }
  return out
}

/** The line at an even spacing, so the roughening is even too. */
function resample(points: UV[], closed: boolean, step: number): UV[] {
  const line = closed ? [...points, points[0]] : points
  const out: UV[] = [line[0]]
  let carry = 0
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    let at = step - carry
    for (; at <= length; at += step) out.push([a[0] + (b[0] - a[0]) * at / length, a[1] + (b[1] - a[1]) * at / length])
    carry = length - (at - step)
  }
  if (closed) out.pop()
  return out
}

/** Pushes the line in and out along its normal by a sum of waves whose
 *  wavelengths are about 100, 43 and 20 tiles: coves and points, not a
 *  jagged edge. Round a closed line each
 *  wave fits a whole number of times, so the seam does not show. */
function roughen(points: UV[], closed: boolean, seed: number, amount: number): UV[] {
  const line = resample(points, closed, 0.003)
  const along = [0]
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]))
  const last = line[line.length - 1]
  const total = along[along.length - 1] + (closed ? Math.hypot(line[0][0] - last[0], line[0][1] - last[1]) : 0)
  let state = seed * 7919 + 13
  const random = () => { state = (state * 16807) % 2147483647; return state / 2147483647 }
  const waves = [[2.5, 0.5], [6, 0.32], [13, 0.18]].map(([f, weight]) => {
    const cycles = f * (0.85 + random() * 0.3)
    return { f: closed ? Math.max(1, Math.round(cycles * total)) / total : cycles, phase: random() * Math.PI * 2, weight }
  })
  const n = line.length
  return line.map(([u, v], i) => {
    const [prev, next] = closed ? [line[(i + n - 1) % n], line[(i + 1) % n]] : [line[Math.max(0, i - 1)], line[Math.min(n - 1, i + 1)]]
    const [du, dv] = [next[0] - prev[0], next[1] - prev[1]]
    const length = Math.hypot(du, dv) || 1
    const offset = amount * waves.reduce((s, w) => s + w.weight * Math.sin(along[i] * w.f * Math.PI * 2 + w.phase), 0)
    return [u + dv / length * offset, v - du / length * offset]
  })
}

const coast = (points: UV[], closed: boolean, seed: number, amount = 0.016) =>
  roughen(smooth(points, closed), closed, seed, amount)

const toTiles = ([u, v]: UV): [number, number] => [
  CITY_MAP_SIZE * (1 + u + v) / 2,
  CITY_MAP_SIZE * (1 - u + v) / 2,
]

/** An island's outline grown from a seed: points round a centre at radii
 *  that wander, so no two islands share a shape. */
function blob([u, v]: UV, [ru, rv]: [number, number], seed: number, points = 9): UV[] {
  let state = seed * 104729 + 7
  const random = () => { state = (state * 16807) % 2147483647; return state / 2147483647 }
  const start = random() * Math.PI * 2
  return Array.from({ length: points }, (_, i): UV => {
    const angle = start + i / points * Math.PI * 2
    const r = 0.68 + random() * 0.55
    return [u + Math.cos(angle) * ru * r, v + Math.sin(angle) * rv * r]
  })
}
const isle = (center: UV, radii: [number, number], seed: number, amount = 0.008) =>
  coast(blob(center, radii, seed), true, seed, amount)

/** The big central island: ragged, with a bay on its west side and a
 *  tail running south. */
const bigIsland = coast([
  [-0.2, -0.62], [-0.12, -0.6], [-0.08, -0.5], [-0.06, -0.36], [-0.08, -0.22], [-0.05, -0.08],
  [-0.07, 0.06], [-0.06, 0.2], [-0.09, 0.34], [-0.14, 0.46], [-0.2, 0.5], [-0.26, 0.44],
  [-0.24, 0.34], [-0.3, 0.28], [-0.36, 0.16], [-0.33, 0.06], [-0.37, -0.04], [-0.34, -0.16],
  [-0.26, -0.2], [-0.3, -0.3], [-0.34, -0.42], [-0.3, -0.54],
], true, 2, 0.014)

/** The beach island: long and thin, bowed a little, facing the big one. */
const beachIsland = coast([
  [0.12, -0.6], [0.19, -0.56], [0.22, -0.44], [0.23, -0.3], [0.25, -0.16], [0.24, 0.0],
  [0.25, 0.16], [0.23, 0.3], [0.2, 0.44], [0.15, 0.54], [0.11, 0.5], [0.1, 0.38],
  [0.12, 0.24], [0.1, 0.1], [0.08, -0.04], [0.1, -0.2], [0.09, -0.36], [0.1, -0.5],
], true, 6, 0.01)

/** The islet in the strait between the two. */
const strait = isle([0.01, -0.12], [0.035, 0.05], 8, 0.004)

const southCay = isle([0.06, 0.78], [0.08, 0.06], 11)
const southIsles = [isle([-0.4, 0.42], [0.09, 0.07], 12), isle([-0.2, 0.72], [0.05, 0.04], 13), isle([0.28, 0.52], [0.06, 0.05], 14)]
const eastIsles = [isle([0.44, -0.24], [0.08, 0.11], 15, 0.01), isle([0.42, 0.2], [0.08, 0.1], 16, 0.01)]
const northIsles = [isle([-0.1, -0.84], [0.06, 0.04], 17), isle([0.34, -0.56], [0.06, 0.05], 18), isle([-0.48, -0.46], [0.06, 0.05], 19)]
const westIsles = [isle([-0.55, -0.18], [0.09, 0.12], 20, 0.01), isle([-0.6, 0.12], [0.08, 0.1], 21, 0.01), isle([-0.8, -0.06], [0.05, 0.04], 22)]
/** Farthest out, near the edges of the board: sand, not grass. */
const desertIsles = [isle([0.72, -0.06], [0.07, 0.1], 23, 0.01), isle([0.58, 0.34], [0.05, 0.04], 24), isle([-0.6, 0.32], [0.05, 0.04], 25)]
/** Beyond the board, for the view's margins only: nothing is built there. */
const offshore = [isle([1.12, 0.3], [0.16, 0.12], 26, 0.014), isle([-1.15, -0.2], [0.14, 0.18], 27, 0.014),
  isle([0.2, 1.16], [0.12, 0.1], 28, 0.012), isle([-0.35, -1.18], [0.1, 0.12], 29, 0.012)]

const islands = [
  bigIsland, beachIsland, strait, southCay, ...southIsles, ...eastIsles,
  ...northIsles, ...westIsles, ...desertIsles, ...offshore,
]

/** The pieces of the map that open to building one at a time, as the
 *  player climbs the tiers — see `territory.ts`. Each is a set of whole
 *  islands, so they never overlap. */
export type CityRegion =
  | 'south-cay' | 'south-isles' | 'east-isles' | 'big-island' | 'desert-isles'
  | 'beach-island' | 'strait-islet' | 'north-isles' | 'west-isles'

export const CITY_REGIONS: Record<CityRegion, [number, number][][]> = Object.fromEntries(Object.entries({
  'south-cay': [southCay],
  'south-isles': southIsles,
  'east-isles': eastIsles,
  'big-island': [bigIsland],
  'desert-isles': desertIsles,
  'beach-island': [beachIsland],
  'strait-islet': [strait],
  'north-isles': northIsles,
  'west-isles': westIsles,
} satisfies Record<CityRegion, UV[][]>).map(([region, polygons]) => [region, polygons.map(polygon => polygon.map(toTiles))])) as Record<CityRegion, [number, number][][]>

export const CITY_MAP: IsoTerrain = {
  water: '#4d6370',
  land: '#587f4b',
  coast: '#456943',
  sceneryMargin: CITY_MAP_SIZE * 2,
  beach: {
    shores: islands.map(island => [...island, island[0]].map(toTiles)),
    sand: '#e4d7b3',
    wet: '#cdbc97',
  },
  grounds: [{ color: '#d6bf86', polygons: desertIsles.map(island => island.map(toTiles)) }],
  polygons: islands.map(polygon => polygon.map(toTiles)),
}
