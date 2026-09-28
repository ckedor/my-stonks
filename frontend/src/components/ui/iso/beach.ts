import { HALF_H, HALF_W, type Pt } from './engine'
import type { IsoBeach } from './terrain'

/* The coast, drawn in bands the way an illustrated aerial map posterizes
 * one: a short strip of sand with wet sand at the water's edge, and off it
 * a strip of shallows with a lighter fringe at the sand, their widths
 * wandering gently along the coast.
 *
 * Each band is an offset of the shore, measured in tiles on the ground,
 * so the bands shrink with the map: far out they are the hairlines they
 * would be. */

type Rgb = [number, number, number]
const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [rgb(a), rgb(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

const toWorld = ([x, y]: Pt): Pt => [(x - y) * HALF_W, (x + y) * HALF_H]

const SHALLOW = '#9fd0c0'
/** Band widths in tiles from the waterline: inland for the sand, out to
 *  sea for the water. */
const SAND = 1.8
const WET = 0.55
const SHALLOWS = 1.3
const FRINGE = 0.4

/** The shore resampled for offsetting: each point with its seaward normal,
 *  and how far the shallows reach there — all the way round an island,
 *  fading out at the ends of an open coast. */
interface Station { x: number; y: number; nx: number; ny: number; taper: number; along: number }

function stations(shore: Pt[], seaward: (x: number, y: number) => boolean): Station[] {
  const [first, last] = [shore[0], shore[shore.length - 1]]
  const closed = first[0] === last[0] && first[1] === last[1]
  // Resample at an even step, so offsets far from the shore stay smooth.
  const step = 0.4
  const even: Pt[] = [first]
  let carry = 0
  for (let i = 1; i < shore.length; i++) {
    const [ax, ay] = shore[i - 1], [bx, by] = shore[i]
    const length = Math.hypot(bx - ax, by - ay)
    let at = step - carry
    for (; at <= length; at += step) even.push([ax + (bx - ax) * at / length, ay + (by - ay) * at / length])
    carry = length - (at - step)
  }
  if (closed) even.push(first)
  const at = (i: number) => closed
    ? even[(i + even.length - 1) % (even.length - 1)]
    : even[Math.max(0, Math.min(even.length - 1, i))]
  let s = 0
  const raw = even.map(([x, y], i) => {
    if (i) s += Math.hypot(x - even[i - 1][0], y - even[i - 1][1])
    const [previous, next] = [at(i - 3), at(i + 3)]
    const dx = next[0] - previous[0], dy = next[1] - previous[1]
    const length = Math.hypot(dx, dy) || 1
    return { x, y, nx: dy / length, ny: -dx / length, s }
  })
  // Which side is sea: ask a few points a tile out on each side.
  const votes = raw.filter((_, i) => i % 7 === 3)
    .reduce((n, p) => n + (seaward(p.x + p.nx, p.y + p.ny) ? 1 : 0) - (seaward(p.x - p.nx, p.y - p.ny) ? 1 : 0), 0)
  const sign = votes >= 0 ? 1 : -1
  const fade = (d: number) => Math.sqrt(Math.min(1, d / 8))
  return raw.map(({ x, y, nx, ny, s: along }) => ({
    x, y, nx: nx * sign, ny: ny * sign, along, taper: closed ? 1 : fade(Math.min(along, s - along)),
  }))
}

/** The strip between the shore and an offset of it, in board pixels.
 *  Negative offsets lie inland. */
function band(line: Station[], offset: (p: Station) => number) {
  const path = new Path2D()
  const points = [...line.map(p => [p, 0] as const), ...[...line].reverse().map(p => [p, offset(p)] as const)]
  points.forEach(([p, d], i) => {
    const [x, y] = toWorld([p.x + p.nx * d, p.y + p.ny * d])
    if (i) path.lineTo(x, y); else path.moveTo(x, y)
  })
  path.closePath()
  return path
}

export interface BeachPainter {
  /** Under the land: the shallows. */
  water(ctx: CanvasRenderingContext2D): void
  /** Over the land, clipped to it: the sand. */
  sand(ctx: CanvasRenderingContext2D): void
}

export function beachPainter(beach: IsoBeach, water: string, land: Path2D, ctx: CanvasRenderingContext2D): BeachPainter {
  const seaward = (x: number, y: number) => {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const inside = ctx.isPointInPath(land, ...toWorld([x, y]))
    ctx.restore()
    return !inside
  }
  const shallowColor = mix(water, SHALLOW, 0.3)
  const fringeColor = mix(water, SHALLOW, 0.55)

  const shores = beach.shores.map(shore => {
    const line = stations(shore, seaward)
    const width = (p: Station) => (0.9 + 0.35 * Math.sin(p.along * 0.12) + 0.18 * Math.sin(p.along * 0.71)) * p.taper
    return {
      shallows: band(line, p => SHALLOWS * width(p)),
      fringe: band(line, p => FRINGE * width(p)),
      sand: band(line, p => -SAND * width(p)),
      wet: band(line, p => -WET * width(p)),
    }
  })

  return {
    water(c) {
      for (const shore of shores) {
        c.fillStyle = shallowColor
        c.fill(shore.shallows)
        c.fillStyle = fringeColor
        c.fill(shore.fringe)
      }
    },

    sand(c) {
      c.save()
      c.clip(land)
      for (const shore of shores) {
        c.fillStyle = beach.sand
        c.fill(shore.sand)
        c.fillStyle = beach.wet
        c.fill(shore.wet)
      }
      c.restore()
    },
  }
}
