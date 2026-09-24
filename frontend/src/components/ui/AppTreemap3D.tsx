import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { Box } from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import AppTreemap, { type AppTreemapLeaf, type AppTreemapProps } from './AppTreemap'
import AppIconButton from './AppIconButton'
import AppStack from './AppStack'
import AppText from './AppText'
import { space } from '@/theme/tokens'
import { cityDecor } from './city-decor'
import { cityLayout } from './city-layout'

/** Height of the district lots above the street. */
const CURB = 0.03
/** How far up a facade the darkening at its foot reaches, in world units. */
const GRIME_HEIGHT = 0.35
/** World size of one window tile on the facades: one floor. */
const FLOOR = 0.08
const RISE_MS = 700
const PROJECTION_MS = 450

/** Mixes in sRGB, where "8% darker" reads as 8% darker. */
function mix(from: THREE.ColorRepresentation, to: THREE.ColorRepresentation, amount: number) {
  const start = new THREE.Color(from).convertLinearToSRGB()
  return start.lerp(new THREE.Color(to).convertLinearToSRGB(), amount).convertSRGBToLinear()
}

/** Eight by eight floors of facade, in the same grid as `litWindows`: a
 *  wall of fine stone grain with a faint line at each floor, and windows
 *  that each differ a little — the shade of the glass, a reflection across
 *  it, now and then a blind half down — in a frame with a mullion and a
 *  sill. White and grays, so the building's tint colors it. Glass is darker
 *  than wall, and the same map sets roughness, so glass shines and the wall
 *  does not. */
