import { HALF_H, HALF_W, type Pt } from './engine'

/** Sand along the coasts, and the shallows and surf off them. */
export interface IsoBeach {
  /** The coastlines, in tiles. A line whose ends meet goes round an island. */
  shores: Pt[][]
  sand: string
  /** The strip the waves keep wet, at the water's edge. */
  wet: string
}

export interface IsoTerrain {
  water: string
  land: string
  coast: string
  polygons: Pt[][]
  waterways?: Pt[][]
  beach?: IsoBeach
  /** Non-editable scenery beyond the tile board, in tiles on each side. */
  sceneryMargin?: number
}

export function terrainPath(polygons: Pt[][], closed = true): Path2D {
  const path = new Path2D()
  for (const polygon of polygons) {
    polygon.forEach(([x, y], i) => {
      const sx = (x - y) * HALF_W, sy = (x + y) * HALF_H
      if (i === 0) path.moveTo(sx, sy); else path.lineTo(sx, sy)
    })
    if (closed) path.closePath()
  }
  return path
}

function contains(polygon: Pt[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j]
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
  }
  return inside
}

/** Check only requested tiles and cache them. Scanning the entire board
 * before mounting blocks React, especially with the extended mainland. */
export function terrainAvailability(terrain: IsoTerrain, size: number): (x: number, y: number) => boolean {
  const cells = new Uint8Array(size * size)
  // Reject distant cells before inspecting the detailed curved coastlines.
  const regions = terrain.polygons.map(polygon => ({
    polygon,
    minX: Math.min(...polygon.map(([x]) => x)),
    maxX: Math.max(...polygon.map(([x]) => x)),
    minY: Math.min(...polygon.map(([, y]) => y)),
    maxY: Math.max(...polygon.map(([, y]) => y)),
  }))
  return (x, y) => {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return false
    const index = y * size + x
    // 0 = unknown, 1 = water, 2 = land.
    if (cells[index]) return cells[index] === 2
    const samples = [[0.001, 0.001], [0.999, 0.001], [0.999, 0.999], [0.001, 0.999], [0.5, 0.5]]
    const land = !terrain.waterways?.some(polygon => samples.some(([dx, dy]) => contains(polygon, x + dx, y + dy))) &&
      regions.some(({ polygon, minX, maxX, minY, maxY }) =>
      x + 0.001 >= minX && x + 0.999 <= maxX && y + 0.001 >= minY && y + 0.999 <= maxY &&
      samples.every(([dx, dy]) => contains(polygon, x + dx, y + dy)),
    )
    cells[index] = land ? 2 : 1
    return land
  }
}
