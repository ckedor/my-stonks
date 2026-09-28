/** Smooth, depth-tested sculpture surfaces. The city still composites ordinary
 * canvas sprites; this small offscreen renderer is used only while baking one. */
type Vec = [number, number, number]
interface SurfaceMesh { vertices: Vec[]; faces: number[][]; normals?: Vec[]; colors?: Vec[] }

const VERTEX = `
attribute vec3 position;
attribute vec3 normal;
attribute vec3 point;
attribute vec3 paint;
varying vec3 N;
varying vec3 P;
varying vec3 C;
void main() {
  gl_Position = vec4(position, 1.0);
  N = normal;
  P = point;
  C = paint;
}`
const FRAGMENT = `
precision highp float;
varying vec3 N;
varying vec3 P;
varying vec3 C;
uniform vec3 color;
uniform int material;
uniform vec2 heightRange;
void main() {
  vec3 n = normalize(N);
  vec3 view = normalize(vec3(1.0, 1.0, 0.8163265));
  vec3 light = normalize(vec3(-0.4, 0.0, 1.0));
  float diffuse = max(0.0, dot(n, light));
  float rim = pow(1.0 - max(0.0, dot(n, view)), 3.0);
  vec3 r = reflect(-view, n);
  // Large studio softboxes and a warm ground reflection, rather than a
  // tiny plastic highlight. The broad dark/bright bands reveal anatomy.
  float sky = smoothstep(-0.45, 0.65, r.z);
  vec3 environment = mix(vec3(0.24, 0.19, 0.10), vec3(1.0, 0.97, 0.87), sky);
  float strip = exp(-pow((r.x + r.y * 0.35 - 0.12) / 0.16, 2.0));
  float edge = exp(-pow((r.x - r.y * 0.75 + 0.62) / 0.085, 2.0));
  float dark = exp(-pow((r.z - 0.04) / 0.12, 2.0));
  environment *= 1.0 - 0.45 * dark;
  environment += vec3(1.0) * (strip * 0.50 + edge * 0.35);
  vec3 result = color * (0.46 + diffuse * 0.50);
  if (C.x >= 0.0) {
    // Authored paint follows each feather/flame, not the whole object's height.
    float paintedLight = max(0.0, dot(n, normalize(vec3(-0.20, 0.55, 1.0))));
    result = C * (0.73 + paintedLight * 0.30);
    result += vec3(1.0, 0.95, 0.81) * pow(strip, 4.0) * 0.09;
    result += C * rim * 0.10;
  } else if (material == 7) {
    float height = clamp((P.z - heightRange.x) / max(0.001, heightRange.y - heightRange.x), 0.0, 1.0);
    vec3 fire = mix(vec3(0.40, 0.018, 0.035), vec3(0.83, 0.11, 0.055), smoothstep(0.0, 0.56, height));
    fire = mix(fire, vec3(1.0, 0.48, 0.12), smoothstep(0.49, 0.79, height));
    fire = mix(fire, vec3(1.0, 0.91, 0.55), smoothstep(0.73, 0.98, height));
    float flameTips = smoothstep(0.015, 0.17, height) * (1.0 - smoothstep(0.17, 0.29, height));
    fire = mix(fire, vec3(1.0, 0.75, 0.30), flameTips * 0.92);
    // Golden edges pick out individual feather and flame ridges, including
    // those below the wing tips, as on the painted reference sculpture.
    fire = mix(fire, vec3(1.0, 0.77, 0.32), rim * 0.38);
    result = fire * (0.61 + diffuse * 0.43);
    result += fire * environment * 0.17 + vec3(1.0, 0.89, 0.60) * strip * 0.12;
  } else if (material == 0 || material == 1 || material == 6) {
    float metal = material == 1 ? 0.70 : 0.91;
    if (material == 6) {
      float luminance = dot(environment, vec3(0.2126, 0.7152, 0.0722));
      environment = vec3(luminance * 0.96, luminance * 0.99, luminance * 1.04);
    }
    result = mix(result, color * environment * 1.25, metal);
    result += (material == 6 ? vec3(0.94, 0.98, 1.0) : vec3(1.0, 0.96, 0.79)) * pow(strip, 3.0) * 0.18;
    result += color * rim * 0.20;
  } else if (material == 3) {
    float grain = sin(P.z * 95.0 + sin(P.x * 18.0 + P.y * 7.0) * 2.0);
    result *= 0.87 + 0.13 * smoothstep(-0.8, 0.6, grain);
  } else if (material == 4) {
    float leaves = fract(sin(dot(floor(P * 130.0), vec3(12.9898, 78.233, 31.416))) * 43758.5453);
    result *= 0.80 + leaves * 0.35;
  } else if (material == 5) {
    result = mix(color * 0.55, vec3(0.89, 0.99, 1.0), rim * 0.70 + strip * 0.30);
    result += environment * 0.12;
  } else {
    float grain = fract(sin(dot(P, vec3(412.3, 751.9, 321.2))) * 43758.5453);
    result *= 0.96 + grain * 0.08;
  }
  gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}`

