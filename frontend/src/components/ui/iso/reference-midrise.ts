import {
  chamfer, clutter, curtain, floors, iso, line, mansard, meters, poly,
  prism, punched, rect, rounded, shade, strips, tree,
  type Face, type Recipe,
} from './engine'

const point = (f: Face, u: number, z: number): [number, number] =>
  iso(f.p0[0] + (f.p1[0] - f.p0[0]) * u, f.p0[1] + (f.p1[1] - f.p0[1]) * u, z)
const panel = (f: Face, a: number, b: number, bottom: number, top: number, color: string) =>
  poly([point(f, a, bottom), point(f, b, bottom), point(f, b, top), point(f, a, top)], shade(color, f.k), null)

/** Tall arched ground-floor openings, drawn on each visible facade. */
function arcade(f: Face) {
  const count = Math.max(1, Math.round(f.len * 12 / 4.3))
  const h = f.z1 - f.z0
  for (let i = 0; i < count; i++) {
    const a = (i + 0.18) / count, b = (i + 0.82) / count
    const shoulder = f.z0 + h * 0.62
    const arc = Array.from({ length: 9 }, (_, j) => {
      const t = j / 8 * Math.PI
      return point(f, (a + b) / 2 - Math.cos(t) * (b - a) / 2, shoulder + Math.sin(t) * h * 0.24)
    })
    poly([point(f, a, f.z0), ...arc, point(f, b, f.z0)], shade('#41515b', f.k), shade('#a8a596', f.k), 0.6)
  }
}

const brickWindows = (glass = '#595653') => punched({ glass, module: 2.7, w: 0.52, litChance: 0, frame: '#b9a997' })

