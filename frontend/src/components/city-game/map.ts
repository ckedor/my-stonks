import type { IsoTerrain } from '@/components/ui'

export const CITY_MAP_SIZE = 512

/* The map is authored in the board's projected diamond: u runs left to
 * right on screen, v top to bottom, and the board is |u| + |v| ≤ 1. Both
 * are ground distances, so a shape drawn here is the shape on the ground.
 *
 * Each coast is a few hand-placed points — the composition — smoothed into
 * curves and then roughened along its length at two broad scales. Rendering and placement use the
 * same outlines. */

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
 *  wavelengths are about 100 and 43 tiles: coves and points, not a
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
  const waves = [[2.5, 0.62], [6, 0.38]].map(([f, weight]) => {
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

/** The mainland's shore, east to west, land on its upper side. A cape
 *  comes down the east and the coast sweeps round the west, so the islands
 *  sit in a bay. It runs well past the board both ways, so the view never
 *  finds its end. */
const mainland = coast([
  [2.6, 1.0], [1.6, 0.62], [1.14, 0.4], [0.99, 0.2], [0.96, 0.0],
  [0.91, -0.2], [0.84, -0.38], [0.74, -0.52], [0.62, -0.6], [0.52, -0.58], [0.4, -0.55], [0.28, -0.6], [0.16, -0.55],
  [0.05, -0.53], [-0.06, -0.5], [-0.14, -0.45], [-0.25, -0.44],
  [-0.34, -0.38], [-0.44, -0.31], [-0.5, -0.21], [-0.58, -0.13],
  [-0.56, -0.02], [-0.63, 0.07], [-0.67, 0.19], [-0.76, 0.28],
  [-0.9, 0.34], [-1.1, 0.48], [-1.35, 0.78], [-1.65, 1.3], [-2.0, 2.2],
], false, 1)

/** The central island, where the game starts: broad and buildable, with a
 *  headland to the northeast and a bay to the southeast. */
const centralIsland = coast([
  [-0.02, -0.33], [0.12, -0.32], [0.24, -0.27], [0.31, -0.21],
  [0.39, -0.19], [0.43, -0.12], [0.37, -0.06], [0.36, 0.03],
  [0.38, 0.11], [0.33, 0.18], [0.25, 0.2], [0.2, 0.26], [0.21, 0.33],
  [0.12, 0.38], [0.0, 0.37], [-0.1, 0.4], [-0.2, 0.35], [-0.28, 0.27],
  [-0.35, 0.2], [-0.38, 0.1], [-0.36, 0.0], [-0.4, -0.08],
  [-0.36, -0.17], [-0.27, -0.25], [-0.15, -0.3],
], true, 2)

/** Three smaller islands in an arc round the central one: east, south and
 *  southwest, each a channel's width away. */
const smallIslands = [
  coast([[0.6, -0.1], [0.68, -0.08], [0.72, 0.0], [0.76, 0.1], [0.74, 0.2],
    [0.68, 0.24], [0.62, 0.18], [0.6, 0.08], [0.56, 0.0], [0.56, -0.06]], true, 3, 0.01),
  coast([[0.02, 0.56], [0.14, 0.54], [0.24, 0.58], [0.28, 0.66], [0.22, 0.75],
    [0.1, 0.78], [0.0, 0.74], [-0.04, 0.65]], true, 4, 0.01),
  coast([[-0.56, 0.34], [-0.48, 0.3], [-0.39, 0.33], [-0.3, 0.37], [-0.25, 0.44],
    [-0.31, 0.49], [-0.4, 0.49], [-0.49, 0.45], [-0.55, 0.41]], true, 5, 0.01),
]

/** One river from the north, meandering down to a single mouth in the
 *  channel behind the central island; it widens toward the sea. The
 *  channel runs a little past the shore, so no sliver of land closes it. */
function river(): [number, number][] {
  const line = resample(smooth([
    [-0.72, -2.6], [-0.62, -1.7], [-0.5, -1.25], [-0.57, -1.0], [-0.47, -0.87],
    [-0.35, -0.8], [-0.31, -0.69], [-0.4, -0.61], [-0.35, -0.53], [-0.25, -0.5],
    [-0.195, -0.44], [-0.175, -0.405],
  ], false), false, 0.004)
  const n = line.length
  const banks = (side: number) => line.map(([u, v], i): UV => {
    const [prev, next] = [line[Math.max(0, i - 1)], line[Math.min(n - 1, i + 1)]]
    const [du, dv] = [next[0] - prev[0], next[1] - prev[1]]
    const length = Math.hypot(du, dv) || 1
    const t = i / (n - 1)
    const half = 0.016 + 0.01 * t + 0.03 * Math.max(0, (t - 0.9) / 0.1) ** 2
    return [u + side * dv / length * half, v - side * du / length * half]
  })
  return [...banks(1), ...banks(-1).reverse()].map(toTiles)
}

const FAR = 12

export const CITY_MAP: IsoTerrain = {
  water: '#4d6370',
  land: '#587f4b',
  coast: '#456943',
  sceneryMargin: CITY_MAP_SIZE * 2,
  waterways: [river()],
  beach: {
    shores: [mainland, ...[centralIsland, ...smallIslands].map(island => [...island, island[0]])]
      .map(shore => shore.map(toTiles)),
    sand: '#e4d7b3',
    wet: '#cdbc97',
  },
  polygons: [
    // The mainland closes far beyond the scenery the camera can reach.
    [...mainland, [-FAR, FAR], [-FAR, -FAR], [FAR, -FAR], [FAR, mainland[0][1]]] as UV[],
    centralIsland,
    ...smallIslands,
  ].map(polygon => polygon.map(toTiles)),
}
