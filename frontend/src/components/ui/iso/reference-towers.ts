import {
  chamfer, clutter, curtain, floors, inset, iso, line, meters, ngon,
  poly, prism, punched, rect, rounded, shade, tree,
  type Face, type Recipe,
} from './engine'

/** Facade coordinates stay attached to the face, including quarter turns. */
const point = (f: Face, u: number, z: number): [number, number] =>
  iso(f.p0[0] + (f.p1[0] - f.p0[0]) * u, f.p0[1] + (f.p1[1] - f.p0[1]) * u, z)
const pane = (f: Face, a: number, b: number, z0: number, z1: number, color: string) =>
  poly([point(f, a, z0), point(f, b, z0), point(f, b, z1), point(f, a, z1)], shade(color, f.k), null)

function officeFacade(glass: string, frame: string, major = 4, gold = false) {
  return (f: Face) => {
    pane(f, 0, 1, f.z0, f.z1, glass)
    const columns = Math.max(2, Math.round(f.len * 12 / 1.8))
    const storey = floors(1)
    for (let z = f.z0; z + storey <= f.z1; z += storey) {
      for (let c = 0; c < columns; c++) {
        if (gold && f.rand() < 0.16) pane(f, c / columns, (c + 0.78) / columns, z + storey * 0.08, z + storey * 0.92, '#c1aa65')
      }
      line([point(f, 0, z), point(f, 1, z)], shade(gold ? '#73767a' : '#64717b', f.k), 0.55)
    }
    for (let c = 0; c <= columns; c++) {
      const wide = c % major === 0
      const half = (wide ? 0.16 : 0.025) / columns
      pane(f, Math.max(0, c / columns - half), Math.min(1, c / columns + half), f.z0, f.z1, wide ? frame : '#727d83')
    }
  }
}

function plant(x: number, y: number, w: number, d: number, z: number) {
  prism(rect(x, y, w, d), z, meters(0.6), { color: '#958773', roof: '#59714d' })
}

function coolingUnit(x: number, y: number, z: number, w = 0.6, d = 0.7) {
  prism(rect(x, y, w, d), z, meters(2.4), { color: '#a6a7a2', roof: '#c5c5bc' })
  for (let i = 0; i < 4; i++) {
    prism(rect(x + w * 0.1, y + d * (0.12 + i * 0.19), w * 0.8, d * 0.1), z + meters(2.4), meters(0.15), { color: '#61676a', roof: '#777b79' })
  }
}

