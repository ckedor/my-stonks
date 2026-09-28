import {
  gable, groundLine, groundQuad, iso, line, mansard, meters, mix, mulberry, ngon, poly, prism, rect, shade, tree,
  type Face, type Facade, type Pt, type Recipe, type Skin,
} from './engine'

// All homes use 3 m storeys and 5.5–8 m frontages on the existing 12 m grid.
// Muted plaster, brick, slate and terracotta echo the supplied neighbourhoods.
const PAVING = '#c7c4b3', PATH = '#d6d0b9', GRASS = '#698354'
const INK = '#55574e'
type Rng = () => number
type HouseStyle = 'suburb' | 'cottage' | 'terracotta' | 'bungalow' | 'townhouse' | 'villa' | 'mixed'
const PALETTES: Record<HouseStyle, { walls: string[]; roofs: string[] }> = {
  suburb: { walls: ['#c5bcaa', '#a39b8e', '#d7d2c4', '#9caaa5'], roofs: ['#666d71', '#7b7972', '#766157'] },
  cottage: { walls: ['#d3cbbb', '#b9ad96', '#a79c88', '#cbc7b9'], roofs: ['#6b7070', '#7b6d62', '#666772'] },
  terracotta: { walls: ['#cbbb9d', '#d8cfb8', '#bdaa8e', '#cab8a0'], roofs: ['#995e4e', '#ad7057', '#8b594d'] },
  bungalow: { walls: ['#d0cab9', '#b6b49f', '#a3b1a8', '#c1b195'], roofs: ['#6e7774', '#85847a', '#756356'] },
  townhouse: { walls: ['#986b58', '#a57b64', '#866553', '#b59376'], roofs: ['#606568', '#6e706d', '#73746e'] },
  villa: { walls: ['#d7c9b0', '#c9bba0', '#b8a68f', '#ded2bc'], roofs: ['#975f50', '#79675d', '#696e70'] },
  mixed: { walls: ['#bfbaa9', '#a47c66', '#d2c8b4', '#a9b0a5'], roofs: ['#6c7378', '#916450', '#7d8077'] },
}
const pick = <T,>(random: Rng, values: T[]) => values[Math.floor(random() * values.length)]
const point = (f: Face, u: number, z: number): Pt => iso(f.p0[0] + (f.p1[0] - f.p0[0]) * u, f.p0[1] + (f.p1[1] - f.p0[1]) * u, z)
const panel = (f: Face, a: number, b: number, low: number, high: number, fill: string, stroke: string | null = null) =>
  poly([point(f, a, low), point(f, b, low), point(f, b, high), point(f, a, high)], fill, stroke, 0.35)

function windows(storeys: number, brick = false): Facade {
  return f => {
    const cols = Math.max(1, Math.round(f.len * 12 / (brick ? 2.8 : 2.7)))
    const floor = (f.z1 - f.z0) / storeys
    for (let row = 0; row < storeys; row++) {
      for (let col = 0; col < cols; col++) {
        const a = (col + 0.28) / cols, b = (col + 0.72) / cols
        const low = f.z0 + row * floor + meters(0.85), high = f.z0 + row * floor + meters(2.15)
        panel(f, a, b, low, high, shade(brick ? '#55594f' : '#536268', f.k), brick ? null : shade('#e0d8c5', f.k))
        line([point(f, a, low - meters(0.08)), point(f, b, low - meters(0.08))], shade(brick ? '#b5a48d' : '#d0c5ad', f.k), brick ? 0.35 : 0.6)
        if (!brick) line([point(f, (a + b) / 2, low), point(f, (a + b) / 2, high)], shade('#d2cbb8', f.k), 0.35)
      }
    }
    // Quiet horizontal masonry courses instead of exaggerated floor bands.
    if (brick) for (let row = 1; row < storeys; row++) {
      const z = f.z0 + row * floor
      line([point(f, 0, z), point(f, 1, z)], shade('#ad967f', f.k * 0.82), 0.35)
    }
  }
}
const roofSkin = (color: string): Skin => f => {
  for (let t = 0.2; t < 0.95; t += 0.2) {
    const a: Pt = [f.a0[0] + (f.b0[0] - f.a0[0]) * t, f.a0[1] + (f.b0[1] - f.a0[1]) * t]
    const b: Pt = [f.a1[0] + (f.b1[0] - f.a1[0]) * t, f.a1[1] + (f.b1[1] - f.a1[1]) * t]
    const z = f.z0 + (f.z1 - f.z0) * t
    line([iso(...a, z), iso(...b, z)], shade(color, f.k * 0.87), 0.4)
  }
}