function facadeTile() {
  const cell = 64
  const size = cell * 8
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  let state = 17
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647
  if (context) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size, size)
    for (let index = 0; index < 9000; index++) {
      const level = Math.round(255 * (0.9 + random() * 0.1))
      context.fillStyle = `rgb(${level},${level},${level})`
      context.fillRect(random() * size, random() * size, 1.5, 1.5)
    }
    for (let row = 0; row < 8; row++) {
      context.fillStyle = '#e4e4e4'
      context.fillRect(0, row * cell + cell - 3, size, 3)
      for (let column = 0; column < 8; column++) {
        const x = column * cell + 16
        const y = row * cell + 18
        const glass = Math.round(120 + random() * 40)
        context.fillStyle = '#7c848c'
        context.fillRect(x - 2, y - 2, 36, 34)
        context.fillStyle = `rgb(${glass},${glass + 8},${glass + 16})`
        context.fillRect(x, y, 32, 30)
        // A pale streak of reflected sky across the upper corner.
        context.fillStyle = 'rgba(255,255,255,0.18)'
        context.beginPath()
        context.moveTo(x, y + 12)
        context.lineTo(x + 14, y)
        context.lineTo(x + 22, y)
        context.lineTo(x, y + 20)
        context.fill()
        if (random() < 0.22) {
          context.fillStyle = '#cfc9bd'
          context.fillRect(x, y, 32, 8 + random() * 14)
        }
        context.fillStyle = '#9aa1a8'
        context.fillRect(x + 15, y, 2, 30)
        context.fillStyle = '#d6d2ca'
        context.fillRect(x - 3, y + 31, 38, 3)
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

const CAR_COLORS = ['#e4dfd3', '#b8473f', '#46627f', '#d9a441', '#3d3d3d', '#8fa3a8', '#f2f0ea']
const TREE_COLORS = ['#5f7f45', '#7d9a62', '#8fb069', '#4d6b3c', '#a3b86c', '#6c8b57', '#3f5e3a', '#96a85a']
/** Ipê amarelo, ipê roxo and a tree turning in the fall. */
const TREE_BLOSSOMS = ['#e3bb3b', '#a8739f', '#c7803e']
const HOUSE_WALLS = ['#f2ede3', '#efe2c4', '#e7d3b8', '#d9e3e6', '#dfe8d6', '#f1d9cf', '#e8e4dc', '#d8cbb5']
const HOUSE_ROOFS = ['#a4553a', '#b0674a', '#8e4a34', '#5f6166', '#6e5a4a']
const SHOP_WALLS = ['#ece6da', '#e3d9c6', '#d9dde0', '#efe4d2', '#dcd3c4']
const AWNING_COLORS = ['#b5483c', '#3f7a5a', '#3f5f86', '#c99a3a', '#7b4f7a', '#2f6f73']
const STATION_COLORS = ['#c0392b', '#2e7d4f', '#1f5f9e']
const WATER = '#6db3cc'
const FIELD_COLORS = ['#c9bf86', '#a9b877', '#b89a72', '#9bb07a', '#d0c58f']
const UMBRELLA_COLORS = ['#e4574a', '#f2c14e', '#3f8fc0', '#f4efe4', '#48a38a', '#e98a3c', '#c95c8a']
const GRASS_COLORS = ['#a7bb86', '#9cb37b', '#adc08c', '#97ad78']
const SIGNAL_COLORS = ['#ff4d3d', '#ffc933', '#4ddb6b']

/** Takes some of the saturation out, so the city reads as a model rather
 *  than a toy; lightness is kept, so nothing turns grey or dark. */
function muted(color: THREE.Color) {
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  return color.setHSL(hsl.h, hsl.s * 0.68, hsl.l)
}

/** A house facade: white wall, so the instance color paints it, with
 *  framed windows and, on the street side, a door. `lit` draws the same
 *  layout as a glow map: the glass alone, for the lights at night. */
function houseFacade(face: 'front' | 'side', stories: 1 | 2, lit = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = stories === 1 ? 112 : 224
  const context = canvas.getContext('2d')
  if (context) {
    const paint = (color: string) => lit ? '#000000' : color
    context.fillStyle = paint('#ffffff')
    context.fillRect(0, 0, canvas.width, canvas.height)
    const window = (cx: number, top: number) => {
      context.fillStyle = paint('#f7f7f7')
      context.fillRect(cx - 24, top - 4, 48, 48)
      context.fillStyle = lit ? '#ffffff' : '#8d9aa4'
      context.fillRect(cx - 19, top, 38, 40)
      context.fillStyle = paint('#f7f7f7')
      context.fillRect(cx - 2, top, 4, 40)
      context.fillStyle = paint('#c9c2b6')
      context.fillRect(cx - 27, top + 44, 54, 6)
    }
    const ground = canvas.height - 112
    if (face === 'front') {
      window(52, ground + 30)
      window(204, ground + 30)
      context.fillStyle = paint('#6f5442')
      context.fillRect(106, ground + 30, 44, 82)
      context.fillStyle = paint('#d8c9a8')
      context.fillRect(140, ground + 70, 5, 5)
    } else window(128, ground + 30)
    if (stories === 2) for (const cx of face === 'front' ? [52, 128, 204] : [128]) window(cx, 30)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A storefront: plain band for the sign on top, then a glass front with
 *  mullions and a door in the middle. `lit` is its glow map, as above. */
function storefront(lit = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = lit ? '#000000' : '#ffffff'
    context.fillRect(0, 0, 256, 128)
    context.fillStyle = lit ? '#ffffff' : '#7f8f9b'
    context.fillRect(14, 46, 228, 70)
    context.fillStyle = lit ? '#9a9a9a' : '#56636d'
    context.fillRect(110, 50, 36, 66)
    context.fillStyle = lit ? '#000000' : '#f2f2f2'
    for (const x of [60, 106, 146, 196]) context.fillRect(x, 46, 4, 70)
    context.fillRect(14, 42, 228, 5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Eight by eight floors of windows, some of them lit: the glow map of a
 *  facade at night. It spans eight window tiles, so each building shows a
 *  different part of it and no two light up alike. */
function litWindows() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#000000'
    context.fillRect(0, 0, 256, 256)
    for (let column = 0; column < 8; column++) for (let row = 0; row < 8; row++) {
      const hash = Math.sin(column * 12.9898 + row * 78.233) * 43758.5453
      const chance = hash - Math.floor(hash)
      if (chance > 0.42) continue
      context.fillStyle = chance < 0.08 ? '#bcd4ff' : '#ffffff'
      context.fillRect(column * 32 + 8, row * 32 + 9, 16, 15)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** A round warm glow: the pool of light under a street lamp. */
function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(canvas)
}

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** Where the sun is, from the clock: `night` and `golden` weigh the night
 *  and the low warm light of dawn and dusk against plain day. The sun rises
 *  at six and sets at eighteen, which is close enough in Brazil. */
function daylight(date: Date) {
  const hours = date.getHours() + date.getMinutes() / 60
  const elevation = Math.sin((hours - 6) / 12 * Math.PI)
  const night = 1 - smoothstep(-0.12, 0.06, elevation)
  const golden = (1 - smoothstep(0.06, 0.4, elevation)) * (1 - night)
  const altitude = THREE.MathUtils.degToRad(12 + Math.max(0, elevation) * 58)
  const azimuth = (hours - 6) / 12 * Math.PI
  const sun = new THREE.Vector3(Math.cos(azimuth) * Math.cos(altitude), Math.sin(altitude), 0.35 * Math.cos(altitude)).normalize()
  return { night, golden, sun }
}

/** Seamless speckle: white with soft dots of gray, repeated without seams.
 *  Multiplied by a surface's color it reads as texture — leaves, grass,
 *  asphalt — without any image files. */
function speckle(count: number, radius: [number, number], shade: [number, number], seed: number) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  let state = seed
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647
  if (context) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size, size)
    for (let index = 0; index < count; index++) {
      const x = random() * size
      const y = random() * size
      const r = radius[0] + random() * (radius[1] - radius[0])
      const level = Math.round(255 * (shade[0] + random() * (shade[1] - shade[0])))
      context.fillStyle = `rgb(${level},${level},${level})`
      // Dots crossing an edge are drawn again on the other side: no seams.
      for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
        if (Math.abs(x + dx - size / 2) > size / 2 + r || Math.abs(y + dy - size / 2) > size / 2 + r) continue
        context.beginPath()
        context.arc(x + dx, y + dy, r, 0, Math.PI * 2)
        context.fill()
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Farmland seen from afar: soft patches of meadow and crop, for the open
 *  land around the city. */
function patchwork() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  let state = 7
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647
  if (context) {
    context.fillStyle = '#a9b88f'
    context.fillRect(0, 0, size, size)
    const tones = ['#b5c19a', '#a0b287', '#bfbd8e', '#97aa80', '#b6b289', '#acbd94', '#a6ae84']
    for (let index = 0; index < 46; index++) {
      const width = 30 + random() * 80
      const height = 24 + random() * 70
      const x = random() * size
      const y = random() * size
      context.fillStyle = tones[Math.floor(random() * tones.length)]
      for (const dx of [-size, 0]) for (const dy of [-size, 0]) context.fillRect(x + dx, y + dy, width, height)
    }
    for (let index = 0; index < 2400; index++) {
      const level = 0.9 + random() * 0.1
      context.fillStyle = `rgba(0,0,0,${(1 - level).toFixed(3)})`
      context.fillRect(random() * size, random() * size, 1.5, 1.5)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Crop rows: light and dark stripes, painted by each parcel's color. */
function cropRows() {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 8, 64)
    context.fillStyle = '#c4c4c4'
    for (let row = 0; row < 8; row++) context.fillRect(0, row * 8 + 5, 8, 3)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 3)
  return texture
}

/** Paving stones: a running bond of slabs, each a slightly different
 *  shade, with darker joints. White, so a material color tints it. */
function pavers(columns: number, rows: number, joint: string) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  let state = 11
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647
  if (context) {
    context.fillStyle = joint
    context.fillRect(0, 0, size, size)
    const width = size / columns
    const height = size / rows
    for (let row = 0; row < rows; row++) for (let column = -1; column < columns; column++) {
      const level = Math.round(255 * (0.9 + random() * 0.1))
      context.fillStyle = `rgb(${level},${level},${level})`
      const x = column * width + (row % 2 ? width / 2 : 0)
      context.fillRect(x + 1.5, row * height + 1.5, width - 3, height - 3)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Calçadão: bands of dark and light stone in waves, as on the promenades
 *  of Rio. */
function promenadeWaves() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#efe9dd'
    context.fillRect(0, 0, size, size)
    context.fillStyle = '#3b3a38'
    for (const band of [0, 64]) {
      context.beginPath()
      for (let x = 0; x <= size; x += 2) context.lineTo(x, band + 16 + Math.sin(x / size * Math.PI * 2) * 12)
      for (let x = size; x >= 0; x -= 2) context.lineTo(x, band + 40 + Math.sin(x / size * Math.PI * 2) * 12)
      context.closePath()
      context.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Ripples for the sea: a normal map drawn from a sum of crossing waves, so
 *  it tiles, and scrolled over time so the water moves. */
function seaRipples() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const height = (x: number, y: number) => {
      const u = x / size * Math.PI * 2
      const v = y / size * Math.PI * 2
      return Math.sin(u * 3 + v * 2) + 0.6 * Math.sin(u * 5 - v * 3 + 1.3) + 0.4 * Math.sin(-u * 2 + v * 7 + 2.1) + 0.25 * Math.sin(u * 11 + v * 5)
    }
    const image = context.createImageData(size, size)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y)
      const dy = height(x, y + 1) - height(x, y - 1)
      const normal = new THREE.Vector3(-dx, -dy, 3).normalize()
      const index = (y * size + x) * 4
      image.data[index] = (normal.x * 0.5 + 0.5) * 255
      image.data[index + 1] = (normal.y * 0.5 + 0.5) * 255
      image.data[index + 2] = (normal.z * 0.5 + 0.5) * 255
      image.data[index + 3] = 255
    }
    context.putImageData(image, 0, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Stretches a plane's UVs so a repeating texture keeps one world size. */
function tileUv(geometry: THREE.PlaneGeometry, width: number, depth: number, tile: number) {
  const uv = geometry.attributes.uv
  for (let index = 0; index < uv.count; index++) uv.setXY(index, uv.getX(index) * width / tile, uv.getY(index) * depth / tile)
  return geometry
}

/** A soft dark patch for the ground under anything that stands on it: the
 *  contact shadow a real ambient occlusion pass would produce, baked. */
function contactTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    context.filter = 'blur(14px)'
    context.fillStyle = '#000000'
    context.beginPath()
    context.roundRect(30, 30, 68, 68, 18)
    context.fill()
  }
  return new THREE.CanvasTexture(canvas)
}

/** Ambient occlusion for facades: darker at the foot of the wall, clear from
 *  a fixed height up. Its repeat sets that height in world units. */
function groundingTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createLinearGradient(0, 64, 0, 0)
    gradient.addColorStop(0, '#7a7a7a')
    gradient.addColorStop(0.5, '#d4d4d4')
    gradient.addColorStop(1, '#ffffff')
    context.fillStyle = gradient
    context.fillRect(0, 0, 1, 64)
  }
  return new THREE.CanvasTexture(canvas)
}

/** Flat things on the ground are also lifted apart by these few
 *  millimeters: the depth bias alone did not hold at grazing angles, and
 *  the land showed green through the asphalt. */
const LIFT = { land: -0.012, crops: -0.006, sea: -0.004, sand: -0.002, roadX: 0, roadZ: 0.0012, lawn: 0.0015, paving: 0.003, marking: 0.0045, shade: 0.006, glow: 0.0075 }

/** Everything flat on the ground lies in the same plane, so each kind gets
 *  its own whole step of depth bias: lawn under pavement under markings
 *  under shade under light. Two kinds on one step flicker where they
 *  overlap, as the parking lots did on the commercial lawns. */
const groundLayer = (step: 1 | 2 | 3 | 4 | 5) => ({ polygonOffset: true, polygonOffsetFactor: -step, polygonOffsetUnits: -step * 4 })

const easeOut = (t: number) => 1 - (1 - t) ** 3
const smooth = (t: number) => t * t * (3 - 2 * t)

/** O volume representa valor mesmo quando a base dos prédios menores encolhe. */
export default function AppTreemap3D(props: AppTreemapProps & {
  showProjection?: boolean
  renderSidebar?: (leaf: AppTreemapLeaf | null) => ReactNode
}) {
  const { groups, height, backgroundColor, labelColor, showProjection = false, renderSidebar } = props
  const host = useRef<HTMLDivElement>(null)
  /** Immersive: the city takes the whole screen and the panel floats over
   *  it. The browser's fullscreen hides its own chrome when it is allowed;
   *  without it (iOS Safari), the page layer alone still covers the window. */
  const [immersive, setImmersive] = useState(false)
  useEffect(() => {
    if (!immersive) return
    const leave = () => { if (!document.fullscreenElement) setImmersive(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setImmersive(false) }
    document.addEventListener('fullscreenchange', leave)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('fullscreenchange', leave)
      window.removeEventListener('keydown', escape)
    }
  }, [immersive])
  const toggleImmersive = () => {
    if (immersive) {
      if (document.fullscreenElement) void document.exitFullscreen()
      setImmersive(false)
      return
    }
    setImmersive(true)
    // The whole document goes fullscreen, not the stage: lists and tooltips
    // open in a portal on the body, which a fullscreen stage would hide.
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const [unavailable, setUnavailable] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | number | null>(null)
  const renderRef = useRef<() => void>(() => {})
  const animateRef = useRef<() => void>(() => {})
  const highlightRef = useRef<(key: string | number | null) => void>(() => {})
  const projectionVisible = useRef(showProjection)
  const selectedRef = useRef(selectedKey)
  useEffect(() => {
    projectionVisible.current = showProjection
    animateRef.current()
  }, [showProjection])
  useEffect(() => {
    selectedRef.current = selectedKey
    highlightRef.current(selectedKey)
    renderRef.current()
  }, [selectedKey])

  useEffect(() => {
    const element = host.current
    if (!element || unavailable) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setUnavailable(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(backgroundColor)
    // Filmic tone mapping rolls the highlights off instead of clipping them;
    // flat colors (ground, labels) opt out below so they match the page.
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // Only buildings rising or a projection changing move a shadow; with the
    // cars driving, redrawing the shadow map every frame would be waste.
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
    element.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-label', 'Distribuição 3D. Arraste para deslocar, botão direito para girar e roda para aproximar.')
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = true
    controls.screenSpacePanning = true
    controls.zoomToCursor = true
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }
    controls.minDistance = 0.3
    controls.maxDistance = 55
    controls.maxPolarAngle = Math.PI / 2.05
    // A soft studio environment gives the materials something to reflect;
    // a warm sun and a cool sky keep lit and shaded faces apart.
    const environments = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const environment = environments.fromScene(room, 0.04).texture
    room.dispose()
    environments.dispose()
    scene.environment = environment
    scene.environmentIntensity = 0.35
    const sky = new THREE.HemisphereLight(0xdde8f5, 0x8a7f70, 1.3)
    scene.add(sky)
    const light = new THREE.DirectionalLight(0xfff0d8, 3.2)
    scene.add(light, light.target)
    const city = cityLayout(groups)
    const { buildings } = city
    const cityBounds = new THREE.Box3(
      new THREE.Vector3(city.bounds.minX, 0, city.bounds.minZ),
      new THREE.Vector3(city.bounds.maxX, CURB + Math.max(1, ...buildings.map(building => building.elevation)), city.bounds.maxZ),
    )
    const citySize = cityBounds.getSize(new THREE.Vector3()).length()
    const center = cityBounds.getCenter(new THREE.Vector3()).setY(0)

    // Light from the front left, so the shadows fall to the right, toward the
    // camera, where they can be seen; the shadow camera covers only the city.
    const decor = cityDecor(city)
    // The shadow camera covers the suburbs too, or their houses would stand
    // shadowless next to towers that cast one.
    const { minX, maxX, minZ, maxZ } = decor.extent
    // It covers the towers and two rings around them; farther out the fog
    // takes over, and a map stretched over the whole suburb would blur.
    const radius = citySize / 2 + city.grid.pitch * 2
    light.position.copy(center).addScaledVector(new THREE.Vector3(-6, 12, 4).normalize(), radius * 2)
    light.target.position.copy(center)
    light.castShadow = true
    light.shadow.mapSize.set(4096, 4096)
    light.shadow.bias = -0.0005
    light.shadow.normalBias = 0.01
    Object.assign(light.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 0.01, far: radius * 4 })
    light.shadow.camera.updateProjectionMatrix()

    // The land runs far past the city — meadows and farmland — and fades
    // into the haze, so the city ends in countryside rather than at the edge
    // of a board. Asphalt is only where there is a road.
    const shadowCatcher = new THREE.ShadowMaterial({ opacity: 0.2, ...groundLayer(4) })
    const landSize = Math.max(maxX - minX, maxZ - minZ, 1) * 6
    const land = new THREE.Mesh(
      tileUv(new THREE.PlaneGeometry(landSize, landSize), landSize, landSize, city.grid.unit * 9),
      new THREE.MeshBasicMaterial({ map: patchwork() }),
    )
    land.material.userData.ground = true
    land.rotation.x = -Math.PI / 2
    land.position.copy(center).setY(LIFT.land)
    const landShadow = new THREE.Mesh(land.geometry.clone(), shadowCatcher)
    landShadow.rotation.copy(land.rotation)
    landShadow.position.copy(center).setY(LIFT.shade)
    landShadow.receiveShadow = true
    scene.add(land, landShadow)
    // Asphalt clearly darker than the sidewalk. Streets one way and the other
    // lie on different depth steps, so their crossings do not flicker.
    const asphaltGrain = speckle(1600, [0.5, 1.3], [0.84, 1], 3)
    const roadSurfaces = ([1, 2] as const).map(step => {
      const material = new THREE.MeshBasicMaterial({ color: mix(backgroundColor, labelColor, 0.2), map: asphaltGrain, ...groundLayer(step) })
      material.userData.ground = true
      return material
    })
    for (const road of decor.roads) {
      const length = road.to - road.from
      const width = city.grid.street
      const surface = new THREE.Mesh(
        tileUv(new THREE.PlaneGeometry(road.along === 'x' ? length : width, road.along === 'x' ? width : length), road.along === 'x' ? length : width, road.along === 'x' ? width : length, city.grid.unit * 0.5),
        roadSurfaces[road.along === 'x' ? 0 : 1],
      )
      surface.rotation.x = -Math.PI / 2
      const middle = (road.from + road.to) / 2
      surface.position.set(road.along === 'x' ? middle : road.at, road.along === 'x' ? LIFT.roadX : LIFT.roadZ, road.along === 'x' ? road.at : middle)
      scene.add(surface)
    }
    const curb = new THREE.MeshBasicMaterial({ color: mix(backgroundColor, labelColor, 0.32) })
    // Sidewalks in square slabs; the financial center in warm paving stones.
    const slabs = pavers(4, 4, '#d6d6d6')
    slabs.repeat.set(city.grid.lotSize / (city.grid.unit * 0.16), city.grid.lotSize / (city.grid.unit * 0.16))
    const sidewalk = new THREE.MeshBasicMaterial({ color: mix(backgroundColor, '#ffffff', 0.5), map: slabs })
    sidewalk.userData.ground = true
    const stones = pavers(4, 8, '#b9b1a4')
    const plaza = new THREE.MeshBasicMaterial({ color: mix(backgroundColor, '#cdbfa6', 0.55), map: stones, ...groundLayer(2) })
    plaza.userData.ground = true
    const plazaInset = city.grid.padding * 0.4
    for (const block of city.blocks) {
      const width = block.width - plazaInset * 2
      const depth = block.depth - plazaInset * 2
      const paving = new THREE.Mesh(tileUv(new THREE.PlaneGeometry(width, depth), width, depth, city.grid.unit * 0.22), plaza)
      paving.rotation.x = -Math.PI / 2
      paving.position.set(block.x + block.width / 2, CURB + LIFT.paving, block.z + block.depth / 2)
      scene.add(paving)
    }
    for (const block of [...city.blocks, ...decor.blocks]) {
      const { width, depth, x, z } = block
      const lot = new THREE.Mesh(new RoundedBoxGeometry(width, CURB, depth, 2, CURB * 0.45), [curb, curb, sidewalk, sidewalk, curb, curb])
      lot.position.set(x + width / 2, CURB / 2, z + depth / 2)
      const lotShadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), shadowCatcher)
      lotShadow.rotation.x = -Math.PI / 2
      lotShadow.position.set(x + width / 2, CURB + LIFT.shade, z + depth / 2)
      lotShadow.receiveShadow = true
      scene.add(lot, lotShadow)
    }
    // Lawns: a ring of sidewalk, grass inside. The neighborhoods, the parks
    // and the commercial blocks have them — shops sit on a paved forecourt
    // over the lawn; the financial center stays paved.
    const lawnInset = city.grid.padding * 0.4
    const grass = speckle(1400, [0.6, 1.8], [0.8, 1], 2)
    const lawns = GRASS_COLORS.map(color => {
      const material = new THREE.MeshBasicMaterial({ color: muted(new THREE.Color(color)), map: grass, ...groundLayer(1) })
      material.userData.ground = true
      return material
    })
    decor.blocks.forEach((block, index) => {
      const width = block.width - lawnInset * 2
      const depth = block.depth - lawnInset * 2
      const lawn = new THREE.Mesh(tileUv(new THREE.PlaneGeometry(width, depth), width, depth, city.grid.unit * 0.35), lawns[index % lawns.length])
      lawn.rotation.x = -Math.PI / 2
      lawn.position.set(block.x + block.width / 2, CURB + LIFT.lawn, block.z + block.depth / 2)
      scene.add(lawn)
    })

    // Scenery: one instanced mesh per kind of piece keeps a city of a few
    // thousand trees, houses and cars at a handful of draw calls.
    const unit = city.grid.unit
    const unitBox = new THREE.BoxGeometry(1, 1, 1)
    const tankGeometry = new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0)
    const lobbyGlass = new THREE.MeshStandardMaterial({ color: muted(new THREE.Color('#3e4a55')), roughness: 0.15, metalness: 0.6, emissive: '#ffd9a0', emissiveIntensity: 0 })
    /** Whatever lights up at night, and how brightly at full dark. */
    const glowing: { material: THREE.MeshStandardMaterial; strength: number }[] = [{ material: lobbyGlass, strength: 0.45 }]
    const trim = new THREE.MeshStandardMaterial({ color: '#d9d5cc', roughness: 0.5, metalness: 0.3 })
    const equipment = new THREE.MeshStandardMaterial({ color: '#a9a8a3', roughness: 0.6, metalness: 0.4 })
    const pose = new THREE.Matrix4()
    const turn = new THREE.Quaternion()
    const upward = new THREE.Vector3(0, 1, 0)
    const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number, shadow: boolean) => {
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1))
      mesh.count = count
      mesh.castShadow = shadow
      scene.add(mesh)
      return mesh
    }
    const put = (mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, angle = 0, sx = 1, sy = sx, sz = sx) => {
      pose.compose(new THREE.Vector3(x, y, z), turn.setFromAxisAngle(upward, angle), new THREE.Vector3(sx, sy, sz))
      mesh.setMatrixAt(index, pose)
    }
    const pick = (palette: string[], tone: number) => muted(new THREE.Color(palette[Math.floor(tone * palette.length) % palette.length]))

    const dashes = instanced(
      new THREE.PlaneGeometry(decor.dashLength, city.grid.street * 0.035).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: mix(backgroundColor, '#ffffff', 0.85), ...groundLayer(3) }),
      decor.dashes.length, false,
    )
    decor.dashes.forEach((dash, index) => put(dashes, index, dash.x, LIFT.marking, dash.z, dash.angle))

    // The coast: the sea out to the horizon, turquoise near the shore and
    // deeper out, with moving ripples and a line of surf; the sand; the
    // promenade in waves of stone.
    const coast = decor.coast
    let ripples: THREE.Texture | null = null
    let surf: THREE.MeshBasicMaterial | null = null
    if (coast) {
      const reach = landSize
      const seaDepth = reach
      const sea = new THREE.PlaneGeometry(reach * 2, seaDepth, 1, 60)
      // Turquoise at the shore, deep blue offshore, and a clearer blue far
      // out. The sea stays out of the haze, so the horizon is blue water
      // against the sky instead of fading to white.
      const shallow = muted(new THREE.Color('#62c2c4'))
      const deep = muted(new THREE.Color('#2d6f93'))
      const open = muted(new THREE.Color('#4f8fb8'))
      const tint: number[] = []
      const positions = sea.attributes.position
      for (let index = 0; index < positions.count; index++) {
        // Plane y runs from the shore (top edge) out to sea.
        const out = seaDepth / 2 - positions.getY(index)
        const color = shallow.clone().lerp(deep, Math.min(1, out / (unit * 5)) ** 0.7)
        tint.push(...color.lerp(open, Math.min(1, Math.max(0, (out - unit * 12) / (unit * 60)))).toArray())
      }
      sea.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3))
      ripples = seaRipples()
      const water = new THREE.Mesh(
        tileUv(sea, reach * 2, seaDepth, unit * 1.6),
        new THREE.MeshStandardMaterial({ vertexColors: true, normalMap: ripples, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.14, metalness: 0.05, fog: false }),
      )
      water.rotation.x = -Math.PI / 2
      water.position.set(center.x, LIFT.sea, coast.shore - seaDepth / 2)
      water.receiveShadow = true
      scene.add(water)
      surf = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false })
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(reach * 2, unit * 0.05), surf)
      foam.rotation.x = -Math.PI / 2
      foam.position.set(center.x, LIFT.sand + 0.001, coast.shore - unit * 0.02)
      scene.add(foam)
      const strip = (from: number, to: number, material: THREE.MeshBasicMaterial, y: number, tile: number) => {
        const depth = to - from
        const mesh = new THREE.Mesh(tileUv(new THREE.PlaneGeometry(reach * 2, depth), reach * 2, depth, tile), material)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(center.x, y, (from + to) / 2)
        material.userData.ground = true
        scene.add(mesh)
      }
      strip(coast.sand[0], coast.sand[1], new THREE.MeshBasicMaterial({ color: muted(new THREE.Color('#ecdcb4')), map: speckle(1200, [0.6, 1.6], [0.86, 1], 5) }), LIFT.sand, unit * 0.4)
      strip(coast.promenade[0], coast.promenade[1], new THREE.MeshBasicMaterial({ color: '#ffffff', map: promenadeWaves() }), LIFT.roadX, unit * 0.34)
    }

    // Beach umbrellas, each a little askew, most with a towel beside it.
    const beachPoles = instanced(new THREE.CylinderGeometry(unit * 0.0025, unit * 0.0025, unit * 0.075, 5).translate(0, unit * 0.0375, 0), trim, decor.umbrellas.length, true)
    const canopies = instanced(new THREE.ConeGeometry(unit * 0.055, unit * 0.022, 12, 1, true).translate(0, unit * 0.075, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), decor.umbrellas.length, true)
    const towels = instanced(new THREE.PlaneGeometry(unit * 0.03, unit * 0.06).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ ...groundLayer(3) }), decor.umbrellas.length, false)
    const lean = new THREE.Quaternion()
    decor.umbrellas.forEach((umbrella, index) => {
      lean.setFromEuler(new THREE.Euler(umbrella.tilt, umbrella.tone * 6, umbrella.tilt * 0.6))
      pose.compose(new THREE.Vector3(umbrella.x, LIFT.sand, umbrella.z), lean, new THREE.Vector3(1, 1, 1))
      beachPoles.setMatrixAt(index, pose)
      canopies.setMatrixAt(index, pose)
      canopies.setColorAt(index, pick(UMBRELLA_COLORS, umbrella.tone))
      if (umbrella.towel == null) put(towels, index, umbrella.x, -1, umbrella.z)
      else {
        put(towels, index, umbrella.x + unit * 0.045, LIFT.sand + 0.0008, umbrella.z + unit * 0.01, umbrella.towel * 0.6)
        towels.setColorAt(index, pick(UMBRELLA_COLORS, umbrella.towel))
      }
    })

    // Kiosks on the sand by the promenade: a hut under a pyramid roof.
    const huts = instanced(new RoundedBoxGeometry(unit * 0.11, unit * 0.06, unit * 0.09, 2, unit * 0.006).translate(0, unit * 0.03, 0), new THREE.MeshStandardMaterial({ color: muted(new THREE.Color('#e9dfc9')), roughness: 0.8 }), decor.kiosks.length, true)
    const thatch = instanced(new THREE.ConeGeometry(unit * 0.1, unit * 0.045, 4).rotateY(Math.PI / 4).translate(0, unit * 0.082, 0), new THREE.MeshStandardMaterial({ color: muted(new THREE.Color('#b08a55')), roughness: 0.95 }), decor.kiosks.length, true)
    decor.kiosks.forEach((kiosk, index) => {
      put(huts, index, kiosk.x, LIFT.sand, kiosk.z)
      put(thatch, index, kiosk.x, LIFT.sand, kiosk.z)
    })

    // Coconut palms: a slim trunk and a crown of drooping fronds.
    const fronds = 7
    const palmBark = speckle(500, [0.8, 2.4], [0.55, 1], 6)
    palmBark.repeat.set(1, 5)
    const palmLeaf = speckle(700, [1, 3], [0.7, 1], 7)
    const trunkHeightPalm = unit * 0.22
    const palmTrunks = instanced(new THREE.CylinderGeometry(unit * 0.006, unit * 0.01, trunkHeightPalm, 6).translate(0, trunkHeightPalm / 2, 0), new THREE.MeshStandardMaterial({ color: '#8a7358', roughness: 0.9, map: palmBark }), decor.palms.length, true)
    const leaves3 = instanced(new THREE.BoxGeometry(unit * 0.1, unit * 0.003, unit * 0.028).translate(unit * 0.05, 0, 0), new THREE.MeshStandardMaterial({ color: muted(new THREE.Color('#5f8f4c')), roughness: 0.8, map: palmLeaf }), decor.palms.length * fronds, true)
    const frond = new THREE.Quaternion()
    decor.palms.forEach((palm, index) => {
      put(palmTrunks, index, palm.x, LIFT.sand, palm.z, 0, palm.scale)
      for (let leaf = 0; leaf < fronds; leaf++) {
        frond.setFromEuler(new THREE.Euler(0, palm.turn + leaf / fronds * Math.PI * 2, -0.45 - (leaf % 2) * 0.15, 'YXZ'))
        pose.compose(new THREE.Vector3(palm.x, LIFT.sand + trunkHeightPalm * palm.scale, palm.z), frond, new THREE.Vector3(palm.scale, palm.scale, palm.scale))
        leaves3.setMatrixAt(index * fronds + leaf, pose)
      }
    })

    // Crop parcels on the farms at the edge of the city.
    const rows = cropRows()
    const cropland = new THREE.MeshBasicMaterial({ map: rows, ...groundLayer(1) })
    cropland.userData.ground = true
    const crops = instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), cropland, decor.fields.length, false)
    decor.fields.forEach((field, index) => {
      const turned = Math.abs(Math.sin(field.angle)) > 0.5
      put(crops, index, field.x, LIFT.crops, field.z, field.angle, turned ? field.depth : field.width, 1, turned ? field.width : field.depth)
      crops.setColorAt(index, pick(FIELD_COLORS, field.tone))
    })
    /** Out on open land things stand on the ground; in the city, on a block. */
    const standAt = (grounded: boolean) => grounded ? 0 : CURB

    // Trees: smooth crowns, round or conical, each with its own size, height
    // and a jittered shade; now and then an ipê in bloom.
    const round = decor.trees.filter(tree => tree.kind === 'round')
    const cones = decor.trees.filter(tree => tree.kind === 'cone')
    const trunkHeight = unit * 0.05
    const bark = speckle(500, [0.8, 2.4], [0.55, 1], 4)
    bark.repeat.set(1, 4)
    const trunks = instanced(
      new THREE.CylinderGeometry(unit * 0.007, unit * 0.01, trunkHeight, 6).translate(0, trunkHeight / 2, 0),
      new THREE.MeshStandardMaterial({ color: '#76593f', roughness: 0.95, map: bark, bumpMap: bark, bumpScale: 2 }),
      decor.trees.length, true,
    )
    decor.trees.forEach((tree, index) => put(trunks, index, tree.x, standAt(tree.grounded), tree.z, 0, tree.scale, tree.scale * tree.stretch, tree.scale))
    // Leaves: a speckle as both color and relief, so a crown reads as a
    // mass of foliage rather than a smooth ball.
    const leaves = speckle(900, [2, 6], [0.6, 1], 1)
    const foliage = new THREE.MeshStandardMaterial({ roughness: 0.85, map: leaves, bumpMap: leaves, bumpScale: 3 })
    const crowns = instanced(new THREE.IcosahedronGeometry(unit * 0.045, 2).translate(0, trunkHeight + unit * 0.03, 0), foliage, round.length, true)
    const conifers = instanced(new THREE.ConeGeometry(unit * 0.04, unit * 0.13, 12).translate(0, trunkHeight + unit * 0.05, 0), foliage, cones.length, true)
    const shade = (tone: number) => {
      const accent = tone > 0.94 ? TREE_BLOSSOMS[Math.floor((tone - 0.94) / 0.06 * TREE_BLOSSOMS.length) % TREE_BLOSSOMS.length] : null
      return muted(new THREE.Color(accent ?? TREE_COLORS[Math.floor(tone / 0.94 * TREE_COLORS.length) % TREE_COLORS.length]))
        .offsetHSL((tone * 7919 % 1 - 0.5) * 0.03, 0, (tone * 104729 % 1 - 0.5) * 0.08)
    }
    for (const [mesh, list] of [[crowns, round], [conifers, cones]] as const) {
      list.forEach((tree, index) => {
        put(mesh, index, tree.x, standAt(tree.grounded), tree.z, tree.tone * 7, tree.scale, tree.scale * tree.stretch, tree.scale)
        mesh.setColorAt(index, shade(tree.tone))
      })
    }

    // Houses: walls with windows and a door facing the street, a gable roof
    // whose ridge runs along it and, on some, a chimney.
    const grounding = groundingTexture()
    const gable = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)])
    const wallGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.05).translate(0, 0.5, 0)
    const plaster = new THREE.MeshStandardMaterial({ roughness: 0.85 })
    const storeys = ([1, 2] as const).map(stories => {
      const list = decor.houses.filter(house => (house.height > unit * 0.13 ? 2 : 1) === stories)
      const grime = grounding.clone()
      grime.repeat.y = stories === 1 ? 2.2 : 3.5
      const glow = { emissive: new THREE.Color('#ffcf87'), emissiveIntensity: 0 }
      const front = new THREE.MeshStandardMaterial({ map: houseFacade('front', stories), aoMap: grime, emissiveMap: houseFacade('front', stories, true), ...glow, roughness: 0.85 })
      const side = new THREE.MeshStandardMaterial({ map: houseFacade('side', stories), aoMap: grime, emissiveMap: houseFacade('side', stories, true), ...glow, roughness: 0.85 })
      glowing.push({ material: front, strength: 0.8 }, { material: side, strength: 0.8 })
      // Box faces: +x, -x, +y, -y, +z (the street), -z.
      return { list, mesh: instanced(wallGeometry, [side, side, plaster, plaster, front, side] as unknown as THREE.Material, list.length, true) }
    })
    const roofs = instanced(
      new THREE.ExtrudeGeometry(gable, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2),
      new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      decor.houses.length, true,
    )
    const withChimney = decor.houses.filter(house => house.chimney != null)
    const chimneys = instanced(
      new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ color: muted(new THREE.Color('#8a5a48')), roughness: 0.9 }),
      withChimney.length, true,
    )
    // Stored footprints are in world axes; the pieces are built facing +z.
    const facing = (house: (typeof decor.houses)[number]) => Math.abs(Math.sin(house.angle)) > 0.5
      ? { along: house.depth, across: house.width } : { along: house.width, across: house.depth }
    for (const { list, mesh } of storeys) list.forEach((house, index) => {
      const { along, across } = facing(house)
      put(mesh, index, house.x, standAt(house.grounded), house.z, house.angle, along, house.height, across)
      mesh.setColorAt(index, pick(HOUSE_WALLS, house.wall))
    })
    decor.houses.forEach((house, index) => {
      const { along, across } = facing(house)
      put(roofs, index, house.x, standAt(house.grounded) + house.height, house.z, house.angle, along * 1.08, house.roof, across * 1.1)
      roofs.setColorAt(index, pick(HOUSE_ROOFS, house.tile))
    })
    withChimney.forEach((house, index) => {
      const { along, across } = facing(house)
      const offset = new THREE.Vector3(house.chimney! * along, 0, -across * 0.22).applyAxisAngle(upward, house.angle)
      put(chimneys, index, house.x + offset.x, standAt(house.grounded) + house.height + house.roof * 0.3, house.z + offset.z, house.angle, unit * 0.028, house.roof * 0.95, unit * 0.028)
    })

    // Street lamps: a slim post and a bulb that ignores the lighting; at
    // night it turns warm and throws a pool of light on the sidewalk.
    const bulb = new THREE.MeshBasicMaterial({ color: '#d8d4c8' })
    const lampGlow = glowTexture()
    const lampLight = new THREE.MeshBasicMaterial({
      color: '#ffcf8a', map: lampGlow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      ...groundLayer(5),
    })
    const postHeight = unit * 0.12
    const posts = instanced(
      new THREE.CylinderGeometry(unit * 0.003, unit * 0.004, postHeight, 6).translate(0, postHeight / 2, 0),
      new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.5, metalness: 0.5 }),
      decor.lamps.length + decor.signals.length, true,
    )
    const bulbs = instanced(
      new THREE.SphereGeometry(unit * 0.009, 10, 8).translate(0, postHeight + unit * 0.004, 0),
      bulb,
      decor.lamps.length, false,
    )
    const pools = instanced(
      new THREE.PlaneGeometry(unit * 0.28, unit * 0.28).rotateX(-Math.PI / 2),
      lampLight,
      decor.lamps.length, false,
    )
    decor.lamps.forEach((lamp, index) => {
      put(pools, index, lamp.x, CURB + LIFT.glow, lamp.z)
      put(posts, index, lamp.x, CURB, lamp.z)
      put(bulbs, index, lamp.x, CURB, lamp.z)
    })

    // Traffic lights: a dark housing with three lamps, one of them lit.
    const housingHeight = unit * 0.05
    const housings = instanced(
      new THREE.BoxGeometry(unit * 0.02, housingHeight, unit * 0.018).translate(0, postHeight * 0.85, 0),
      new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.6 }),
      decor.signals.length, true,
    )
    const signalLamps = instanced(
      new THREE.SphereGeometry(unit * 0.0055, 8, 6),
      new THREE.MeshBasicMaterial(),
      decor.signals.length * 3, false,
    )
    decor.signals.forEach((signal, index) => {
      put(posts, decor.lamps.length + index, signal.x, CURB, signal.z, 0, 1, 0.85)
      put(housings, index, signal.x, CURB, signal.z, signal.angle)
      const face = new THREE.Vector3(0, 0, unit * 0.01).applyAxisAngle(upward, signal.angle)
      for (let light = 0; light < 3; light++) {
        const y = CURB + postHeight * 0.85 + housingHeight * (0.3 - light * 0.3)
        put(signalLamps, index * 3 + light, signal.x + face.x, y, signal.z + face.z)
        signalLamps.setColorAt(index * 3 + light, new THREE.Color(light === signal.state ? SIGNAL_COLORS[light] : '#3a3d40'))
      }
    })

    const bodyHeight = unit * 0.034
    const bodies = instanced(
      new RoundedBoxGeometry(decor.carLength, bodyHeight, unit * 0.064, 2, bodyHeight * 0.3).translate(0, unit * 0.008 + bodyHeight / 2, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }),
      decor.cars.length, false,
    )
    const cabins = instanced(
      new RoundedBoxGeometry(decor.carLength * 0.55, unit * 0.026, unit * 0.056, 2, unit * 0.008).translate(-decor.carLength * 0.08, unit * 0.008 + bodyHeight + unit * 0.013, 0),
      new THREE.MeshStandardMaterial({ color: '#39434d', roughness: 0.3, metalness: 0.3 }),
      decor.cars.length, false,
    )
    decor.cars.forEach((car, index) => {
      put(bodies, index, car.x, 0, car.z, car.angle)
      put(cabins, index, car.x, 0, car.z, car.angle)
      bodies.setColorAt(index, pick(CAR_COLORS, car.tone))
    })

    // Shops and restaurants: storefront to the street, a flat roof with a
    // lip, a colored sign band and an awning over the windows.
    const turned = (angle: number, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(upward, angle)
    const shopFront = new THREE.MeshStandardMaterial({ map: storefront(), emissiveMap: storefront(true), emissive: '#ffe2b0', emissiveIntensity: 0, roughness: 0.6 })
    glowing.push({ material: shopFront, strength: 0.9 })
    const shopSide = new THREE.MeshStandardMaterial({ roughness: 0.85 })
    const shopWalls = instanced(wallGeometry, [shopSide, shopSide, shopSide, shopSide, shopFront, shopSide] as unknown as THREE.Material, decor.shops.length, true)
    // Flat roofs as they are built: a dark membrane inside a parapet in the
    // wall's color, and an AC unit on most — not a bare white lid.
    const shopRoofs = instanced(unitBox, new THREE.MeshStandardMaterial({ color: '#8e908d', roughness: 0.9 }), decor.shops.length, false)
    const parapets = instanced(unitBox, new THREE.MeshStandardMaterial({ roughness: 0.85 }), decor.shops.length * 4, true)
    const coolers = instanced(unitBox, equipment, decor.shops.length, true)
    const signs = instanced(unitBox, new THREE.MeshStandardMaterial({ roughness: 0.5 }), decor.shops.length, false)
    const awnings = instanced(unitBox, new THREE.MeshStandardMaterial({ roughness: 0.8 }), decor.shops.length, true)
    const tilt = new THREE.Quaternion()
    decor.shops.forEach((shop, index) => {
      // Stored footprints are in world axes; a shop is built facing +z.
      const sideways = Math.abs(Math.sin(shop.angle)) > 0.5
      const { height, angle } = shop
      const along = sideways ? shop.depth : shop.width
      const across = sideways ? shop.width : shop.depth
      put(shopWalls, index, shop.x, CURB, shop.z, angle, along, height, across)
      shopWalls.setColorAt(index, pick(SHOP_WALLS, shop.tone))
      put(shopRoofs, index, shop.x, CURB + height + unit * 0.002, shop.z, angle, along * 0.98, unit * 0.004, across * 0.98)
      const lip = unit * 0.01
      const wall = pick(SHOP_WALLS, shop.tone)
      const rims: [number, number, number, number][] = [
        [0, across / 2 - lip / 2, along, lip], [0, -across / 2 + lip / 2, along, lip],
        [along / 2 - lip / 2, 0, lip, across - lip * 2], [-along / 2 + lip / 2, 0, lip, across - lip * 2],
      ]
      rims.forEach(([x, z, sx, sz], side) => {
        const at = turned(angle, x, 0, z)
        put(parapets, index * 4 + side, shop.x + at.x, CURB + height + unit * 0.008, shop.z + at.z, angle, sx, unit * 0.016, sz)
        parapets.setColorAt(index * 4 + side, wall)
      })
      const cooler = turned(angle, along * (((shop.tone * 17) % 1) - 0.5) * 0.5, 0, -across * 0.18)
      put(coolers, index, shop.x + cooler.x, CURB + height + unit * 0.011, shop.z + cooler.z, angle, (shop.tone * 31) % 1 < 0.75 ? unit * 0.05 : 0.0001, unit * 0.022, unit * 0.04)
      const sign = turned(angle, 0, 0, across / 2 + unit * 0.006)
      put(signs, index, shop.x + sign.x, CURB + height * 0.82, shop.z + sign.z, angle, along * 0.7, height * 0.2, unit * 0.012)
      signs.setColorAt(index, pick(AWNING_COLORS, (shop.tone * 13) % 1))
      const awning = turned(angle, 0, 0, across / 2 + unit * 0.024)
      tilt.setFromEuler(new THREE.Euler(0.4, angle, 0, 'YXZ'))
      pose.compose(new THREE.Vector3(shop.x + awning.x, CURB + height * 0.6, shop.z + awning.z), tilt, new THREE.Vector3(along * 0.86, unit * 0.007, unit * 0.055))
      awnings.setMatrixAt(index, pose)
      awnings.setColorAt(index, pick(AWNING_COLORS, shop.restaurant ? (shop.tone * 7) % 0.34 : (shop.tone * 29) % 1))
    })
    const parasolPoles = instanced(new THREE.CylinderGeometry(unit * 0.002, unit * 0.002, unit * 0.05, 5).translate(0, unit * 0.025, 0), trim, decor.parasols.length, false)
    const parasolTops = instanced(new THREE.ConeGeometry(unit * 0.03, unit * 0.014, 16).translate(0, unit * 0.055, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), decor.parasols.length, true)
    decor.parasols.forEach((parasol, index) => {
      put(parasolPoles, index, parasol.x, CURB, parasol.z)
      put(parasolTops, index, parasol.x, CURB, parasol.z)
      parasolTops.setColorAt(index, pick(AWNING_COLORS, parasol.tone))
    })

    // Gas stations: a branded canopy on posts over two pump islands, a
    // convenience store behind and a sign on a tall pole.
    for (const station of decor.stations) {
      const brand = muted(new THREE.Color(STATION_COLORS[Math.floor(station.tone * STATION_COLORS.length)]))
      const brandMaterial = new THREE.MeshStandardMaterial({ color: brand, roughness: 0.5 })
      const group = new THREE.Group()
      group.position.set(station.x, CURB, station.z)
      group.rotation.y = station.angle
      const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
        const piece = new THREE.Mesh(geometry, material)
        piece.position.set(x * unit, y * unit, z * unit)
        piece.scale.set(sx * unit, sy * unit, sz * unit)
        piece.castShadow = piece.receiveShadow = true
        group.add(piece)
      }
      add(unitBox, brandMaterial, -0.08, 0.105, 0.07, 0.3, 0.018, 0.17)
      add(unitBox, trim, -0.08, 0.095, 0.07, 0.29, 0.004, 0.16)
      for (const [x, z] of [[-0.21, 0.0], [0.05, 0.0], [-0.21, 0.14], [0.05, 0.14]]) add(tankGeometry, trim, x, 0, z, 0.006, 0.096, 0.006)
      for (const x of [-0.15, -0.01]) {
        add(unitBox, trim, x, 0.004, 0.07, 0.03, 0.008, 0.09)
        add(unitBox, brandMaterial, x, 0.008, 0.05, 0.018, 0.035, 0.014)
        add(unitBox, brandMaterial, x, 0.008, 0.09, 0.018, 0.035, 0.014)
      }
      add(wallGeometry, shopSide, 0.15, 0, -0.1, 0.17, 0.085, 0.13)
      add(unitBox, brandMaterial, 0.15, 0.085, -0.03, 0.17, 0.016, 0.006)
      add(tankGeometry, trim, 0.22, 0, 0.15, 0.005, 0.2, 0.005)
      add(unitBox, brandMaterial, 0.22, 0.2, 0.15, 0.06, 0.05, 0.008)
      scene.add(group)
    }

    // Parking lots: asphalt, white stall lines, and the parked cars already
    // came in with the rest of the cars.
    const asphalt = new THREE.MeshBasicMaterial({ color: mix(backgroundColor, labelColor, 0.26), ...groundLayer(2) })
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const lots = instanced(flat, asphalt, decor.parking.length, false)
    lots.receiveShadow = false
    decor.parking.forEach((area, index) => put(lots, index, area.x, CURB + LIFT.paving, area.z, 0, area.width, 1, area.depth))
    const stallLines = instanced(flat, new THREE.MeshBasicMaterial({ color: mix(backgroundColor, '#ffffff', 0.85), ...groundLayer(3) }), decor.stalls.length, false)
    decor.stalls.forEach((stall, index) => put(stallLines, index, stall.x, CURB + LIFT.marking, stall.z, 0, unit * 0.006, 1, stall.length))

    // Pools: a pale stone rim and the water inside it.
    const rims = instanced(flat, new THREE.MeshBasicMaterial({ color: mix(backgroundColor, '#ffffff', 0.6), ...groundLayer(2) }), decor.pools.length, false)
    const water = instanced(flat, new THREE.MeshBasicMaterial({ color: muted(new THREE.Color(WATER)), ...groundLayer(3) }), decor.pools.length, false)
    decor.pools.forEach((pool, index) => {
      const rim = unit * 0.012
      put(rims, index, pool.x, CURB + LIFT.paving, pool.z, 0, pool.width + rim * 2, 1, pool.depth + rim * 2)
      put(water, index, pool.x, CURB + LIFT.marking, pool.z, 0, pool.width, 1, pool.depth)
    })

    const forecourts = instanced(flat, new THREE.MeshBasicMaterial({ color: sidewalk.color, ...groundLayer(2) }), decor.forecourts.length, false)
    decor.forecourts.forEach((area, index) => put(forecourts, index, area.x, CURB + LIFT.paving, area.z, 0, area.width, 1, area.depth))

    // Contact shadows under everything that stands on the ground.
    const contact = contactTexture()
    const blobs = instanced(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x000000, map: contact, transparent: true, opacity: 0.32, depthWrite: false,
        ...groundLayer(4),
      }),
      decor.houses.length + decor.trees.length + decor.cars.length + buildings.length + decor.shops.length + decor.stations.length, false,
    )
    let blob = 0
    const spot = (x: number, y: number, z: number, width: number, depth: number, angle = 0) => put(blobs, blob++, x, y + LIFT.shade, z, angle, width, 1, depth)
    for (const house of decor.houses) spot(house.x, standAt(house.grounded), house.z, house.width * 1.3 + unit * 0.05, house.depth * 1.3 + unit * 0.05)
    for (const tree of decor.trees) spot(tree.x, standAt(tree.grounded), tree.z, unit * 0.12 * tree.scale, unit * 0.12 * tree.scale)
    for (const car of decor.cars) spot(car.x, 0, car.z, decor.carLength * 1.3, unit * 0.1, car.angle)
    for (const building of buildings) spot(building.x, CURB, building.z, building.base * 1.25 + unit * 0.08, building.base * 1.25 + unit * 0.08)
    for (const shop of [...decor.shops, ...decor.stations]) spot(shop.x, CURB, shop.z, shop.width * 1.2 + unit * 0.05, shop.depth * 1.2 + unit * 0.05)

    // Traffic: each moving car follows its lane end to end and comes back
    // around. Cars cast no real shadow, so the shadow map can stay still;
    // their contact patch moves with them instead.
    const carBlob = decor.houses.length + decor.trees.length
    const traffic = decor.cars.flatMap((car, index) => car.route ? [{ ...car, index, route: car.route }] : [])
    for (const mesh of [bodies, cabins, blobs]) mesh.frustumCulled = false
    const speed = unit * 0.35
    const drive = (elapsed: number) => {
      for (const car of traffic) {
        const { along, direction, from, to } = car.route
        const span = to - from
        const position = ((along === 'x' ? car.x : car.z) + direction * speed * elapsed / 1000 - from + span) % span + from
        if (along === 'x') car.x = position
        else car.z = position
        put(bodies, car.index, car.x, 0, car.z, car.angle)
        put(cabins, car.index, car.x, 0, car.z, car.angle)
        put(blobs, carBlob + car.index, car.x, LIFT.shade, car.z, car.angle, decor.carLength * 1.3, 1, unit * 0.1)
      }
      for (const mesh of [bodies, cabins, blobs]) mesh.instanceMatrix.needsUpdate = true
    }

    // Everything that rises sits in one group: scaling it vertically raises
    // buildings, roof labels and projections together.
    const lift = new THREE.Group()
    lift.position.y = CURB
    scene.add(lift)
    const font = getComputedStyle(element).fontFamily
    /** A building sign's letters: the name in spaced capitals, white on
     *  clear, to be cut out; a long name shrinks to fit instead of squeezing. */
    const signTexture = (name: string) => {
      const measure = document.createElement('canvas').getContext('2d')
      if (!measure) return null
      const value = name.toUpperCase()
      const size = 160
      measure.font = `600 ${size}px ${font}`
      measure.letterSpacing = `${Math.round(size * 0.16)}px`
      const canvas = document.createElement('canvas')
      canvas.width = Math.min(2048, Math.ceil(measure.measureText(value).width + size * 0.5))
      canvas.height = Math.round(size * 1.3)
      const context = canvas.getContext('2d')
      if (!context) return null
      context.font = measure.font
      context.letterSpacing = measure.letterSpacing
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#ffffff'
      context.fillText(value, canvas.width / 2, canvas.height / 2 + size * 0.04, canvas.width - size * 0.2)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
      return { texture, aspect: canvas.height / canvas.width }
    }
    const tile = facadeTile()
    const gravel = speckle(1400, [0.6, 1.6], [0.84, 1], 12)
    const lights = litWindows()
    tile.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const parts: {
      key: string | number; mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial[]>
      outline: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>
      labels: { material: THREE.MeshStandardMaterial; base: THREE.Color }[]
      facades: { labels: THREE.Mesh[]; height: number }
      windows: THREE.Texture; lit: THREE.Texture; grime: THREE.Texture; crown: THREE.Group; tint: THREE.Color; dimmed: THREE.Color
    }[] = []
    const projectedBodies: {
      part: (typeof parts)[number]; elevation: number; projectedHeight: number; changeHeight: number
      ghost: THREE.Mesh; contour: THREE.LineSegments
    }[] = []
    for (const building of buildings) {
      const { elevation, base } = building
      const windows = tile.clone()
      // One tile is eight floors by eight windows; each building starts at
      // a different window of it, as its lights do.
      windows.repeat.set(Math.max(1, Math.round(base / FLOOR)) / 8, elevation / FLOOR / 8)
      windows.offset.set((parts.length * 3 % 8) / 8, (parts.length * 5 % 8) / 8)
      const tint = muted(new THREE.Color(building.leaf.tint))
      const grime = grounding.clone()
      grime.repeat.y = elevation / GRIME_HEIGHT
      const lit = lights.clone()
      lit.repeat.copy(windows.repeat)
      lit.offset.set((parts.length * 3 % 8) / 8, (parts.length * 5 % 8) / 8)
      const facade = new THREE.MeshStandardMaterial({
        color: tint, map: windows, roughnessMap: windows, aoMap: grime, roughness: 0.75, metalness: 0.12,
        emissive: '#ffd08a', emissiveMap: lit, emissiveIntensity: 0,
      })
      glowing.push({ material: facade, strength: 1.1 })
      const roofGrain = gravel.clone()
      roofGrain.repeat.set(base / (unit * 0.3), base / (unit * 0.3))
      const roof = new THREE.MeshStandardMaterial({ color: tint, map: roofGrain, roughness: 0.85, metalness: 0.05 })
      // Slightly rounded edges catch the light, which is most of what makes a
      // box read as a building on a model rather than a raw polygon.
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(base, elevation, base, 2, Math.min(base * 0.035, elevation * 0.2)), [facade, facade, roof, roof, facade, facade])
      mesh.position.set(building.x, elevation / 2, building.z)
      mesh.userData = building
      mesh.castShadow = true
      mesh.receiveShadow = true
      lift.add(mesh)
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(base, elevation, base)),
        new THREE.LineBasicMaterial({ color: labelColor, transparent: true, opacity: 0.25 }),
      )
      outline.position.copy(mesh.position)
      lift.add(outline)
      // Street level: a dark glass lobby slightly proud of the facade and a
      // canopy over the entrance.
      const lobbyHeight = Math.min(unit * 0.07, elevation * 0.18)
      const lobby = new THREE.Mesh(new RoundedBoxGeometry(base * 1.012, lobbyHeight, base * 1.012, 2, Math.min(base * 0.035, lobbyHeight * 0.2)), lobbyGlass)
      lobby.position.set(building.x, lobbyHeight / 2, building.z)
      const canopy = new THREE.Mesh(unitBox, trim)
      canopy.scale.set(base * 0.45, unit * 0.006, unit * 0.05)
      canopy.position.set(building.x, lobbyHeight * 0.85, building.z + base / 2 + unit * 0.025)
      // The roof: a parapet, and on the back strip — clear of the label —
      // a water tank and AC units; the largest tower also gets an antenna.
      const crown = new THREE.Group()
      crown.position.set(building.x, elevation, building.z)
      const lip = base * 0.025
      const lipHeight = unit * 0.014
      for (const [sx, sz, px, pz] of [[base, lip, 0, base / 2 - lip / 2], [base, lip, 0, -base / 2 + lip / 2], [lip, base - lip * 2, base / 2 - lip / 2, 0], [lip, base - lip * 2, -base / 2 + lip / 2, 0]]) {
        const wall = new THREE.Mesh(unitBox, roof)
        wall.scale.set(sx, lipHeight, sz)
        wall.position.set(px, lipHeight / 2, pz)
        crown.add(wall)
      }
      if (base > unit * 0.3) {
        const strip = -base * 0.37
        const tank = new THREE.Mesh(tankGeometry, equipment)
        tank.scale.set(base * 0.06, unit * 0.05, base * 0.06)
        tank.position.set(base * 0.3, 0, strip)
        crown.add(tank)
        for (const offset of [-0.22, -0.02]) {
          const unitAc = new THREE.Mesh(unitBox, equipment)
          unitAc.scale.set(base * 0.11, unit * 0.022, base * 0.08)
          unitAc.position.set(base * offset, unit * 0.011, strip)
          crown.add(unitAc)
        }
      }
      if (building === buildings[0]) {
        const antenna = new THREE.Mesh(tankGeometry, trim)
        antenna.scale.set(unit * 0.006, elevation * 0.14, unit * 0.006)
        antenna.position.set(-base * 0.36, 0, -base * 0.37)
        crown.add(antenna)
      }
      for (const piece of [lobby, canopy, ...crown.children]) { piece.castShadow = true; piece.receiveShadow = true }
      lift.add(lobby, canopy, crown)
      const part: (typeof parts)[number] = { key: building.leaf.key, mesh, outline, windows, lit, grime, crown, tint, dimmed: mix(tint, backgroundColor, 0.65), labels: [], facades: { labels: [], height: 0 } }
      parts.push(part)
      const projected = building.leaf.projectedValue
      if (projected != null && Number.isFinite(projected) && projected >= 0) {
        const projectedHeight = elevation * projected / building.leaf.value
        const changeHeight = Math.abs(projectedHeight - elevation)
        if (Number.isFinite(projectedHeight) && changeHeight > 0) {
          // Only the change is translucent, in one neutral for every building; opaque
          // enough that the roof below does not tint it. Its edges respect depth.
          const ghost = new THREE.Mesh(
            new THREE.BoxGeometry(base, changeHeight, base),
            new THREE.MeshBasicMaterial({ color: '#9a9a9a', transparent: true, opacity: 0.55, depthWrite: false }),
          )
          const contour = new THREE.LineSegments(
            new THREE.EdgesGeometry(ghost.geometry),
            new THREE.LineBasicMaterial({ color: labelColor, transparent: true, opacity: 0.65, depthWrite: false }),
          )
          contour.renderOrder = 1
          ghost.position.x = contour.position.x = building.x
          ghost.position.z = contour.position.z = building.z
          lift.add(ghost, contour)
          projectedBodies.push({ part, elevation, projectedHeight, changeHeight, ghost, contour })
        }
      }
      // The asset's name is the building's own sign, as a company's name is
      // on its tower: metal letters standing off each facade near the top.
      // Their depth is a stack of cut-out layers — light metal in front,
      // darker behind — which reads as solid letters from an angle. Nothing
      // on the roof and no value: that is what clicking is for.
      // The front carries a thin dark outline; the layers behind are the
      // same metal without it, so the letters read as one solid color.
      // Brushed brass: champagne letters with a darker bronze depth, read
      // on light and dark facades alike without a hard black-and-white rim.
      const sign = signTexture(building.leaf.label)
      if (!sign) continue
      const face = new THREE.MeshStandardMaterial({
        map: sign.texture, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide,
        color: '#cfb27a', metalness: 0.65, roughness: 0.38,
        emissive: '#ffe2ad', emissiveMap: sign.texture, emissiveIntensity: 0,
      })
      const edge = new THREE.MeshStandardMaterial({ map: sign.texture, alphaTest: 0.4, side: THREE.DoubleSide, color: '#8a6d44', metalness: 0.6, roughness: 0.5 })
      glowing.push({ material: face, strength: 0.7 })
      part.labels = [{ material: face, base: face.color.clone() }, { material: edge, base: edge.color.clone() }]
      // Sized by the name: a short ticker gets tall letters, a long name
      // fits the facade's width.
      let signHeight = Math.min(base * 0.3, elevation * 0.24)
      let signWidth = signHeight / sign.aspect
      if (signWidth > base * 0.92) {
        signWidth = base * 0.92
        signHeight = signWidth * sign.aspect
      }
      const facadeHeight = signHeight
      const letters = new THREE.PlaneGeometry(signWidth, signHeight)
      const depth = unit * 0.022
      const layers = 10
      for (const [dx, dz, angle] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) {
        for (let layer = 0; layer < layers; layer++) {
          const standoff = base / 2 + unit * 0.002 + depth * layer / (layers - 1)
          const text = new THREE.Mesh(letters, layer === layers - 1 ? face : edge)
          text.rotation.y = angle
          text.position.set(building.x + dx * standoff, 0, building.z + dz * standoff)
          lift.add(text)
          part.facades.labels.push(text)
        }
      }
      part.facades.height = facadeHeight
      placeFacades(part, elevation)
    }
    const meshes = parts.map(part => part.mesh)
    function placeFacades(part: (typeof parts)[number], top: number) {
      const y = top - part.facades.height / 2 - Math.min(0.03, top * 0.1)
      for (const label of part.facades.labels) label.position.y = y
    }

    // A selection dims the rest of the city instead of only tinting itself,
    // which was hard to tell apart among buildings of the same color.
    highlightRef.current = key => {
      const focused = parts.some(part => part.key === key)
      for (const part of parts) {
        const selected = focused && part.key === key
        const dimmed = focused && !selected
        for (const material of part.mesh.material) {
          material.color.copy(dimmed ? part.dimmed : part.tint)
          // The facade's emissive is its lit windows at night; leave it alone.
          if (!material.emissiveMap) material.emissive.setHex(selected ? 0x222222 : 0)
        }
        part.outline.material.opacity = selected ? 0.9 : dimmed ? 0.1 : 0.25
        for (const label of part.labels) label.material.color.copy(dimmed ? mix(label.base, backgroundColor, 0.6) : label.base)
      }
    }
    highlightRef.current(selectedRef.current)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let rise = reduceMotion ? 1 : 0
    let projectionProgress = projectionVisible.current ? 1 : 0
    const applyMotion = () => {
      renderer.shadowMap.needsUpdate = true
      lift.scale.y = Math.max(0.001, easeOut(rise))
      const progress = smooth(projectionProgress)
      for (const body of projectedBodies) {
        // For a negative CAGR the lost portion is the translucent cap; the
        // remaining projected value stays opaque. Disabling restores today.
        const animated = body.elevation + (body.projectedHeight - body.elevation) * progress
        const top = Math.min(body.elevation, animated)
        const { mesh, outline, windows } = body.part
        mesh.scale.y = outline.scale.y = top / body.elevation
        mesh.position.y = outline.position.y = top / 2
        windows.repeat.y = top / FLOOR / 8
        body.part.lit.repeat.y = top / FLOOR / 8
        body.part.grime.repeat.y = top / GRIME_HEIGHT
        body.part.crown.position.y = top
        placeFacades(body.part, top)
        const change = Math.abs(animated - body.elevation)
        body.ghost.visible = body.contour.visible = change > 1e-6
        body.ghost.scale.y = body.contour.scale.y = Math.max(change / body.changeHeight, 1e-6)
        body.ghost.position.y = body.contour.position.y = top + change / 2
      }
    }
    applyMotion()
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite)) return
      for (const material of [object.material].flat() as THREE.Material[])
        if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.LineBasicMaterial || material instanceof THREE.SpriteMaterial) material.toneMapped = false
    })
    const render = () => renderer.render(scene, camera)
    renderRef.current = render
    let frameId = 0
    let last = 0
    // The loop runs while something moves: buildings rising, a projection
    // changing, or the traffic — which stops when the city scrolls out of view.
    let onScreen = true
    const driving = () => traffic.length > 0 && !reduceMotion && onScreen
    const tick = (now: number) => {
      const elapsed = Math.min(last ? now - last : 16, 100)
      last = now
      const target = projectionVisible.current ? 1 : 0
      const moving = rise < 1 || projectionProgress !== target
      if (moving) {
        rise = Math.min(1, rise + elapsed / RISE_MS)
        const step = elapsed / PROJECTION_MS
        projectionProgress = target > projectionProgress ? Math.min(target, projectionProgress + step) : Math.max(target, projectionProgress - step)
        applyMotion()
      }
      if (driving()) {
        drive(elapsed)
        if (ripples) ripples.offset.set(now * 0.000012, now * 0.000007)
        if (surf) surf.opacity = 0.55 + 0.25 * Math.sin(now / 900)
      }
      render()
      if (moving || driving()) frameId = requestAnimationFrame(tick)
      else { frameId = 0; last = 0 }
    }
    const animate = () => {
      if (reduceMotion) {
        projectionProgress = projectionVisible.current ? 1 : 0
        applyMotion()
        render()
      } else if (!frameId) frameId = requestAnimationFrame(tick)
    }
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      if (onScreen) animate()
    })
    visibility.observe(element)
    animateRef.current = animate

    const corners = (bounds: THREE.Box3) => {
      const points: THREE.Vector3[] = []
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z))
      return points
    }
    // Frame what is drawn, not the bounding box: its empty top corners above
    // the short buildings pushed the city to the bottom of the view.
    const contentPoints = [
      ...buildings.flatMap(({ x, z, base, elevation }) => corners(new THREE.Box3(
        new THREE.Vector3(x - base / 2, CURB, z - base / 2), new THREE.Vector3(x + base / 2, CURB + elevation, z + base / 2)))),
      ...city.blocks.flatMap(({ x, z, width, depth }) => corners(new THREE.Box3(
        new THREE.Vector3(x, 0, z), new THREE.Vector3(x + width, CURB, z + depth)))),
    ]
    // Fit only on initial load; navigation remains unrestricted.
    const fitDistance = (points: THREE.Vector3[]) => {
      camera.updateMatrixWorld()
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
      const back = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2)
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      let distance = 0.1
      for (const point of points) {
        const relative = point.clone().sub(controls.target)
        const vertical = Math.abs(relative.dot(up)) / tangent
        const lateral = Math.abs(relative.dot(right)) / (tangent * camera.aspect)
        distance = Math.max(distance, relative.dot(back) + Math.max(vertical, lateral) * 1.08)
      }
      return distance
    }
    const frame = () => {
      cityBounds.getCenter(controls.target)
      const direction = new THREE.Vector3(0.65, 0.65, 1).normalize()
      const place = () => {
        camera.position.copy(controls.target).add(direction)
        camera.lookAt(controls.target)
        const distance = fitDistance(contentPoints) * 1.02
        camera.position.copy(controls.target).addScaledVector(direction, distance)
        camera.updateMatrixWorld()
        return distance
      }
      camera.near = 0.05
      camera.updateProjectionMatrix()
      let distance = place()
      // Perspective makes the drawn city lopsided around the box center, so
      // recenter the target on its projected extent and fit again.
      for (let pass = 0; pass < 2; pass++) {
        const projected = new THREE.Box2()
        for (const point of contentPoints) {
          const ndc = point.clone().project(camera)
          projected.expandByPoint(new THREE.Vector2(ndc.x, ndc.y))
        }
        const offset = projected.getCenter(new THREE.Vector2())
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
        controls.target
          .addScaledVector(right, offset.x * tangent * camera.aspect * distance)
          .addScaledVector(up, offset.y * tangent * distance)
        distance = place()
      }
      // Rolling hills on the horizon, far enough that zooming out never
      // reaches them, and a sky that meets the ground in the page's color.
      const horizon = distance * 3.4
      controls.maxDistance = Math.min(Math.max(citySize * 8, distance * 3), horizon * 0.7)
      landscape(horizon)
      // The far side of the city already fades a little; zooming out fades it
      // into the page, and the street's edge is never seen.
      scene.fog = new THREE.Fog(haze, distance, distance + citySize * 3)
      camera.far = horizon * 3
      // Depth precision follows far / near. With a near plane of 0.001 that
      // ratio was ~100,000 and coplanar surfaces — signs on facades, lawns on
      // blocks, shadows on the ground — flickered as the camera moved.
      camera.near = Math.max(0.05, distance * 0.005)
      camera.updateProjectionMatrix()
      controls.update()
      animate()
      render()
    }
    // The sky and the hills are painted by the time of day: `paintLandscape`
    // recolors them whenever the hour moves on.
    let paintLandscape = () => {}
    const landscape = (horizon: number) => {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(horizon * 1.6, 32, 16),
        new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }),
      )
      const domePositions = dome.geometry.attributes.position
      const heights = Array.from({ length: domePositions.count }, (_, index) =>
        Math.max(0, domePositions.getY(index) / (horizon * 1.6)) ** 0.55)
      // How much each point of the sky lies over the sea, which is at -z.
      const overSea = Array.from({ length: domePositions.count }, (_, index) => decor.coast
        ? smoothstep(0.1, 0.7, -domePositions.getZ(index) / Math.hypot(domePositions.getX(index), domePositions.getZ(index)) || 0) : 0)
      dome.geometry.setAttribute('color', new THREE.Float32BufferAttribute(heights.length * 3, 3))
      dome.position.copy(center)
      dome.renderOrder = -1
      scene.add(dome)
      // Two ridges: the far one bluer and lighter, as distance does.
      const ridges = ([[1, 0.1, '#8fa4b8', 0.7], [0.82, 0.065, '#879c80', 2.3]] as const).map(([radius, peak, tint, phase]) => {
        const segments = 240
        const positions: number[] = []
        const waves: number[] = []
        const indices: number[] = []
        for (let index = 0; index <= segments; index++) {
          const angle = index / segments * Math.PI * 2
          const wave = (Math.sin(angle * 3 + phase) + Math.sin(angle * 7 + phase * 2) * 0.5 + Math.sin(angle * 13 + phase * 3) * 0.25 + 1.75) / 3.5
          const x = center.x + Math.cos(angle) * horizon * radius
          const z = center.z + Math.sin(angle) * horizon * radius
          // No hills over the sea: the horizon there is the water's.
          const seaward = decor.coast ? -Math.sin(angle) : -1
          const rise = 1 - smoothstep(0.05, 0.5, seaward)
          positions.push(x, -horizon * 0.02, z, x, rise > 0.02 ? horizon * peak * (0.3 + 0.7 * wave) * rise : -horizon * 0.02, z)
          waves.push(wave)
          if (index < segments) indices.push(index * 2, index * 2 + 1, index * 2 + 2, index * 2 + 1, index * 2 + 3, index * 2 + 2)
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(positions.length, 3))
        geometry.setIndex(indices)
        scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, toneMapped: false })))
        return { geometry, waves, tint }
      })
      paintLandscape = () => {
        const colors = dome.geometry.attributes.color
        heights.forEach((height, index) => colors.setXYZ(index, ...haze.clone().lerp(seaSky, overSea[index] * 0.75).lerp(zenith, height).toArray() as [number, number, number]))
        colors.needsUpdate = true
        for (const ridge of ridges) {
          const top = mix(haze, ridge.tint, 0.55)
          const ridgeColors = ridge.geometry.attributes.color
          ridge.waves.forEach((wave, index) => {
            ridgeColors.setXYZ(index * 2, haze.r, haze.g, haze.b)
            ridgeColors.setXYZ(index * 2 + 1, ...haze.clone().lerp(top, 0.55 + 0.45 * wave).toArray() as [number, number, number])
          })
          ridgeColors.needsUpdate = true
        }
      }
      paintLandscape()
    }

    // Time of day, from the clock, checked every minute. In development,
    // `?hora=21` pins the hour, so night can be seen without waiting for it.
    const haze = new THREE.Color(backgroundColor)
    const zenith = mix(backgroundColor, '#9fc2e0', 0.6)
    /** The sky low over the sea: blue by day, where the haze is white. */
    const seaSky = mix(backgroundColor, '#8fbbdc', 0.7)
    const pinned = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get('hora') ?? NaN) : NaN
    const ground: { material: THREE.MeshBasicMaterial; base: THREE.Color }[] = []
    const excluded = new Set<THREE.Material>([bulb, lampLight, signalLamps.material as THREE.Material])
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      for (const material of [object.material].flat() as THREE.Material[])
        if (material instanceof THREE.MeshBasicMaterial && (material.userData.ground || !material.map) && !material.vertexColors && !excluded.has(material) && !ground.some(item => item.material === material))
          ground.push({ material, base: material.color.clone() })
    })
    const moon = new THREE.Vector3(-0.4, 0.8, 0.45).normalize()
    const applyTime = () => {
      const now = new Date()
      if (Number.isFinite(pinned)) now.setHours(pinned, 0)
      const { night, golden, sun } = daylight(now)
      const blend = (day: THREE.ColorRepresentation, dusk: THREE.ColorRepresentation, dark: THREE.ColorRepresentation) =>
        new THREE.Color(day).lerp(new THREE.Color(dusk), golden).lerp(new THREE.Color(dark), night)
      const amount = (day: number, dusk: number, dark: number) => {
        const lit = day + (dusk - day) * golden
        return lit + (dark - lit) * night
      }
      light.color.copy(blend('#fff0d8', '#ffb56b', '#a9bbe6'))
      light.intensity = amount(3.2, 2.2, 0.55)
      light.position.copy(center).addScaledVector(night > 0.5 ? moon : sun, radius * 2)
      sky.color.copy(blend('#dde8f5', '#f3d6be', '#3a4866'))
      sky.groundColor.copy(blend('#8a7f70', '#7a6656', '#1c1f26'))
      sky.intensity = amount(1.3, 1.05, 0.45)
      scene.environmentIntensity = amount(0.35, 0.28, 0.1)
      haze.copy(blend(backgroundColor, mix(backgroundColor, '#f2c7a0', 0.55), '#1a2231'))
      zenith.copy(blend(mix(backgroundColor, '#9fc2e0', 0.6), '#b9b3d6', '#0b1120'))
      seaSky.copy(blend(mix(backgroundColor, '#8fbbdc', 0.7), '#d9b3a2', '#132038'))
      renderer.setClearColor(haze)
      if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(haze)
      paintLandscape()
      const tint = blend('#ffffff', '#ffe2c4', '#56627c')
      for (const item of ground) item.material.color.copy(item.base).multiply(tint)
      shadowCatcher.opacity = amount(0.2, 0.2, 0.1)
      for (const item of glowing) item.material.emissiveIntensity = item.strength * night
      bulb.color.copy(new THREE.Color('#d8d4c8').lerp(new THREE.Color('#ffe7a8'), night))
      lampLight.opacity = 0.55 * night
      renderer.shadowMap.needsUpdate = true
      render()
    }
    applyTime()
    const clock = window.setInterval(applyTime, 60_000)
    let initialized = false
    const observer = new ResizeObserver(() => {
      const { width, height: measuredHeight } = element.getBoundingClientRect()
      if (!width || !measuredHeight) return
      camera.aspect = width / measuredHeight
      camera.updateProjectionMatrix()
      renderer.setSize(width, measuredHeight)
      if (!initialized) { initialized = true; frame() }
      else render()
    })
    observer.observe(element)
    controls.addEventListener('change', render)
    const raycaster = new THREE.Raycaster()
    let start = { x: 0, y: 0 }
    const down = (event: PointerEvent) => { start = { x: event.clientX, y: event.clientY } }
    const up = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return
      const rect = renderer.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1,
      ), camera)
      const hit = raycaster.intersectObjects(meshes)[0]?.object
      setSelectedKey(hit ? hit.userData.leaf.key : null)
    }
    const lost = (event: Event) => { event.preventDefault(); setUnavailable(true) }
    renderer.domElement.addEventListener('pointerdown', down)
    renderer.domElement.addEventListener('pointerup', up)
    renderer.domElement.addEventListener('webglcontextlost', lost)
    return () => {
      observer.disconnect()
      visibility.disconnect()
      window.clearInterval(clock)
      controls.removeEventListener('change', render)
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', down)
      renderer.domElement.removeEventListener('pointerup', up)
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      cancelAnimationFrame(frameId)
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite)) return
        if (!(object instanceof THREE.Sprite)) object.geometry.dispose()
        for (const material of [object.material].flat() as THREE.Material[]) {
          if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose()
          material.dispose()
        }
      })
      tile.dispose()
      gravel.dispose()
      lights.dispose()
      lampGlow.dispose()
      grounding.dispose()
      contact.dispose()
      environment.dispose()
      animateRef.current = () => {}
      highlightRef.current = () => {}
      renderRef.current = () => {}
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [groups, backgroundColor, labelColor, unavailable])

  if (unavailable) return <AppStack gap="sm">
    <AppText tone="secondary">3D indisponível neste navegador. Exibindo o mapa 2D.</AppText>
    <AppTreemap {...props} />
  </AppStack>

  const current = groups.flatMap(group => group.items).find(leaf => leaf.key === selectedKey) ?? null
  const floating = { bgcolor: (theme: Theme) => alpha(theme.palette.background.paper, 0.86), backdropFilter: 'blur(10px)', boxShadow: 3 }
  return <Box sx={immersive
    ? { position: 'fixed', inset: 0, zIndex: 'modal', bgcolor: 'background.default' }
    : { display: 'flex', alignItems: 'flex-start', gap: space.md, flexDirection: { xs: 'column', md: 'row' } }}>
    <Box sx={{ flex: 1, minWidth: 0, width: '100%', height: immersive ? '100%' : undefined, position: 'relative' }}>
      <Box ref={host} sx={{
        height: immersive ? '100%' : height, width: '100%', position: 'relative', overflow: 'hidden',
        borderRadius: immersive ? 0 : (theme: Theme) => `${theme.radius.md}px`, '& canvas': { display: 'block', touchAction: 'none' },
      }} />
      <Box sx={{ position: 'absolute', top: space.sm, left: space.sm, borderRadius: (theme: Theme) => `${theme.radius.md}px`, ...floating }}>
        <AppIconButton label={immersive ? 'Sair da tela cheia' : 'Tela cheia'} tooltip onClick={toggleImmersive}>
          {immersive ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </AppIconButton>
      </Box>
      {!groups.some(group => group.items.some(item => item.value > 0)) && <AppText tone="secondary">Nenhuma posição com valor positivo para exibir.</AppText>}
    </Box>
    {renderSidebar && <Box component="aside" aria-label="Detalhes e projeção da distribuição" sx={immersive ? {
      position: 'absolute', top: space.md, right: space.md, width: { xs: `calc(100% - ${space.md * 16}px)`, sm: 300 },
      maxHeight: `calc(100% - ${space.md * 16}px)`, overflowY: 'auto', p: space.md,
      borderRadius: (theme: Theme) => `${theme.radius.md}px`, ...floating,
    } : {
      width: { xs: '100%', md: 300 }, flexShrink: 0, position: { md: 'sticky' }, top: space.md,
      maxHeight: { md: 'calc(100dvh - 48px)' }, overflowY: 'auto', p: space.md,
      bgcolor: 'background.paper', borderRadius: (theme: Theme) => `${theme.radius.md}px`,
    }}>{renderSidebar(current)}</Box>}
  </Box>
}
