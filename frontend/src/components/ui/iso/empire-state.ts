import {
  antenna, chamfer, clutter, curtain, groundQuad, loft, meters,
  ngon, prism, punched, rect, strips, type Recipe,
} from './engine'

// Official heights: https://www.esbnyc.com/about/facts-figures
// 86th-floor deck: 1,050 ft; architectural top: 1,250 ft;
// tip including antenna: 1,454 ft. Convert feet rather than rounded metres.
const FOOT = 0.3048
const DECK = 1050 * FOOT
const ARCHITECTURAL_TOP = 1250 * FOOT
const TIP = 1454 * FOOT
const STONE = '#c9bea7'
const TERRACE = '#a07d70'

/** Empire State Building: the landmark heights are exact in the common
 * metre scale. Intermediate setbacks and plans approximate the reference. */
export const EMPIRE_STATE: Recipe = {
  size: [11, 5],
  draw() {
    const facade = strips({ glass: '#494549', module: 3.0, base: 0.2, top: 0.2 })
    const stone = { color: STONE, roof: TERRACE, facade, parapet: 0.035 }
    groundQuad(rect(0, 0, 11, 5), '#b9b2a2')

    // Broad limestone street block, approximately 129 × 57 m.
    const base = rect(0.125, 0.125, 10.75, 4.75)
    prism(base, 0, meters(18), {
      color: '#b4aa95', roof: TERRACE,
      facade: punched({ glass: '#49464a', module: 3.1, w: 0.55, litChance: 0,
        base: { floors: 1.5, color: '#c4baa5', glass: '#49484b', trim: '#d5cbb6' } }),
    })
    // The lower wings step inward at different heights, exposing terraces.
    prism(rect(0.4, 0.35, 2.1, 4.3), meters(18), meters(58), stone)
    prism(rect(1.05, 0.55, 1.45, 3.9), meters(76), meters(27), stone)
    prism(rect(8.5, 0.35, 2.1, 4.3), meters(18), meters(68), stone)
    prism(rect(8.5, 0.55, 1.45, 3.9), meters(86), meters(29), stone)

    // Tall uninterrupted window strips and projecting central bays.
    const shaft = rect(2.5, 0.65, 6, 3.7)
    prism(shaft, meters(18), meters(248), stone)
    prism(rect(4.6, 0.4, 1.8, 0.25), meters(18), meters(265), stone)
    prism(rect(4.6, 4.35, 1.8, 0.25), meters(18), meters(265), stone)
    // Shoulders below the crown, continuing the limestone ribs.
    prism(rect(2.9, 0.85, 5.2, 3.3), meters(266), meters(22), stone)
    prism(rect(3.3, 1.05, 4.4, 2.9), meters(288), meters(15), stone)
    prism(rect(3.65, 1.2, 3.7, 2.6), meters(303), meters(DECK - 303), {
      ...stone,
      facade: punched({ glass: '#5e5651', module: 3.0, w: 0.48, litChance: 0, cornice: '#ded2b9' }),
    })
    // Outdoor observation terrace and its inset upper pavilion.
    const deckPlan = rect(3.55, 1.1, 3.9, 2.8)
    prism(deckPlan, meters(DECK), meters(1.1), { color: '#d4c8af', roof: '#ada38f', parapet: 0.08 })
    prism(rect(4.0, 1.45, 3.0, 2.1), meters(DECK + 1.1), meters(11), {
      color: '#d1c6ae', roof: '#aca28d', facade: punched({ glass: '#5a5750', module: 2.7, w: 0.48, litChance: 0 }),
    })
    prism(chamfer(4.3, 1.65, 2.4, 1.7, 0.2), meters(DECK + 12.1), meters(4), { color: '#c3c0b4', roof: '#bcbeb5' })

    // Stainless-steel mooring mast, tapering to the 102nd-floor lantern.
    const mastBase = DECK + 16.1
    loft([
      { poly: chamfer(4.75, 1.9, 1.5, 1.2, 0.24), z: meters(mastBase) },
      { poly: chamfer(5.04, 2.08, 0.92, 0.84, 0.18), z: meters(365) },
    ], { color: '#9aa3a4', roof: '#bac1bd' })
    // Four fins emphasize the Art Deco vertical silhouette of the mast.
    for (const x of [4.9, 5.98]) prism(rect(x, 2.05, 0.12, 0.9), meters(mastBase), meters(19), { color: '#c4c7bd', roof: '#c4c7bd' })
    prism(ngon(5.5, 2.5, 0.49, 16), meters(365), meters(3), { color: '#b9c1bd', roof: '#c6cdc6' })
    prism(ngon(5.5, 2.5, 0.34, 16), meters(368), meters(ARCHITECTURAL_TOP - 368), {
      color: '#aab4b0', roof: '#c6ccc2', facade: curtain({ glass: '#667579', finsEvery: 2, fin: '#c8cdc2' }),
    })
    prism(ngon(5.5, 2.5, 0.4, 16), meters(ARCHITECTURAL_TOP - 1.2), meters(1.2), { color: '#bbc6be', roof: '#c8d0c6' })

    // Broadcast antenna: no point rises above the official 1,454 ft tip.
    for (const [radius, bottom, top] of [[0.19, ARCHITECTURAL_TOP, 401], [0.13, 401, 421], [0.075, 421, 438]]) {
      prism(ngon(5.5, 2.5, radius, 12), meters(bottom), meters(top - bottom), { color: '#a5b1b1', roof: '#c3ccca' })
    }
    antenna(5.5, 2.5, meters(438), TIP - 438)

    clutter(rect(0.5, 0.5, 1.5, 3.8), meters(76), 2)
    clutter(rect(9.8, 0.5, 0.7, 3.8), meters(86), 2)
    prism(rect(5.05, 4.87, 0.9, 0.1), 0, meters(6), { color: '#a39478', roof: '#bfb196', facade: curtain({ glass: '#343c40' }) })
  },
}