function car(x: number, y: number, color: string) {
  prism(rect(x, y, 0.155, 0.35), meters(0.18), meters(0.68), { color, roof: color, outline: '#545953' })
  prism(rect(x + 0.018, y + 0.10, 0.12, 0.16), meters(0.86), meters(0.52), { color: '#6c7c80', roof: color, outline: '#586160' })
}

function house(random: Rng, x: number, y: number, w: number, d: number, front: number, style: HouseStyle) {
  const palette = PALETTES[style], wall = pick(random, palette.walls), roof = pick(random, palette.roofs)
  const count = style === 'bungalow' ? 1 : style === 'townhouse' ? 2 + Number(random() > 0.6) : style === 'villa' ? 2 : random() < 0.24 ? 1 : 2
  const h = meters(count * 3), roofH = meters(style === 'cottage' ? 2.25 : style === 'bungalow' ? 1.55 : 1.9)
  prism(rect(x, y, w, d), 0, meters(0.28), { color: '#aaa28f', roof: '#c4bbaa', outline: INK })
  prism(rect(x, y, w, d), meters(0.28), h, { color: wall, roof, outline: INK, facade: windows(count, style === 'townhouse') })
  const top = h + meters(0.28), e = 0.025
  prism(rect(x - e, y - e, w + e * 2, d + e * 2), top, meters(0.12), { color: '#b7b1a0', roof, outline: INK })
  const roofStyle = { color: wall, roof, outline: INK, skin: roofSkin(roof) }
  if (style === 'townhouse') {
    prism(rect(x, y, w, d), top, meters(0.28), { color: wall, roof, outline: INK, parapet: 0.023 })
  } else if (style === 'villa' || style === 'terracotta') {
    mansard(rect(x - e, y - e, w + e * 2, d + e * 2), top, roofH, Math.min(w, d) * 0.44, roofStyle)
  } else {
    gable(x - e, y - e, w + e * 2, d + e * 2, top, roofH, random() < 0.4, roofStyle)
  }
  // Open porch with two posts, a real door and shallow steps, not a solid box.
  const porchY = front < 0 ? y - 0.14 : y + d, doorY = front < 0 ? y - 0.006 : y + d
  const px = x + w * 0.25, pw = w * 0.50
  prism(rect(px, porchY, pw, 0.14), 0, meters(0.30), { color: '#bfb7a5', roof: '#d2cbb7', outline: INK })
  prism(rect(x + w * 0.40, doorY, w * 0.18, 0.012), meters(0.3), meters(2.1), { color: '#5f655b', roof: '#a9aa9a', outline: '#c8c0aa' })
  for (const dx of [0.02, pw - 0.04]) prism(rect(px + dx, porchY + (front < 0 ? 0.015 : 0.1), 0.025, 0.025), meters(0.3), meters(2.25), { color: '#d9d1bc', roof: '#d9d1bc', outline: null })
  prism(rect(px - 0.015, porchY - 0.015, pw + 0.03, 0.17), meters(2.55), meters(0.16), { color: roof, roof, outline: INK })
  if (style === 'villa' || (count === 2 && random() < 0.35)) {
    const bay = rect(x + w * 0.03, front < 0 ? y - 0.065 : y + d - 0.015, w * 0.28, 0.08)
    prism(bay, meters(0.45), meters(2.2), { color: wall, roof, outline: INK, facade: windows(1) })
  }
  if (style !== 'townhouse' && random() < 0.7) {
    prism(rect(x + w * 0.72, y + d * 0.58, 0.065, 0.08), top + roofH * 0.30, meters(1.65), { color: '#987965', roof: '#b7a58f', outline: INK })
  }
  if (style === 'cottage' && count === 2) {
    const dy = front < 0 ? y + 0.06 : y + d - 0.18
    prism(rect(x + w * 0.34, dy, w * 0.30, 0.15), top + meters(0.35), meters(0.8), { color: wall, roof, outline: INK, facade: windows(1) })
    gable(x + w * 0.32, dy - 0.01, w * 0.34, 0.17, top + meters(1.15), meters(0.45), false, roofStyle)
  }
}