export const REFERENCE_MIDRISE = {
  copperMansardBuilding: {
    size: [4, 3],
    draw() {
      const plan = rounded(0.2, 0.2, 3.6, 2.6, 0.3, 3)
      const cream = '#d5cbb7'
      prism(plan, 0, floors(1.5), { color: cream, facade: arcade })
      prism(plan, floors(1.5), floors(9), { color: cream, roof: '#b8ac97', facade: punched({ glass: '#565454', frame: '#e2d8c1', module: 2.7, w: 0.46, litChance: 0, bandEvery: 3, band: '#b6ad9c', cornice: '#e0d6bf' }) })
      prism(plan, floors(10.5), floors(1), { color: '#c5bdaa', facade: punched({ glass: '#4f5350', module: 3, w: 0.45, litChance: 0 }) })
      mansard(plan, floors(11.5), meters(5), 0.3, { color: '#a6b79d', roof: '#a4b89f' })
      const roof = floors(11.5) + meters(5)
      prism(rect(0.65, 0.65, 2.7, 1.7), roof, meters(0.3), { color: '#928a7b', roof: '#9e9586' })
      // Dormers sit above the copper slope rather than floating windows.
      for (const x of [0.65, 1.2, 1.75, 2.3, 2.85]) {
        prism(rect(x, 2.38, 0.24, 0.16), floors(11.5) + meters(2.5), meters(1.7), { color: '#c5cfb7', roof: '#adbea4', facade: punched({ glass: '#4d5b55', module: 2.5, w: 0.5, litChance: 0 }) })
      }
      prism(rect(1.4, 0.8, 0.8, 0.8), roof, meters(4), { color: '#c7c2b1', roof: '#9a968a', facade: punched({ glass: '#595b56', module: 2.4, litChance: 0 }) })
      clutter(rect(0.7, 0.6, 2.6, 1.5), roof, 3)
    },
  },
  terracottaCourtBuilding: {
    size: [4, 3],
    draw() {
      const plan = rect(0.25, 0.2, 3.5, 2.5)
      const cream = '#c9b99c'
      prism(plan, 0, floors(2), { color: cream, facade: curtain({ glass: '#635e55', finsEvery: 3, fin: '#d2c3aa' }) })
      const facade = (f: Face) => {
        panel(f, 0, 0.18, f.z0, f.z1, '#c3986d')
        panel(f, 0.82, 1, f.z0, f.z1, '#c3986d')
        punched({ glass: '#685046', module: 2.6, w: 0.52, litChance: 0, frame: '#d4a07a' })(f)
        for (const u of [0.02, 0.2, 0.8, 0.98]) panel(f, u - 0.013, u + 0.013, f.z0, f.z1, cream)
      }
      prism(plan, floors(2), floors(15), { color: '#b96848', roof: '#968a78', facade })
      prism(plan, floors(17), meters(0.65), { color: '#666763', roof: '#777970' })
      prism(plan, floors(17) + meters(0.65), floors(2), { color: '#b28561', roof: '#9e9585', parapet: 0.06, facade: punched({ glass: '#59554f', frame: '#d9c8a8', module: 3.4, w: 0.58, litChance: 0, cornice: '#d4c4a8' }) })
      const roof = floors(19) + meters(0.65)
      prism(rect(1.2, 0.65, 1.4, 1.2), roof, meters(4), { color: '#9d9689', roof: '#b1a99a' })
      clutter(plan, roof, 5)
      for (const x of [0.6, 1.5, 2.4, 3.3]) tree(x, 2.86, 0.6)
    },
  },
  redGlassBuilding: {
    size: [4, 3],
    draw() {
      const brick = '#a76352'
      const facade = punched({ glass: '#697171', frame: '#ccb9a4', module: 2.5, w: 0.62, litChance: 0 })
      // An L-shaped upper tower leaves a lower glazed wing in front.
      prism(rect(0.2, 0.2, 3.6, 1.7), 0, floors(26), { color: brick, roof: '#b9b6a6', parapet: 0.06, facade })
      prism(rect(2.75, 1.9, 1.05, 0.8), 0, floors(26), { color: brick, roof: '#b9b6a6', facade })
      prism(rect(0.2, 1.9, 2.55, 0.8), 0, floors(9), { color: brick, roof: '#aaa994', facade })
      prism(rect(0.4, 1.84, 2.1, 0.09), floors(9), floors(15.5), { color: '#c1bdb1', facade: curtain({ glass: '#687779', glass2: '#8b9b99', finsEvery: 3, fin: '#c6c9bd' }) })
      prism(rect(0.38, 2.69, 1.5, 0.035), floors(1), floors(7.5), { color: '#bfc2b6', facade: curtain({ glass: '#5b7075', finsEvery: 3, fin: '#bfc2b6' }) })
      const crown = chamfer(0.7, 0.5, 2.5, 1.15, 0.25)
      prism(crown, floors(26), floors(2.5), { color: '#71858a', roof: '#c0c3b4', facade: curtain({ glass: '#4c6875', glass2: '#78949b', spandrel: 0.3 }) })
      clutter(rect(0.5, 0.4, 3, 1.2), floors(26), 2)
    },
  },
  brickSlabBuilding: {
    size: [6, 3],
    draw() {
      const brick = '#ad7960'
      const plan = rect(0.2, 0.2, 5.6, 1.95)
      prism(plan, 0, floors(16), { color: brick, roof: '#9b907f', facade: brickWindows(), parapet: 0.05 })
      // Shallow projecting bays interrupt the long apartment slab.
      for (const x of [0.45, 1.45, 2.45, 3.45, 4.45, 5.25]) {
        prism(rect(x, 2.15, 0.4, 0.18), floors(1), floors(15), { color: '#c49479', roof: '#b9a58a', facade: punched({ glass: '#69625b', module: 2.3, w: 0.68, frame: '#d8b89c', litChance: 0 }) })
      }
      prism(rect(0.45, 2.2, 2.1, 0.65), 0, floors(2), { color: '#b08c70', roof: '#c4b195', facade: punched({ glass: '#6d6056', module: 3, litChance: 0 }) })
      prism(rect(1, 2.35, 0.9, 0.3), floors(2), meters(1.2), { color: '#9e6d55', roof: '#aa8068' })
      clutter(plan, floors(16), 7)
      prism(rect(2.6, 0.5, 1, 0.65), floors(16), meters(3), { color: '#a1927d', roof: '#ad9e84' })
      for (const x of [3.2, 4.1, 5.0]) tree(x, 2.7, 0.72)
    },
  },
  bronzeBayBuilding: {
    size: [3, 3],
    draw() {
      const bronze = '#92775a'
      const facade = (f: Face) => {
        panel(f, 0.24, 0.76, f.z0, f.z1, '#414748')
        for (let z = f.z0 + floors(1); z < f.z1; z += floors(1)) line([point(f, 0.24, z), point(f, 0.76, z)], shade('#8a8f87', f.k), 0.65)
        panel(f, 0.48, 0.52, f.z0, f.z1, '#aaa38c')
      }
      const core = rect(1.0, 0.3, 1.05, 2.4)
      const wings = [rect(0.3, 0.7, 0.7, 1.8), rect(2.05, 0.5, 0.65, 1.85)]
      prism(core, 0, floors(24), { color: bronze, roof: '#c4b59a', facade, parapet: 0.07 })
      wings.forEach((plan, i) => prism(plan, 0, floors(22 + i), { color: '#a08768', roof: '#c4b59a', facade, parapet: 0.06 }))
      prism(rect(1.2, 0.65, 0.65, 1.25), floors(24), meters(3), { color: '#8b785f', roof: '#b7a991' })
      prism(rect(1.1, 2.7, 0.85, 0.2), 0, meters(3.5), { color: bronze, roof: '#ab9578', facade: curtain({ glass: '#414b49' }) })
    },
  },
  roseCornerBuilding: {
    size: [3, 3],
    draw() {
      const pink = '#b9826b'
      const facade = (f: Face) => {
        if (f.len < 0.65) return strips({ glass: '#5e5753', module: 2.4, base: 0.1, top: 0.1 })(f)
        punched({ glass: '#765c53', frame: '#c99e85', module: 2.65, w: 0.43, litChance: 0 })(f)
      }
      const front = chamfer(0.2, 0.25, 1.25, 2.5, 0.3)
      const rear = chamfer(1.45, 0.25, 1.3, 1.5, 0.28)
      prism(front, 0, floors(21), { color: pink, roof: '#bcb5a6', facade, parapet: 0.05 })
      prism(rear, 0, floors(19), { color: '#ba8d77', roof: '#bcb5a6', facade, parapet: 0.05 })
      prism(rect(1.45, 1.75, 1.25, 0.9), 0, floors(1), { color: '#ac8c71', roof: '#71815c', facade: punched({ glass: '#635b51', module: 3, litChance: 0 }) })
      prism(chamfer(0.35, 0.5, 0.6, 0.7, 0.15), floors(21), floors(2), { color: '#ba876a', roof: '#c8bba4' })
      prism(rect(0.85, 1.65, 0.45, 0.6), floors(21), meters(2.3), { color: '#b69177', roof: '#c5b59e' })
      clutter(rear, floors(19), 2)
    },
  },
} satisfies Record<string, Recipe>