/** Six office buildings drawn from the user's city references, in order. */
export const REFERENCE_TOWERS = {
  steppedSlateTower: {
    size: [5, 4],
    draw() {
      const stone = '#b4b4ac'
      const striped = (f: Face) => {
        if (f.len < 0.95) return curtain({ glass: '#424956', glass2: '#626b73', spandrel: 0.09 })(f)
        pane(f, 0, 1, f.z0, f.z1, stone)
        for (let z = f.z0; z + floors(1) <= f.z1; z += floors(1)) {
          pane(f, 0.015, 0.985, z + floors(0.3), z + floors(0.77), '#404755')
        }
      }
      const base = rect(0.2, 0.2, 4.6, 3.6)
      prism(base, 0, floors(4), { color: '#aba69d', facade: punched({ glass: '#45454b', module: 3.8, w: 0.65, litChance: 0 }) })
      const shaft = chamfer(0.4, 0.4, 4.2, 3.2, 0.6)
      prism(shaft, floors(4), floors(29), { color: stone, facade: striped })
      let z = floors(33)
      for (const [offset, height] of [[0, 6], [0.22, 5], [0.43, 5], [0.63, 4]]) {
        const plan = chamfer(0.4 + offset, 0.4 + offset * 0.55, 4.2 - offset * 2, 3.2 - offset * 1.1, 0.5)
        prism(plan, z, floors(height), { color: stone, roof: '#92918a', facade: striped, parapet: 0.04 })
        z += floors(height)
      }
      const crown = chamfer(1.03, 0.747, 2.94, 2.507, 0.5)
      clutter(crown, z, 5)
      coolingUnit(2.1, 1.4, z, 0.85, 0.75)
      prism(rect(1.6, 3.8, 1.8, 0.16), 0, meters(4), { color: '#797671', facade: curtain({ glass: '#42464c' }) })
    },
  },
  framedOfficeTower: {
    size: [5, 4],
    draw() {
      const plan = rect(0.3, 0.3, 4.4, 3.3)
      const stone = '#bcb1a0'
      prism(plan, 0, floors(2), { color: stone, facade: curtain({ glass: '#3e484f', finsEvery: 2, fin: stone }) })
      prism(plan, floors(2), floors(29), { color: stone, roof: '#969187', facade: officeFacade('#384653', stone, 3) })
      prism(plan, floors(31), floors(2), { color: stone, roof: '#928e85', facade: punched({ glass: '#5c555a', module: 4.8, w: 0.78, litChance: 0 }), parapet: 0.05 })
      prism(rect(0.7, 0.7, 2.25, 1.85), floors(33), meters(0.4), { color: '#cfc6b5', roof: '#d4ccbc' })
      coolingUnit(3.35, 0.75, floors(33), 0.8, 1.05)
      coolingUnit(3.35, 2.0, floors(33), 0.8, 0.9)
      for (const x of [1.15, 2.3, 3.45]) tree(x, 3.83, 0.72)
    },
  },
  limestoneSetbackTower: {
    size: [5, 4],
    draw() {
      const stone = '#cabfa7'
      const facade = punched({ glass: '#55504e', module: 2.7, w: 0.48, litChance: 0, cornice: '#e0d4bd' })
      let z = 0
      for (const [offset, count] of [[0, 20], [0.32, 5], [0.62, 5], [0.92, 5], [1.18, 5], [1.46, 4]]) {
        const plan = rect(0.18 + offset, 0.18 + offset * 0.67, 4.64 - offset * 2, 3.64 - offset * 1.34)
        prism(plan, z, floors(count), { color: stone, roof: '#a39c8d', facade, parapet: 0.04 })
        z += floors(count)
      }
      prism(rect(2, 1.45, 0.95, 0.8), z, meters(2.5), { color: '#b8ae9c', roof: '#bdb7a8' })
      prism(ngon(2.5, 1.85, 0.14, 10), z + meters(2.5), meters(1), { color: '#d1c8b6' })
      // Narrow stone piers carry the lower facade down to the entrance.
      prism(rect(1.55, 3.82, 1.8, 0.14), 0, meters(4.5), { color: stone, facade: curtain({ glass: '#484846', finsEvery: 2, fin: stone }) })
    },
  },
  ribbedOfficeTower: {
    size: [4, 6],
    draw() {
      const plan = rect(0.3, 0.3, 3.4, 5.4)
      const stone = '#bdb49f'
      const facade = (f: Face) => {
        pane(f, 0, 1, f.z0, f.z1, '#353943')
        const columns = Math.max(3, Math.round(f.len * 12 / 4.5))
        for (let c = 0; c <= columns; c++) {
          const half = 0.055 / columns
          pane(f, Math.max(0, c / columns - half), Math.min(1, c / columns + half), f.z0, f.z1, stone)
        }
      }
      prism(plan, 0, floors(2), { color: stone, facade: curtain({ glass: '#444750', finsEvery: 3, fin: stone }) })
      prism(plan, floors(2), floors(12), { color: stone, facade: punched({ glass: '#393b43', module: 2.1, w: 0.8, litChance: 0 }) })
      prism(plan, floors(14), floors(33), { color: stone, facade })
      prism(plan, floors(47), floors(1.5), { color: stone, roof: '#b4a68a', parapet: 0.08, facade: punched({ glass: '#656061', module: 3.8, w: 0.65, litChance: 0 }) })
      prism(rect(1.05, 1.25, 1.8, 2.8), floors(48.5), meters(4), { color: '#b5b7af', roof: '#d0cec2' })
      for (const y of [1.4, 2.45, 3.5]) coolingUnit(1.3, y, floors(48.5) + meters(4), 1.2, 0.75)
      plant(0.08, 1.0, 0.16, 3.8, 0)
    },
  },
  roundedObsidianTower: {
    size: [4, 4],
    draw() {
      const plan = rounded(0.25, 0.25, 3.5, 3.5, 0.75, 5)
      prism(plan, 0, floors(2), { color: '#666c70', facade: curtain({ glass: '#334656', finsEvery: 4, fin: '#6f777b' }) })
      prism(plan, floors(2), floors(48), { color: '#555c67', roof: '#a39a86', facade: officeFacade('#414958', '#596270', 5), parapet: 0.09 })
      prism(chamfer(1.05, 1.1, 1.9, 1.7, 0.2), floors(50), meters(8), { color: '#777a7b', roof: '#94958e' })
      coolingUnit(1.35, 1.3, floors(50) + meters(8), 0.65, 0.9)
      coolingUnit(2.15, 1.5, floors(50) + meters(8), 0.55, 0.65)
      // Sloping-looking entrance apron and a low glazed canopy.
      prism(chamfer(1.05, 3.25, 1.9, 0.65, 0.18), 0, meters(4.5), { color: '#5b6c78', roof: '#637987' })
      for (const x of [0.6, 3.4]) tree(x, 3.65, 0.65)
    },
  },
  goldenGardenTower: {
    size: [5, 5],
    draw() {
      const plan = [[0.3, 0.4], [3.7, 0.25], [4.65, 1.1], [4.5, 3.75], [3.1, 4.6], [0.4, 4.4]] as [number, number][]
      prism(plan, 0, floors(3), { color: '#9c7860', facade: curtain({ glass: '#39444e', finsEvery: 2, fin: '#a18b72' }) })
      prism(plan, floors(3), floors(47), { color: '#797967', roof: '#c3ab5c', facade: officeFacade('#4a5157', '#92917a', 6, true), parapet: 0.06 })
      const roof = floors(50)
      prism(inset(plan, 0.16), roof, meters(0.22), { color: '#c2ab62', roof: '#85816a' })
      plant(0.65, 0.72, 2.65, 0.25, roof + meters(0.22))
      plant(3.55, 1.4, 0.45, 1.5, roof + meters(0.22))
      prism(rect(0.85, 1.35, 1.45, 1.05), roof, meters(3), { color: '#b8b6a6', roof: '#d8d5bf' })
      coolingUnit(0.98, 1.5, roof + meters(3), 0.6, 0.7)
      prism(ngon(3.65, 1.0, 0.27, 16), roof + meters(0.22), meters(0.2), { color: '#c59a6f', roof: '#d2ab7e' })
      for (const [x, y] of [[3.6, 1.7], [3.65, 2.35], [1.0, 0.85], [2.85, 0.85]]) tree(x, y, 0.38, roof + meters(0.8))
      prism(rect(1.5, 4.4, 1.8, 0.3), 0, meters(4), { color: '#a87f65', roof: '#bb9674', facade: curtain({ glass: '#475459' }) })
    },
  },
} satisfies Record<string, Recipe>
