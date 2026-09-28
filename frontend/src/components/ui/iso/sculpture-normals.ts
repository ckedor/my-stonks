import type { SculptureMesh } from './engine'

type Vec = [number, number, number]

export function sculptureNormals(mesh: SculptureMesh): Vec[] {
  const normals: Vec[] = mesh.vertices.map(() => [0, 0, 0])
  for (const face of mesh.faces) for (let j = 1; j < face.length - 1; j++) {
    const ids = [face[0], face[j], face[j + 1]], [a, b, c] = ids.map(i => mesh.vertices[i])
    const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i])
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    for (const id of ids) for (let k = 0; k < 3; k++) normals[id][k] += normal[k]
  }
  return normals.map(n => { const length = Math.hypot(...n) || 1; return n.map(v => v / length) as Vec })
}