function grounds(w: number, d: number) {
  groundQuad(rect(0, 0, w, d), PAVING)
  groundQuad(rect(0.16, 0.16, w - 0.32, d - 0.32), GRASS)
  // Fine sidewalk joints, scaled in metres and kept clear of front paths.
  for (let x = 0.4; x < w; x += 0.4) {
    groundLine([x, 0], [x, 0.15], '#b3b09f', 0.4)
    groundLine([x, d - 0.15], [x, d], '#b3b09f', 0.4)
  }
}

function neighbourhood(seed: number, style: HouseStyle, w = 8, d = 4): Recipe {
  return { size: [w, d], draw() {
    const random = mulberry(seed)
    grounds(w, d)
    const columns = style === 'villa' ? 4 : style === 'townhouse' ? 10 : style === 'bungalow' ? 7 : 8
    const lot = (w - 0.44) / columns
    for (let row = 0; row < 2; row++) for (let i = 0; i < columns; i++) {
      const front = row === 0 ? -1 : 1, lx = 0.22 + i * lot
      const variant = style === 'mixed' ? (i % 3 === 0 ? 'townhouse' : 'suburb') : style
      const hw = variant === 'villa' ? 0.88 + random() * 0.14 : variant === 'townhouse' ? lot - 0.035 : 0.44 + random() * 0.12
      const hd = variant === 'villa' ? 1.02 : variant === 'townhouse' ? 0.78 : 0.65 + random() * 0.13
      const hx = lx + (lot - hw) * 0.35, hy = row === 0 ? 0.48 + random() * 0.08 : d - 0.48 - hd - random() * 0.08
      const yardColor = mix(GRASS, i % 3 === 0 ? '#9ba47a' : '#496e45', 0.08 + random() * 0.14)
      const y0 = row === 0 ? 0.17 : d / 2
      groundQuad(rect(lx, y0, lot - 0.025, d / 2 - 0.17), yardColor)
      const walkwayY = row === 0 ? 0.12 : hy + hd
      const walkwayD = row === 0 ? hy - 0.12 : d - 0.12 - hy - hd
      groundQuad(rect(hx + hw * 0.42, walkwayY, 0.09, walkwayD), PATH)
      if (variant !== 'townhouse') {
        const driveX = lx + lot - 0.21
        groundQuad(rect(driveX, row === 0 ? 0.14 : hy + hd * 0.35, 0.18, row === 0 ? hy + hd * 0.65 - 0.14 : d - 0.14 - hy - hd * 0.35), '#b4b3a8')
        if (random() < 0.45) car(driveX + 0.01, row === 0 ? hy + 0.04 : hy + hd * 0.4, pick(random, ['#a7aba5', '#737e84', '#815d55', '#c3bba9']))
      }
      house(random, hx, hy, hw, hd, front, variant)
      const by = row === 0 ? hy + hd + 0.34 : hy - 0.34
      if (random() < 0.86) tree(lx + lot * (0.38 + random() * 0.24), by, 0.74 + random() * 0.42, 0, i % 5 === 0 ? 'copper' : i % 3 === 0 ? 'lime' : 'canopy')
      if (variant === 'villa') {
        tree(lx + lot * 0.80, row === 0 ? d / 2 - 0.30 : d / 2 + 0.30, 1.02 + random() * 0.28, 0, 'lime')
        groundQuad(rect(lx + lot * 0.52, row === 0 ? by + 0.10 : by - 0.40, lot * 0.26, 0.22), '#829168')
      }
      if (i % 2 === 0 && variant !== 'townhouse') tree(lx + 0.10, row === 0 ? 0.30 : d - 0.30, 0.36 + random() * 0.16)
      groundLine([lx, row === 0 ? hy + hd + 0.07 : d / 2 + 0.04], [lx, row === 0 ? d / 2 - 0.04 : hy - 0.07], '#455f40', 0.85)
      // Low garden hedge: it stays below window height.
      if (i % 3 === 1) for (let k = 0; k < 3; k++) tree(lx + 0.12 + k * 0.12, row === 0 ? 0.22 : d - 0.22, 0.13)
    }
  } }
}

