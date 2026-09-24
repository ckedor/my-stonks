import type { cityLayout } from './city-layout'

type City = ReturnType<typeof cityLayout>

/** The city is drawn once, from this seed, and stays the same: every house,
 *  tree and shop has a fixed place. Only the towers change, and where they
 *  need more room they take blocks that were something else. */
const CITY_SEED = 20260924
/** How far out, in blocks from the center, the land is looked at. The city
 *  itself ends before this, at an edge drawn around the center. */
const SCAN_RINGS = 16
/** Blocks around the center kept for towers; empty ones are plazas. */
const DOWNTOWN = 1
/** Radius, in blocks, the edge of the city wanders around. */
const CITY_RADIUS = 5.7
/** The row of blocks along the shore; past it, the beach and the sea. */
const COAST_ROW = -4

/** A stream of numbers from a seed: the same seed, the same stream. */
/** A seed for one place: the same place always draws the same numbers, no
 *  matter what else the city holds. */
const placeSeed = (...parts: number[]) => parts.reduce((seed, part) => Math.imul(seed ^ (Math.round(part * 64) | 0), 0x9e3779b1) >>> 0, CITY_SEED)

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Footprint { x: number; z: number; width: number; depth: number }
type Kind = 'home' | 'park' | 'shops' | 'farm' | 'field'

/** Where the scenery goes, in the same units as the layout. Sizes are
 *  fractions of the fixed city unit, so houses, trees and cars keep their
 *  size while the towers grow. Nothing here represents a holding: it only
 *  gives the towers a place to stand.
 *
 *  The city does not stop at a square: its edge wanders around the center,
 *  and before it the blocks thin out — sparser houses, then farms and
 *  fields, then patches of woods on open land. A few roads run on past it. */
