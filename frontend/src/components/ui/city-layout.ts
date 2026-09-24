import type { AppTreemapGroup, AppTreemapLeaf } from './AppTreemap'

/** Blocks around the center, nearest first; ties go around the ring in
 *  angle order, so the city grows as a spiral rather than row by row. */
function spiral(count: number) {
  const reach = Math.ceil(Math.sqrt(count)) + 1
  const cells: { column: number; row: number }[] = []
  for (let column = -reach; column <= reach; column++)
    for (let row = -reach; row <= reach; row++) cells.push({ column, row })
  const angle = ({ column, row }: { column: number; row: number }) => (Math.atan2(row, column) + 2 * Math.PI + Math.PI / 4) % (2 * Math.PI)
  return cells
    .sort((a, b) => Math.hypot(a.column, a.row) - Math.hypot(b.column, b.row) || angle(a) - angle(b))
    .slice(0, count)
}

/** Reais per unit of volume. Fixed, so a holding's building depends on its
 *  own value alone and the city grows with the patrimony. */
const VALUE_PER_VOLUME = 17_500
/** The measure of everything that is not a holding — streets, houses,
 *  trees, cars. Fixed, so the towers grow against a neighborhood that does not. */
const CITY_UNIT = 1.3
/** Inside of a block: fixed, so the street grid never moves. */
const BLOCK = CITY_UNIT * 1.25
/** A building grows up before it grows out: its base follows the fourth
 *  root of its value, slowly, so most of the growth is height... */
const SLENDER = 0.0613
/** ...up to this height; past it, the base widens instead, so the tower
 *  takes more ground. When the base fills a whole block it can only rise. */
const HEIGHT_LIMIT = 3.6
/** Blocks at the center, the 3×3 kept for towers; as long as there are
 *  fewer holdings than these, each holding has a block of its own. */
const DOWNTOWN_BLOCKS = 9

export function cityLayout(groups: AppTreemapGroup[]) {
  const positive = groups.map(group => ({ ...group,
    items: group.items.filter(item => Number.isFinite(item.value) && item.value > 0),
  })).filter(group => group.items.length > 0)
  const total = positive.flatMap(group => group.items).reduce((sum, item) => sum + item.value, 0)
  // Each building from its own value, never from the rest of the portfolio:
  // buying one asset does not reshape the others. Height is volume over
  // the base's area, so volume stays exactly proportional to value.
  const sized = positive.flatMap(group => group.items.map(leaf => {
    const volume = leaf.value / VALUE_PER_VOLUME
    const base = Math.min(BLOCK, Math.max(SLENDER * leaf.value ** 0.25, Math.sqrt(volume / HEIGHT_LIMIT)))
    return { leaf, category: group.label, base, elevation: volume / (base * base) }
  })).sort((a, b) => b.leaf.value - a.leaf.value)

  // Holdings spread over the downtown blocks before any block is shared:
  // the largest each take one, from the center out; the rest go, largest
  // first, to whichever block has the most room left — an outer block with
  // a small tower, not the one under the tallest. A new block opens only
  // when a holding fits in none.
  const size = BLOCK
  const gap = CITY_UNIT * 0.08
  const padding = CITY_UNIT * 0.09
  const street = CITY_UNIT * 0.34
  type Row = { items: typeof sized; width: number; depth: number }
  const lots: Row[][] = []
  const depthOf = (lot: Row[]) => lot.reduce((sum, row) => sum + row.depth, 0) + gap * Math.max(0, lot.length - 1)
  /** Where a building would go in a lot — its last row or a new one — or
   *  null when it does not fit. */
  const placeIn = (lot: Row[], base: number) => {
    const last = lot.at(-1)
    if (last && last.width + gap + base <= size + 1e-9 && depthOf(lot) - last.depth + Math.max(last.depth, base) <= size + 1e-9) return last
    if (depthOf(lot) + (lot.length ? gap : 0) + base <= size + 1e-9) return null
    return undefined
  }
  const add = (lot: Row[], building: (typeof sized)[number]) => {
    const target = placeIn(lot, building.base)
    const row = target ?? { items: [], width: -gap, depth: 0 }
    if (!target) lot.push(row)
    row.items.push(building)
    row.width += gap + building.base
    row.depth = Math.max(row.depth, building.base)
  }
  const room = (lot: Row[]) => size * size - lot.reduce((sum, row) => sum + row.items.reduce((area, item) => area + item.base * item.base, 0), 0)
  sized.forEach((building, index) => {
    if (index < DOWNTOWN_BLOCKS) {
      lots.push([])
      add(lots[index], building)
      return
    }
    const open = lots.filter(lot => placeIn(lot, building.base) !== undefined)
    const lot = open.length ? open.reduce((best, candidate) => room(candidate) > room(best) ? candidate : best) : []
    if (!open.length) lots.push(lot)
    add(lot, building)
  })

  /** Spreads sizes across a span, first at the start and last at the end, so
   *  the outer ones reach the edge of the block instead of bunching in one
   *  corner of it. */
  const spread = (sizes: number[], span: number) => {
    const step = sizes.length > 1 ? (span - sizes.reduce((sum, value) => sum + value, 0)) / (sizes.length - 1) : 0
    let cursor = 0
    return sizes.map(value => { const start = cursor; cursor += value + step; return start })
  }

  // Blocks sit at fixed places around the origin, the spiral taking them
  // from the center out: the grid never shifts, a larger portfolio only
  // takes more of it.
  const lotSize = size + padding * 2
  const pitch = lotSize + street
  const cells = spiral(lots.length)
  const blocks: { x: number; z: number; width: number; depth: number }[] = []
  const buildings: { leaf: AppTreemapLeaf; category: string; x: number; z: number; base: number; elevation: number }[] = []
  lots.forEach((lot, index) => {
    const { column, row: cellRow } = cells[index]
    const left = column * pitch
    const back = cellRow * pitch
    blocks.push({ x: left, z: back, width: lotSize, depth: lotSize })
    const rowStarts = spread(lot.map(row => row.depth), size)
    lot.forEach((row, rowIndex) => {
      const starts = spread(row.items.map(item => item.base), size)
      row.items.forEach((building, itemIndex) => {
        // Outer rows hug their street; a row in the middle sits centered.
        const slack = row.depth - building.base
        const align = lot.length === 1 || rowIndex === 0 ? 0 : rowIndex === lot.length - 1 ? slack : slack / 2
        const x = starts[itemIndex]
        const z = rowStarts[rowIndex] + align
        // Packing starts at a corner with the largest; mirror it so that corner
        // faces the center and the skyline climbs toward the middle.
        const localX = column < 0 ? size - x - building.base : x
        const localZ = cellRow < 0 ? size - z - building.base : z
        buildings.push({
          leaf: building.leaf, category: building.category,
          x: left + padding + localX + building.base / 2,
          z: back + padding + localZ + building.base / 2,
          base: building.base, elevation: building.elevation,
        })
      })
    })
  })
  const bounds = cells.length ? {
    minX: Math.min(...cells.map(cell => cell.column)) * pitch, maxX: Math.max(...cells.map(cell => cell.column)) * pitch + lotSize,
    minZ: Math.min(...cells.map(cell => cell.row)) * pitch, maxZ: Math.max(...cells.map(cell => cell.row)) * pitch + lotSize,
  } : { minX: 0, maxX: lotSize, minZ: 0, maxZ: lotSize }
  return {
    blocks, buildings, total, bounds,
    /** The street grid, for whatever is drawn on it. */
    grid: { pitch, street, lotSize, padding, size, unit: CITY_UNIT },
  }
}