function apartments(seed: number, storeys: number, layout: 'slabs' | 'court' | 'garden', w: number, d: number): Recipe {
  return { size: [w, d], draw() {
    const random = mulberry(seed)
    grounds(w, d)
    const bricks = ['#9e7963', '#aa8269', '#96725f', '#ae8c71']
    const block = (plan: Pt[], count: number, wall: string) => {
      const h = meters(count * 3)
      prism(plan, 0, h, { color: wall, roof: '#85877e', outline: INK, facade: windows(count, true), parapet: 0.025 })
      const cx = plan.reduce((sum, p) => sum + p[0], 0) / plan.length, cy = plan.reduce((sum, p) => sum + p[1], 0) / plan.length
      prism(rect(cx - 0.14, cy - 0.12, 0.28, 0.24), h, meters(1.6), { color: '#969586', roof: '#b3b2a3', outline: INK })
      prism(rect(plan[0][0] + 0.16, plan[0][1] + 0.16, 0.12, 0.18), h, meters(0.5), { color: '#a8a79a', roof: '#c7c6b9', outline: INK })
    }
    const hPlan = (x: number, y: number, width: number, depth: number): Pt[] => {
      const a = 0.58, b = depth * 0.36, c = depth * 0.64
      return [[x,y],[x+a,y],[x+a,y+b],[x+width-a,y+b],[x+width-a,y],[x+width,y],
        [x+width,y+depth],[x+width-a,y+depth],[x+width-a,y+c],[x+a,y+c],[x+a,y+depth],[x,y+depth]]
    }
    if (layout === 'garden') {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        const x = 0.65 + col * (w / 2), y = 0.65 + row * (d / 2)
        const bw = w / 2 - 1.55, bd = d / 2 - 1.55
        block(hPlan(x, y, bw, bd), storeys, pick(random, bricks))
        groundQuad(rect(x + bw / 2 - 0.045, y + bd * 0.65, 0.09, d / 2 - bd * 0.65), PATH)
      }
      groundQuad(rect(0.18, d / 2 - 0.12, w - 0.36, 0.20), PATH)
      groundQuad(rect(w / 2 - 0.12, 0.18, 0.20, d - 0.36), PATH)
      for (let x = 1.0; x < w - 0.4; x += 1.20) tree(x, d / 2 + 0.34, 1.0 + random() * 0.20, 0, 'lime')
      for (let y = 1.2; y < d - 0.4; y += 1.28) tree(w / 2 + 0.34, y, 1.02, 0, 'canopy')
    } else if (layout === 'court') {
      const x = 0.48, y = 0.50, bw = w - 0.96, bd = d - 1.0, wing = 0.78
      const plan: Pt[] = [[x,y],[x+bw,y],[x+bw,y+bd],[x+bw-wing,y+bd],[x+bw-wing,y+wing],[x+wing,y+wing],[x+wing,y+bd],[x,y+bd]]
      block(plan, storeys, pick(random, bricks))
      groundQuad(rect(w / 2 - 0.12, 1.28, 0.24, d - 1.28), PATH)
      groundQuad(ngon(w / 2, d * 0.61, 0.40, 20), '#b7ae94')
      for (const x of [1.6, w - 1.6]) for (const y of [2.1, d - 1.0]) tree(x, y, 0.90)
    } else {
      const cols = w >= 7 ? 3 : 2
      for (let col = 0; col < cols; col++) {
        const x = 0.4 + col * (w - 0.6) / cols
        const bw = (w - 0.8) / cols - 0.2
        block(rect(x, 0.52, bw, 0.95), storeys + (col % 2), pick(random, bricks))
        block(rect(x, d - 1.47, bw, 0.95), storeys, pick(random, bricks))
        groundQuad(rect(x + bw / 2 - 0.05, 0.15, 0.10, d - 0.3), PATH)
      }
      groundQuad(rect(0.20, d / 2 - 0.10, w - 0.4, 0.20), PATH)
      for (let x = 0.7; x < w - 0.5; x += 1.05) tree(x, d / 2 + 0.36, 0.72 + random() * 0.23, 0, random() < 0.3 ? 'lime' : 'canopy')
    }
    for (let x = 0.55; x < w - 0.3; x += 1.18) {
      tree(x, 0.23, 0.57 + random() * 0.22)
      tree(x + 0.15, d - 0.23, 0.56 + random() * 0.25, 0, x > w / 2 ? 'lime' : 'canopy')
    }
    for (let y = 1.0; y < d - 0.5; y += 1.3) {
      tree(0.23, y, 0.76, 0, 'lime'); tree(w - 0.23, y, 0.76)
    }
  } }
}