let renderer: { canvas: HTMLCanvasElement; gl: WebGLRenderingContext; program: WebGLProgram; buffer: WebGLBuffer } | null | undefined
function getRenderer() {
  if (renderer !== undefined) return renderer
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
  if (!gl) return (renderer = null)
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, source); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null }
    return s
  }
  const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT)
  if (!vertex || !fragment) return (renderer = null)
  const program = gl.createProgram()!
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
  gl.deleteShader(vertex); gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return (renderer = null)
  renderer = { canvas, gl, program, buffer: gl.createBuffer()! }
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); renderer = undefined })
  return renderer
}

/** Already-turned coordinates: x/y in tiles, z in screen pixels. */
export function sculptureSurface(mesh: SurfaceMesh, color: string, material: number) {
  const renderer = getRenderer()
  if (!renderer) return null
  const { gl, canvas, program, buffer } = renderer
  const projected = mesh.vertices.map(([x, y, z]) => [(x - y) * 32, (x + y) * 16 - z, x + y + z / 39.2 * 0.8163265])
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const p of projected) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]) }
  const width = max[0] - min[0] + 4, height = max[1] - min[1] + 4
  const resolution = Math.min(3, 2048 / Math.max(width, height))
  canvas.width = Math.ceil(width * resolution); canvas.height = Math.ceil(height * resolution)
  const data: number[] = []
  for (const face of mesh.faces) {
    for (let i = 1; i < face.length - 1; i++) {
      const ids = [face[0], face[i], face[i + 1]]
      const [a, b, c] = ids.map(id => mesh.vertices[id])
      const u = [b[0] - a[0], b[1] - a[1], (b[2] - a[2]) / 39.2]
      const v = [c[0] - a[0], c[1] - a[1], (c[2] - a[2]) / 39.2]
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      for (const id of ids) {
        const p = projected[id], vertex = mesh.vertices[id]
        data.push((p[0] - min[0] + 2) / width * 2 - 1, 1 - (p[1] - min[1] + 2) / height * 2,
          0.95 - (p[2] - min[2]) / Math.max(0.001, max[2] - min[2]) * 1.9,
          ...(mesh.normals?.[id] ?? normal), vertex[0], vertex[1], vertex[2] / 39.2,
          ...(mesh.colors?.[id] ?? [-1, -1, -1]))
      }
    }
  }
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE)
  gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STREAM_DRAW)
  for (const [i, name] of ['position', 'normal', 'point', 'paint'].entries()) {
    const location = gl.getAttribLocation(program, name)
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 48, i * 12)
  }
  const n = parseInt(color.slice(1), 16)
  gl.uniform3f(gl.getUniformLocation(program, 'color'), ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  gl.uniform1i(gl.getUniformLocation(program, 'material'), material)
  const heights = mesh.vertices.map(vertex => vertex[2] / 39.2)
  gl.uniform2f(gl.getUniformLocation(program, 'heightRange'), Math.min(...heights), Math.max(...heights))
  gl.drawArrays(gl.TRIANGLES, 0, data.length / 12)
  return { canvas, x: min[0] - 2, y: min[1] - 2, width, height }
}