export function cityDecor(city: City) {
  const { pitch, street, padding, unit, lotSize } = city.grid
  /** `grounded` stands on open land instead of a raised block. */
  const trees: { x: number; z: number; scale: number; stretch: number; kind: 'round' | 'cone'; tone: number; grounded: boolean }[] = []
  /** A car with a route drives along one lane of one road, end to end;
   *  one without is parked. */
  const cars: { x: number; z: number; angle: number; tone: number; route?: { along: 'x' | 'z'; direction: 1 | -1; from: number; to: number } }[] = []
  const shops: (Footprint & { height: number; angle: number; tone: number; restaurant: boolean })[] = []
  const stations: (Footprint & { angle: number; tone: number })[] = []
  const parking: Footprint[] = []
  /** Paved ground in front of shops; the rest of a commercial block is lawn. */
  const forecourts: Footprint[] = []
  const stalls: { x: number; z: number; length: number }[] = []
  const parasols: { x: number; z: number; tone: number }[] = []
  const pools: (Footprint & { angle: number })[] = []
  /** Crop parcels; `angle` turns the rows. */
  const fields: (Footprint & { angle: number; tone: number })[] = []
  const dashes: { x: number; z: number; angle: number }[] = []
  /** `angle` turns a house built facing +z toward its street; `chimney` is
   *  where along the ridge one stands, or null for none. */
  const houses: (Footprint & { height: number; roof: number; angle: number; wall: number; tile: number; chimney: number | null; grounded: boolean })[] = []
  const lamps: { x: number; z: number }[] = []
  const signals: { x: number; z: number; angle: number; state: number }[] = []
  /** Raised, paved blocks of the city; farms, fields and woods are not blocks. */
  const blocks: { x: number; z: number; width: number; depth: number; kind: 'home' | 'park' | 'shops' }[] = []
  /** Asphalt, one strip per street; crossings are where two strips overlap. */
  const roads: { along: 'x' | 'z'; at: number; from: number; to: number }[] = []
  /** The beach: umbrellas with a towel by some, kiosks on the sand and
   *  coconut palms along the promenade. */
  const umbrellas: { x: number; z: number; tone: number; tilt: number; towel: number | null }[] = []
  const kiosks: { x: number; z: number }[] = []
  const palms: { x: number; z: number; scale: number; turn: number }[] = []
  /** Where land gives way to sea, as depths along z: the avenue's seaward
   *  edge, the promenade past it, then the sand down to the shore. */
  let coast: { promenade: [number, number]; sand: [number, number]; shore: number } | null = null
  const empty = {
    trees, cars, dashes, houses, lamps, signals, blocks, shops, stations, parking, forecourts, stalls, parasols, pools, fields, roads,
    umbrellas, kiosks, palms, coast,
    dashLength: 0, carLength: 0, extent: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
  }
  if (!city.blocks.length) return empty
  // Every part of the city draws from a stream seeded by its own place, so
  // what one block holds never shifts what another draws.
  let random = seeded(CITY_SEED)
  const between = (min: number, max: number) => min + random() * (max - min)
  const reseed = (...parts: number[]) => { random = seeded(placeSeed(...parts)) }

  const key = (column: number, row: number) => `${column}:${row}`
  const towers = city.blocks.map(block => [Math.round(block.x / pitch), Math.round(block.z / pitch)] as const)
  const occupied = new Set(towers.map(([column, row]) => key(column, row)))
  const firstColumn = -SCAN_RINGS
  const lastColumn = SCAN_RINGS
  const firstRow = -SCAN_RINGS
  const lastRow = SCAN_RINGS
  const extent = {
    minX: firstColumn * pitch - street, maxX: (lastColumn + 1) * pitch,
    minZ: firstRow * pitch - street, maxZ: (lastRow + 1) * pitch,
  }

  // The edge of the city: a radius around the towers that swells and dips
  // with the angle, in blocks.
  const centerColumn = 0
  const centerRow = 0
  reseed(0)
  const phases = [between(0, 6.3), between(0, 6.3), between(0, 6.3)]
  const edgeAt = (angle: number) => CITY_RADIUS + 1.2 * Math.sin(angle * 3 + phases[0]) + 0.7 * Math.sin(angle * 5 + phases[1]) + 0.4 * Math.sin(angle * 8 + phases[2])

  // The sea lies behind the city, away from the camera, so it fills the
  // horizon: three blocks past the towers the last avenue runs along the
  // shore, and beyond it are the promenade, the sand and the water.
  const coastRow = COAST_ROW
  const seaward = coastRow * pitch - street
  const promenadeWidth = unit * 0.34
  const sandWidth = unit * 1.05
  coast = {
    promenade: [seaward - promenadeWidth, seaward],
    sand: [seaward - promenadeWidth - sandWidth, seaward - promenadeWidth],
    shore: seaward - promenadeWidth - sandWidth,
  }

  // Everything placed goes into a grid of small cells — each footprint in
  // every cell it covers — so a candidate tree is checked only against what
  // is actually near it. Checking whole blocks around it took 200ms.
  const grid = <T extends { x: number; z: number }>(cell: number) => {
    const cells = new Map<number, T[]>()
    const cellKey = (column: number, row: number) => column * 131072 + row
    const span = (from: number, to: number) => [Math.floor(from / cell), Math.floor(to / cell)]
    return {
      add(item: T, halfWidth = 0, halfDepth = 0) {
        const [left, right] = span(item.x - halfWidth, item.x + halfWidth)
        const [back, front] = span(item.z - halfDepth, item.z + halfDepth)
        for (let column = left; column <= right; column++) for (let row = back; row <= front; row++) {
          const found = cells.get(cellKey(column, row))
          if (found) found.push(item)
          else cells.set(cellKey(column, row), [item])
        }
      },
      some(x: number, z: number, reach: number, test: (item: T) => boolean) {
        const [left, right] = span(x - reach, x + reach)
        const [back, front] = span(z - reach, z + reach)
        for (let column = left; column <= right; column++) for (let row = back; row <= front; row++)
          if (cells.get(cellKey(column, row))?.some(test)) return true
        return false
      },
    }
  }
  const obstacles = grid<Footprint>(unit * 0.25)
  const block = (footprint: Footprint) => obstacles.add(footprint, footprint.width / 2, footprint.depth / 2)
  for (const building of city.buildings) block({ x: building.x, z: building.z, width: building.base, depth: building.base })
  const within = (x: number, z: number, reach: number) => obstacles.some(x, z, reach, item => Math.hypot(
    Math.max(0, Math.abs(x - item.x) - item.width / 2),
    Math.max(0, Math.abs(z - item.z) - item.depth / 2),
  ) < reach)
  const overlaps = (rect: Footprint, margin: number) => obstacles.some(rect.x, rect.z, Math.max(rect.width, rect.depth) / 2 + margin, other =>
    Math.abs(other.x - rect.x) < (other.width + rect.width) / 2 + margin
    && Math.abs(other.z - rect.z) < (other.depth + rect.depth) / 2 + margin)

  // What each cell is. Right around the towers, commerce; then full blocks
  // of houses up to the edge; one ring of farms and fields along it; past
  // it, a belt of woods (planted further down) and open land. A gap inside
  // the center becomes a park. Half-empty blocks read as broken, so blocks
  // are either whole or not there.
  const cells: { column: number; row: number; x: number; z: number; kind: Kind; station: boolean }[] = []
  for (let column = firstColumn; column <= lastColumn; column++) {
    for (let row = firstRow; row <= lastRow; row++) {
      if (occupied.has(key(column, row)) || row < coastRow) continue
      reseed(column, row, 1)
      const ring = Math.max(Math.abs(column), Math.abs(row)) - DOWNTOWN
      const inside = ring <= 0
      const reach = Math.hypot(column - centerColumn, row - centerRow) / edgeAt(Math.atan2(row - centerRow, column - centerColumn))
      let kind: Kind | null
      if (inside) kind = 'park'
      else if (ring === 1) kind = 'shops'
      else if (reach <= 0.88) kind = random() < 0.12 ? 'park' : 'home'
      else if (reach <= 1.02) kind = random() < 0.3 ? 'farm' : 'field'
      else kind = null
      if (kind) cells.push({ column, row, x: column * pitch, z: row * pitch, kind, station: false })
    }
  }
  const paved = new Set([...occupied, ...cells.filter(cell => cell.kind === 'home' || cell.kind === 'park' || cell.kind === 'shops').map(cell => key(cell.column, cell.row))])

  // Streets run wherever a paved block borders them, from the first such
  // block to the last; the ones through the middle of the center go on past
  // the edge of the city, into the country.
  const centerX = lotSize / 2
  const centerZ = lotSize / 2
  const far = Math.max(extent.maxX - extent.minX, extent.maxZ - extent.minZ) * 2.5
  const lineAt = (index: number) => index * pitch - street / 2
  const verticalIndices = Array.from({ length: lastColumn - firstColumn + 2 }, (_, index) => firstColumn + index)
  const horizontalIndices = Array.from({ length: lastRow - firstRow + 2 }, (_, index) => firstRow + index)
  const highways = new Set([
    `z:${lineAt(0)}`,
    `z:${lineAt(3)}`,
    `x:${lineAt(1)}`,
    `x:${lineAt(coastRow)}`,
  ])
  for (const [along, indices, across] of [['z', verticalIndices, horizontalIndices], ['x', horizontalIndices, verticalIndices]] as const) {
    for (const index of indices) {
      const at = lineAt(index)
      const touched = across.slice(0, -1).filter(other => along === 'z'
        ? paved.has(key(index - 1, other)) || paved.has(key(index, other))
        : paved.has(key(other, index - 1)) || paved.has(key(other, index)))
      const highway = highways.has(`${along}:${at}`)
      if (!touched.length && !highway) continue
      const from = touched.length ? Math.min(...touched) * pitch - street : 0
      const to = touched.length ? (Math.max(...touched) + 1) * pitch : 0
      // Roads inland run on to the horizon; toward the sea, they end at the
      // avenue along the shore.
      roads.push(highway
        ? { along, at, from: along === 'z' ? seaward : centerX - far, to: (along === 'z' ? centerZ : centerX) + far }
        : { along, at, from: along === 'z' ? Math.max(from, seaward) : from, to })
    }
  }
  const crossingsOf = (road: (typeof roads)[number]) => roads
    .filter(other => other.along !== road.along && other.from <= road.at && road.at <= other.to && road.from <= other.at && other.at <= road.to)
    .map(other => other.at)
  const clear = (value: number, crossings: number[], margin: number) =>
    crossings.every(crossing => Math.abs(value - crossing) > street / 2 + margin)

  const dashLength = street * 0.28
  const crossings = new Map(roads.map(road => [road, crossingsOf(road)]))
  for (const road of roads) {
    // Past the city, only as far as anyone can see through the haze.
    const from = Math.max(road.from, (road.along === 'z' ? extent.minZ : extent.minX) - pitch * 4)
    const to = Math.min(road.to, (road.along === 'z' ? extent.maxZ : extent.maxX) + pitch * 4)
    for (let position = from; position <= to; position += dashLength * 2.2) {
      if (!clear(position, crossings.get(road)!, dashLength / 2)) continue
      dashes.push(road.along === 'z'
        ? { x: road.at, z: position, angle: Math.PI / 2 }
        : { x: position, z: road.at, angle: 0 })
    }
  }

  // Traffic lights on the corners of the financial center's crossings.
  reseed(2)
  for (let column = -DOWNTOWN; column <= DOWNTOWN + 1; column++) {
    for (let row = -DOWNTOWN; row <= DOWNTOWN + 1; row++) {
      const x = column * pitch - street / 2
      const z = row * pitch - street / 2
      const corner = Math.floor(random() * 4)
      const sx = corner % 2 ? 1 : -1
      const sz = corner < 2 ? 1 : -1
      signals.push({
        x: x + sx * (street / 2 + padding * 0.3), z: z + sz * (street / 2 + padding * 0.3),
        angle: Math.atan2(sx, sz) + Math.PI, state: Math.floor(random() * 3),
      })
    }
  }

  const house = (x: number, z: number, width: number, depth: number, angle: number, inner: { left: number; right: number; back: number; front: number }, grounded: boolean, skip: number) => {
    const turned = Math.abs(Math.sin(angle)) > 0.5
    const footprint = turned ? { x, z, width: depth, depth: width } : { x, z, width, depth }
    if (random() < skip || overlaps(footprint, unit * 0.01)) return
    const twoStory = random() < 0.18
    houses.push({
      ...footprint, angle, grounded,
      height: twoStory ? unit * between(0.15, 0.19) : unit * between(0.07, 0.11),
      roof: unit * between(0.05, 0.08), wall: random(), tile: random(),
      chimney: random() < 0.45 ? between(-0.3, 0.3) : null,
    })
    block(footprint)
    // A pool in some backyards, behind the house, away from the street.
    if (grounded || random() >= 0.3) return
    const poolWidth = Math.min(unit * 0.13, width * 0.7)
    const poolDepth = unit * 0.07
    const behind = depth / 2 + unit * 0.035 + poolDepth / 2
    const pool = {
      x: x - Math.sin(angle) * behind, z: z - Math.cos(angle) * behind,
      width: turned ? poolDepth : poolWidth, depth: turned ? poolWidth : poolDepth,
    }
    const inside = pool.x - pool.width / 2 > inner.left && pool.x + pool.width / 2 < inner.right
      && pool.z - pool.depth / 2 > inner.back && pool.z + pool.depth / 2 < inner.front
    if (inside && !overlaps(pool, unit * 0.02)) {
      pools.push({ ...pool, angle })
      block(pool)
    }
  }

  // One gas station, on a commercial block picked at random.
  const commercial = cells.filter(cell => cell.kind === 'shops')
  const station = [...commercial].sort((a, b) => placeSeed(a.column, a.row, 3) - placeSeed(b.column, b.row, 3))[0]
  if (station) station.station = true

  // Commercial blocks. With a parking lot: shops and restaurants along two
  // sides, facing their streets, and the lot between them. Without: all
  // four sides built, some with shops and some with houses — a mixed street,
  // never shops on two sides around an empty lawn.
  const carLength = unit * 0.14
  type Side = 'back' | 'front' | 'left' | 'right'
  const sides: Side[] = ['back', 'front', 'left', 'right']
  for (const cell of commercial) {
    reseed(cell.column, cell.row, 4)
    const inner = { left: cell.x + padding, right: cell.x + lotSize - padding, back: cell.z + padding, front: cell.z + lotSize - padding }
    const parked = !cell.station && random() < 0.3
    const uses = new Map<Side, 'shops' | 'houses' | null>(parked
      ? [['back', 'shops'], ['front', 'shops'], ['left', null], ['right', null]]
      : sides.map(side => [side, random() < 0.5 ? 'shops' : 'houses']))
    if (cell.station) uses.set('back', 'shops')
    if (!parked && ![...uses.values()].includes('houses')) uses.set(sides[1 + Math.floor(random() * 3)], 'houses')
    if (![...uses.values()].includes('shops')) uses.set('back', 'shops')
    const deep = unit * 0.26
    const reach: Record<Side, number> = { back: 0, front: 0, left: 0, right: 0 }
    for (const side of sides) {
      const use = uses.get(side)
      if (!use) continue
      const across = side === 'left' || side === 'right'
      const angle = { back: Math.PI, front: 0, left: -Math.PI / 2, right: Math.PI / 2 }[side]
      // Along the side, and inward from its street to the depth given.
      const place = (along: number, depth: number) => {
        const inward = { back: inner.back + depth / 2, front: inner.front - depth / 2, left: inner.left + depth / 2, right: inner.right - depth / 2 }[side]
        return across ? { x: inward, z: along } : { x: along, z: inward }
      }
      const start = across ? inner.back + deep + unit * 0.04 : inner.left
      const end = across ? inner.front - deep - unit * 0.04 : inner.right
      let cursor = start
      if (cell.station && side === 'back') {
        const station = { ...place(cursor + unit * 0.25, unit * 0.36), width: unit * 0.5, depth: unit * 0.36 }
        stations.push({ ...station, angle, tone: random() })
        block(station)
        reach.back = unit * 0.36
        cursor += unit * 0.5 + unit * 0.04
      }
      if (use === 'houses') {
        for (;;) {
          const width = unit * between(0.15, 0.25)
          const depth = unit * between(0.13, 0.22)
          if (cursor + width > end) break
          const at = place(cursor + width / 2, depth)
          house(at.x, at.z, width, depth, angle, inner, false, 0.1)
          cursor += width + unit * between(0.03, 0.07)
        }
        continue
      }
      for (;;) {
        const width = unit * between(0.2, 0.34)
        const depth = unit * between(0.17, 0.25)
        if (cursor + width > end) break
        const at = place(cursor + width / 2, depth)
        const shop = across ? { ...at, width: depth, depth: width } : { ...at, width, depth }
        // At a corner the neighbor side may reach this far: the station is
        // deeper than a row of shops, and a backyard pool can be too.
        if (overlaps(shop, unit * 0.01)) { cursor += width + unit * 0.03; continue }
        const restaurant = random() < 0.35
        shops.push({ ...shop, angle, height: unit * between(0.08, 0.13), tone: random(), restaurant })
        block(shop)
        reach[side] = Math.max(reach[side], depth)
        // Restaurant tables go out on the sidewalk, under parasols.
        const sidewalk = { back: cell.z + padding * 0.55, front: cell.z + lotSize - padding * 0.55, left: cell.x + padding * 0.55, right: cell.x + lotSize - padding * 0.55 }[side]
        if (restaurant) for (const share of [0.28, 0.72]) {
          const along = cursor + width * share
          parasols.push({ ...(across ? { x: sidewalk, z: along } : { x: along, z: sidewalk }), tone: random() })
        }
        cursor += width + unit * between(0.02, 0.05)
      }
    }
    // Paved forecourts in front of the shops; houses keep their lawn.
    for (const side of sides) {
      if (!reach[side] || uses.get(side) !== 'shops') continue
      const depth = padding + reach[side] + unit * 0.03
      forecourts.push({
        back: { x: cell.x + lotSize / 2, z: cell.z + depth / 2, width: lotSize, depth },
        front: { x: cell.x + lotSize / 2, z: cell.z + lotSize - depth / 2, width: lotSize, depth },
        left: { x: cell.x + depth / 2, z: cell.z + lotSize / 2, width: depth, depth: lotSize },
        right: { x: cell.x + lotSize - depth / 2, z: cell.z + lotSize / 2, width: depth, depth: lotSize },
      }[side])
    }
    if (!parked) continue
    const lot = { left: inner.left + unit * 0.04, right: inner.right - unit * 0.04, back: inner.back + reach.back + unit * 0.05, front: inner.front - reach.front - unit * 0.05 }
    if (lot.front - lot.back < carLength * 2.2) continue
    const area = { x: (lot.left + lot.right) / 2, z: (lot.back + lot.front) / 2, width: lot.right - lot.left, depth: lot.front - lot.back }
    parking.push(area)
    block(area)
    // Two rows of stalls facing an aisle down the middle, most of them taken.
    const stall = carLength * 1.15
    const bay = unit * 0.1
    const count = Math.floor((lot.right - lot.left) / bay)
    for (const [edge, facing] of [[lot.back, 1], [lot.front, -1]] as const) {
      const z = edge + facing * stall / 2
      for (let index = 0; index <= count; index++) stalls.push({ x: lot.left + index * bay, z, length: stall })
      for (let index = 0; index < count; index++) if (random() < 0.6)
        cars.push({ x: lot.left + (index + 0.5) * bay, z, angle: facing > 0 ? Math.PI / 2 : -Math.PI / 2, tone: random() })
    }
  }

  for (const cell of cells) {
    reseed(cell.column, cell.row, 5)
    if (cell.kind === 'home' || cell.kind === 'park' || cell.kind === 'shops')
      blocks.push({ x: cell.x, z: cell.z, width: lotSize, depth: lotSize, kind: cell.kind })

    // Houses line the four sides of a suburban block, each facing its street.
    if (cell.kind === 'home') {
      const inner = { left: cell.x + padding, right: cell.x + lotSize - padding, back: cell.z + padding, front: cell.z + lotSize - padding }
      const deepest = unit * 0.22
      const skip = 0.1
      for (const side of ['back', 'front'] as const) {
        for (let cursor = inner.left; ;) {
          const width = unit * between(0.15, 0.25)
          const depth = unit * between(0.13, deepest / unit)
          if (cursor + width > inner.right) break
          house(cursor + width / 2, side === 'back' ? inner.back + depth / 2 : inner.front - depth / 2, width, depth, side === 'back' ? Math.PI : 0, inner, false, skip)
          cursor += width + unit * between(0.03, 0.07)
        }
      }
      for (const side of ['left', 'right'] as const) {
        for (let cursor = inner.back + deepest + unit * 0.05; ;) {
          const width = unit * between(0.15, 0.25)
          const depth = unit * between(0.13, deepest / unit)
          if (cursor + width > inner.front - deepest - unit * 0.05) break
          house(side === 'left' ? inner.left + depth / 2 : inner.right - depth / 2, cursor + width / 2, width, depth, side === 'left' ? -Math.PI / 2 : Math.PI / 2, inner, false, skip)
          cursor += width + unit * between(0.03, 0.07)
        }
      }
    }

    // Fields: the land split in two parcels, rows running either way. A
    // farm keeps one corner for the farmhouse and its trees.
    if (cell.kind === 'field' || cell.kind === 'farm') {
      const gap = unit * 0.06
      const half = (lotSize - gap) / 2
      const acrossX = random() < 0.5
      const parcels = acrossX
        ? [{ x: cell.x + half / 2, z: cell.z + lotSize / 2, width: half, depth: lotSize }, { x: cell.x + lotSize - half / 2, z: cell.z + lotSize / 2, width: half, depth: lotSize }]
        : [{ x: cell.x + lotSize / 2, z: cell.z + half / 2, width: lotSize, depth: half }, { x: cell.x + lotSize / 2, z: cell.z + lotSize - half / 2, width: lotSize, depth: half }]
      if (cell.kind === 'farm') {
        const home = parcels.splice(Math.floor(random() * 2), 1)[0]
        const angle = acrossX ? (home.x < cell.x + lotSize / 2 ? -Math.PI / 2 : Math.PI / 2) : (home.z < cell.z + lotSize / 2 ? Math.PI : 0)
        const inner = { left: home.x - home.width / 2, right: home.x + home.width / 2, back: home.z - home.depth / 2, front: home.z + home.depth / 2 }
        house(home.x, home.z, unit * between(0.22, 0.3), unit * between(0.18, 0.22), angle, inner, true, 0)
      }
      for (const parcel of parcels) {
        fields.push({ ...parcel, angle: random() < 0.5 ? 0 : Math.PI / 2, tone: random() })
        block(parcel)
      }
    }
  }

  // Street lamps along every sidewalk, spaced evenly from corner to corner.
  for (const lot of [...city.blocks, ...blocks]) {
    const inset = padding * 0.3
    const count = Math.max(2, Math.round(lot.width / (unit * 0.42)))
    for (let index = 0; index <= count; index++) {
      const offset = inset + (lot.width - inset * 2) * index / count
      lamps.push(
        { x: lot.x + offset, z: lot.z + inset },
        { x: lot.x + offset, z: lot.z + lot.depth - inset },
      )
      if (index > 0 && index < count) lamps.push(
        { x: lot.x + inset, z: lot.z + offset },
        { x: lot.x + lot.width - inset, z: lot.z + offset },
      )
    }
  }

  // Moving traffic, spread over the roads by their length within sight.
  const visible = roads.map(road => {
    const from = Math.max(road.from, (road.along === 'z' ? extent.minZ : extent.minX))
    const to = Math.min(road.to, (road.along === 'z' ? extent.maxZ : extent.maxX))
    return { road, from, to }
  }).filter(item => item.to > item.from)
  const total = visible.reduce((sum, item) => sum + item.to - item.from, 0)
  reseed(6)
  const carCount = Math.round((city.blocks.length + blocks.length) * 0.7) + 2
  const parked = cars.length
  for (let attempt = 0; cars.length - parked < carCount && attempt < carCount * 20 && total > 0; attempt++) {
    let pick = random() * total
    const { road, from, to } = visible.find(item => (pick -= item.to - item.from) <= 0) ?? visible[0]
    const position = from + random() * (to - from)
    if (!clear(position, crossings.get(road)!, carLength)) continue
    // Right-hand traffic: the lane decides which way the car faces.
    const lane = random() < 0.5 ? -1 : 1
    const car = road.along === 'z'
      ? { x: road.at + lane * street / 4, z: position, angle: lane > 0 ? Math.PI / 2 : -Math.PI / 2, direction: lane > 0 ? -1 as const : 1 as const }
      : { x: position, z: road.at + lane * street / 4, angle: lane > 0 ? 0 : Math.PI, direction: lane > 0 ? 1 as const : -1 as const }
    if (cars.some(other => other.route && Math.hypot(other.x - car.x, other.z - car.z) < carLength * 1.6)) continue
    // A highway car loops over the stretch in sight, not its whole length.
    cars.push({ x: car.x, z: car.z, angle: car.angle, tone: random(), route: { along: road.along, direction: car.direction, from, to } })
  }

  // Trees fill what is left: the sidewalk between buildings, gardens between
  // houses, whole parks and, out in the country, patches of woods. Never
  // right against a facade, where a tree would hide the label, nor on top of
  // a lamp.
  const spacing = unit * 0.13
  const nearbyLamps = grid<{ x: number; z: number }>(spacing)
  for (const lamp of lamps) nearbyLamps.add(lamp)
  const planted = grid<{ x: number; z: number }>(spacing)
  const plant = (x: number, z: number, grounded = false) => {
    if (within(x, z, grounded ? unit * 0.03 : padding * 0.9)) return
    if (nearbyLamps.some(x, z, spacing * 0.4, lamp => Math.hypot(lamp.x - x, lamp.z - z) < spacing * 0.4)) return
    if (planted.some(x, z, spacing * 0.85, tree => Math.hypot(tree.x - x, tree.z - z) < spacing * 0.85)) return
    planted.add({ x, z })
    trees.push({
      x, z, scale: between(0.6, 1.5), stretch: between(0.85, 1.5),
      kind: random() < (grounded ? 0.4 : 0.22) ? 'cone' : 'round', tone: random(), grounded,
    })
  }
  const kinds = new Map(blocks.map(lot => [`${lot.x}:${lot.z}`, lot.kind]))
  for (const lot of [...city.blocks, ...blocks]) {
    reseed(lot.x, lot.z, 7)
    const inset = padding / 2
    const left = lot.x + inset
    const right = lot.x + lot.width - inset
    const back = lot.z + inset
    const front = lot.z + lot.depth - inset
    for (let offset = 0; offset <= right - left + 1e-9; offset += spacing) {
      plant(left + offset, back)
      plant(left + offset, front)
    }
    for (let offset = spacing; offset < front - back - 1e-9; offset += spacing) {
      plant(left, back + offset)
      plant(right, back + offset)
    }
    const kind = kinds.get(`${lot.x}:${lot.z}`)
    const step = spacing * (kind === 'park' ? 1 : 1.4)
    const density = kind === 'park' ? 0.85 : kind === 'shops' ? 0.45 : 0.55
    for (let x = left + spacing * 1.5; x < right - spacing; x += step)
      for (let z = back + spacing * 1.5; z < front - spacing; z += step)
        if (random() < density) plant(x + (random() - 0.5) * spacing * 0.6, z + (random() - 0.5) * spacing * 0.6)
  }
  // Out in the country the roads are obstacles too; in the city, sidewalk
  // trees stand next to the street on purpose.
  for (const road of roads) {
    const from = Math.max(road.from, road.along === 'z' ? extent.minZ : extent.minX)
    const to = Math.min(road.to, road.along === 'z' ? extent.maxZ : extent.maxX)
    if (to <= from) continue
    block(road.along === 'z'
      ? { x: road.at, z: (from + to) / 2, width: street, depth: to - from }
      : { x: (from + to) / 2, z: road.at, width: to - from, depth: street })
  }
  // Past the edge, trees scatter over the open land all the way to the
  // horizon: sparse, thinning slowly outward, and gathered into loose groves
  // by a gentle wave — a countryside, not a wall of forest around the city.
  const belt = spacing * 1.4
  for (let x = extent.minX; x < extent.maxX; x += belt) {
    for (let z = extent.minZ; z < extent.maxZ; z += belt) {
      const column = (x + street / 2) / pitch - 0.5
      const row = (z + street / 2) / pitch - 0.5
      const reach = Math.hypot(column - centerColumn, row - centerRow) / edgeAt(Math.atan2(row - centerRow, column - centerColumn))
      if (z < coastRow * pitch) continue
      reseed(x, z, 8)
      const groves = 0.35 + 0.65 * Math.max(0, Math.sin(x * 0.55 + phases[0]) * Math.sin(z * 0.47 + phases[1]))
      const density = reach < 1.06 ? 0 : 0.42 * groves * (1 - Math.min(1, (reach - 1.06) / 2.6)) ** 1.2
      if (random() < density) plant(x + (random() - 0.5) * belt * 0.8, z + (random() - 0.5) * belt * 0.8, true)
    }
  }
  for (const cell of cells) {
    // A few trees around the farmhouse.
    reseed(cell.column, cell.row, 9)
    if (cell.kind === 'farm') for (let index = 0; index < 10; index++)
      plant(cell.x + random() * lotSize, cell.z + random() * lotSize, true)
  }
  // The beach, along the whole shore in sight: umbrellas in loose rows,
  // thicker in front of the city; a kiosk every so often by the promenade;
  // palms along the promenade's seaward edge.
  const [sandFrom, sandTo] = coast.sand
  reseed(10)
  for (let x = extent.minX; x < extent.maxX; x += unit * 2.3) kiosks.push({ x: x + between(-0.2, 0.2) * unit, z: sandTo - unit * 0.12 })
  for (let x = extent.minX; x < extent.maxX; x += unit * 0.42) {
    if (kiosks.some(kiosk => Math.abs(kiosk.x - x) < unit * 0.2)) continue
    palms.push({ x: x + between(-0.06, 0.06) * unit, z: sandTo - unit * 0.03, scale: between(0.85, 1.2), turn: random() * Math.PI })
  }
  const busy = (x: number) => Math.max(0.15, 1 - Math.abs(x - centerX) / (pitch * 9))
  for (let x = extent.minX; x < extent.maxX; x += unit * 0.2) {
    for (let z = sandFrom + unit * 0.25; z < sandTo - unit * 0.3; z += unit * 0.2) {
      if (random() > 0.55 * busy(x)) continue
      const spot = { x: x + between(-0.05, 0.05) * unit, z: z + between(-0.05, 0.05) * unit }
      if (kiosks.some(kiosk => Math.hypot(kiosk.x - spot.x, kiosk.z - spot.z) < unit * 0.16)) continue
      umbrellas.push({ ...spot, tone: random(), tilt: between(-0.12, 0.12), towel: random() < 0.6 ? random() : null })
    }
  }
  return {
    trees, cars, dashes, houses, lamps, signals, blocks, shops, stations, parking, forecourts, stalls, parasols, pools, fields, roads,
    umbrellas, kiosks, palms, coast,
    dashLength, carLength, extent,
  }
}