export const RESIDENTIAL_RECIPES = {
  suburbanBlock: neighbourhood(11, 'suburb'),
  rowHouseBlock: neighbourhood(23, 'townhouse'),
  mixedBlock: neighbourhood(37, 'mixed'),
  slateCottages: neighbourhood(41, 'cottage'),
  terracottaHomes: neighbourhood(53, 'terracotta'),
  gardenBungalows: neighbourhood(61, 'bungalow'),
  leafySuburb: neighbourhood(77, 'suburb', 8, 5),
  creamCottages: neighbourhood(83, 'cottage', 6, 4),
  brickTerraces: neighbourhood(97, 'townhouse', 6, 4),
  gardenVillas: neighbourhood(107, 'villa', 8, 5),
  terracottaVillas: neighbourhood(113, 'villa', 8, 6),
  quietSuburb: neighbourhood(127, 'bungalow', 6, 4),
  smallGardenFlats: apartments(137, 3, 'slabs', 6, 4),
  smallCourtyard: apartments(139, 3, 'court', 5, 4),
  smallBrickFlats: apartments(149, 4, 'slabs', 6, 4),
  mediumBrickCourt: apartments(151, 5, 'court', 6, 5),
  mediumGardenFlats: apartments(157, 6, 'slabs', 8, 5),
  mediumEstate: apartments(163, 6, 'garden', 8, 7),
  largeGardenEstate: apartments(167, 10, 'garden', 10, 8),
  largeBrickCourt: apartments(173, 12, 'court', 7, 6),
  largeGardenSlabs: apartments(179, 9, 'slabs', 8, 5),
  rowHouses: { size: [2, 1], draw() {
    grounds(2, 1)
    const random = mulberry(181)
    for (let i = 0; i < 3; i++) house(random, 0.08 + i * 0.63, 0.12, 0.57, 0.57, 1, 'townhouse')
  } },
} satisfies Record<string, Recipe>
