import {
  groundLine, groundQuad, iso, line, loft, meters, ngon, poly,
  prism, shade, type Recipe, type Skin,
} from './engine'

// Height: City of London, 30 St Mary Axe (The Gherkin).
// https://www.cityoflondon.gov.uk/things-to-do/architecture/modern-architecture/30-st-mary-axe-the-gherkin
// Maximum circumference 178 m, base diameter under 50 m, top lens 2.4 m:
// https://www.buildingthegherkin.com/pdf/factsandfigures.pdf
const HEIGHT = 180
const MAX_RADIUS = 178 / (2 * Math.PI)
const CENTER = 3

/** Measured height and maximum girth; intermediate radii are an artistic
 * approximation of the reference silhouette, not surveyed floor plans. */
const profile: [number, number][] = [
  [0, 23], [8, 24.2], [25, 26.2], [48, 27.9], [70, MAX_RADIUS],
  [90, 27.6], [110, 25.3], [130, 21.5], [145, 17.7], [158, 13.5],
  [169, 8.9], [176, 4.5], [179.6, 1.2],
]

function radiusAt(height: number) {
  const i = profile.findIndex(([z]) => z >= height)
  if (i <= 0) return profile[i < 0 ? profile.length - 1 : 0][1] / 12
  const [z0, r0] = profile[i - 1], [z1, r1] = profile[i]
  return (r0 + (r1 - r0) * (height - z0) / (z1 - z0)) / 12
}

/** Every two-storey panel carries crossed diagonals. Dark glazing winds
 * through the triangles in six bands; no random lit office windows. */
const diagrid: Skin = face => {
  const at = (u: number, v: number): [number, number] => {
    const x0 = face.a0[0] + (face.a1[0] - face.a0[0]) * u
    const y0 = face.a0[1] + (face.a1[1] - face.a0[1]) * u
    const x1 = face.b0[0] + (face.b1[0] - face.b0[0]) * u
    const y1 = face.b0[1] + (face.b1[1] - face.b0[1]) * u
    return iso(x0 + (x1 - x0) * v, y0 + (y1 - y0) * v, face.z0 + (face.z1 - face.z0) * v)
  }
  const angle = Math.atan2((face.a0[1] + face.a1[1]) / 2 - CENTER, (face.a0[0] + face.a1[0]) / 2 - CENTER)
  const baseHeight = face.z0 / meters(1)
  const topHeight = face.z1 / meters(1)
  const triangles: [number, number][][] = [
    [[0, 0], [1, 0], [0.5, 0.5]], [[1, 0], [1, 1], [0.5, 0.5]],
    [[1, 1], [0, 1], [0.5, 0.5]], [[0, 1], [0, 0], [0.5, 0.5]],
  ]
  for (const triangle of triangles) {
    const u = triangle.reduce((s, p) => s + p[0], 0) / 3
    const v = triangle.reduce((s, p) => s + p[1], 0) / 3
    const h = baseHeight + (topHeight - baseHeight) * v
    const phase = (angle + (u - 0.5) * Math.PI / 18 - h * Math.PI / 150) * 6
    const dark = Math.cos(phase) > 0.25
    const crown = h > 153
    const color = crown ? '#344b60' : dark ? '#203440' : ['#78989f', '#547887', '#99b2b2'][Math.floor(face.rand() * 3)]
    poly(triangle.map(([a, b]) => at(a, b)), shade(color, face.k), null)
  }
  const steel = shade(topHeight > 155 ? '#78939c' : '#b1c5c4', face.k)
  line([at(0, 0), at(1, 1)], steel, 0.85)
  line([at(1, 0), at(0, 1)], steel, 0.85)
  line([at(0, 0.5), at(1, 0.5)], 'rgba(192,212,211,0.3)', 0.45)
  line([at(0, 0), at(1, 0)], shade('#617c87', face.k), 0.5)
  line([at(0, 0), at(0, 1)], 'rgba(150,178,185,0.3)', 0.45)
}

export const GHERKIN: Recipe = {
  size: [6, 6],
  draw() {
    groundQuad(ngon(CENTER, CENTER, 2.95, 48), '#b9b8ab')
    for (const y of [0.6, 1.2, 4.8, 5.4]) groundLine([0.5, y], [5.5, y], '#aaa99b', 0.55)
    const rings = Array.from({ length: 22 }, (_, i) => {
      const height = i * 8.4
      return { poly: ngon(CENTER, CENTER, radiusAt(height), 36, Math.PI / 36), z: meters(height) }
    })
    // The last ring is the small glazed lens, below the 180 m summit.
    rings.push({ poly: ngon(CENTER, CENTER, 1.2 / 12, 36, Math.PI / 36), z: meters(179.6) })
    loft(rings, { color: '#466472', roof: '#3f5769', skin: diagrid, outline: null })
    prism(ngon(CENTER, CENTER, 1.2 / 12, 36), meters(179.6), meters(HEIGHT - 179.6), { color: '#a8c1c8', roof: '#c5d6d9', outline: null })
  },
}
