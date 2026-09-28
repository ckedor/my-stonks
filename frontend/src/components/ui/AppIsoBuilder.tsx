import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import UpgradeIcon from '@mui/icons-material/Upgrade'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import HighlightAltIcon from '@mui/icons-material/HighlightAlt'
import NearMeIcon from '@mui/icons-material/NearMe'
import OpenWithIcon from '@mui/icons-material/OpenWith'
import Rotate90DegreesCcwIcon from '@mui/icons-material/Rotate90DegreesCcw'
import Rotate90DegreesCwIcon from '@mui/icons-material/Rotate90DegreesCw'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import { Box, ButtonBase } from '@mui/material'
import { type Theme } from '@mui/material/styles'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import AppIconButton from './AppIconButton'
import AppText from './AppText'
import { HALF_H, HALF_W, mulberry, renderSprite, type Pt, type Recipe, type Sprite } from './iso/engine'
import { spriteImageRevision, subscribeSpriteImages } from './iso/sprite-images'
import { ISO_RECIPES, type IsoRecipeKey } from './iso/recipes'
import { beachPainter, type BeachPainter } from './iso/beach'
import { terrainAvailability, terrainPath, type IsoTerrain } from './iso/terrain'
import { isoPieceMeasure } from './iso/volume'
import { space } from '@/theme/tokens'

/* A board of isometric tiles where pieces from a catalog are placed,
 * moved, turned and removed — the building mode of a city game, drawn in
 * the flat, outlined style of an illustrated map.
 *
 * Each piece is drawn once into a sprite per quarter turn and kept. The
 * board pastes only the sprites in view, in an order worked out when the
 * city changes, and only when something changed — so a board of tens of
 * thousands of tiles costs what the screen shows, not what the map holds.
 *
 * The placements are the caller's: it hands them in and hears what the
 * player did. Whether a spot is free is checked here, because the footprint
 * has to turn red before the click. */

export type IsoRotation = 0 | 1 | 2 | 3

export interface IsoBuilderItem {
  id: string
  label: string
  /** The shop tab the item sits under. */
  group: string
  /** Second-level shop category, such as the size of residential pieces.
   *  Every tab has them, so the shop keeps its height from tab to tab. */
  subgroup: string
  /** A drawing from the catalogue of recipes, or one generated for this
   *  item — then the item's id must say everything the drawing depends on,
   *  since sprites are kept by id. */
  recipe: IsoRecipeKey | Recipe
  /** Visual identity when a saved id resolves to a newer drawing. */
  appearanceKey?: string
  /** Lies on the ground — a road, a lawn — and is drawn under everything. */
  flat?: boolean
  /** Laid by dragging a line, piece after piece: a road, an avenue. */
  drag?: boolean
  /** Drawn where it is placed, but not offered in the shop. */
  hidden?: boolean
  /** What building one costs, against `budget`. Absent or 0 is free. */
  price?: number
  /** At most one piece on the board carries each key: the building of an
   *  asset, whatever its size. Such pieces are not copied. */
  unique?: string
  /** Same-footprint appearances; changing one does not buy another piece. */
  variants?: { label: string; selected: string; options: { id: string; label: string }[] }
}

export interface IsoBuilderPlacement {
  id: string
  item: string
  /** The footprint's corner cell with the lowest x and y. */
  x: number
  y: number
  rotation: IsoRotation
}

type StatusTone = 'default' | 'danger' | 'success'

/** A figure the game keeps in view on the map: a headline and its parts. */
export interface IsoBuilderStatus {
  label: string
  value: string
  tone?: StatusTone
  rows: { label: string; value: string; tone?: StatusTone }[]
  /** A line under the rows, for what the figures mean. */
  note?: string
}

/** Where a piece goes: its id and its new spot. */
export type IsoBuilderMove = Omit<IsoBuilderPlacement, 'item'>

export interface AppIsoBuilderProps {
  items: IsoBuilderItem[]
  placements: IsoBuilderPlacement[]
  /** Tiles on each side of the board. */
  size: number
  height: number | string
  /** The ground runs past the screen and the camera stops before the edge,
   *  so the board never shows as a square: a map, not a tray. */
  boundless?: boolean
  /** Permanent land polygons, independent of removable pieces. */
  terrain?: IsoTerrain
  /** Every piece built together, in one change. */
  onPlace: (pieces: Omit<IsoBuilderPlacement, 'id'>[]) => void
  /** Every piece moved together, in one change. */
  onMove: (moves: IsoBuilderMove[]) => void
  /** Every piece removed together, in one change. */
  onRemove: (ids: string[]) => void
  onReplace?: (id: string, item: string) => void
  /** What a placed piece can become, if anything: the item and a short
   *  label for the button. Growing is never automatic — the player asks. */
  upgradeOf?: (placement: IsoBuilderPlacement) => { item: string; label: string } | null
  /** The player took the upgrade: the piece leaves the board and its
   *  successor waits in `pending` until it is put down, wherever the
   *  player chooses. */
  onUpgrade?: (id: string, item: string) => void
  /** Items waiting to be put down. They head the shop, and leaving the
   *  hand does not lose them. */
  pending?: string[]
  /** A waiting item was put down. */
  onPlacePending?: (piece: Omit<IsoBuilderPlacement, 'id'>) => void
  /** What the player can still spend. Without it, everything is free. A
   *  piece that costs more is refused; free pieces are never refused. */
  budget?: number
  /** How a price reads on a shop card. */
  priceLabel?: (price: number) => string
  /** Placed pieces to flag on the board — ones that can be upgraded. */
  marked?: ReadonlySet<string>
  /** Kept on the map, under the toolbar, in a panel that folds away. */
  status?: IsoBuilderStatus
}

/** The shop tab of the items waiting to be put down. */
const PENDING = 'A colocar'

type Tool =
  | { kind: 'select' }
  /** A drag marks a rectangle of tiles; the pieces it touches are selected. */
  | { kind: 'area' }
  | { kind: 'demolish' }
  /** `pending` when the item is one waiting to be put down: it goes down
   *  once, and the hand is empty again. */
  | { kind: 'place'; item: string; rotation: IsoRotation; pending?: boolean }
  | { kind: 'move'; id: string; item: string; rotation: IsoRotation }
  /** A copied group in hand, placed again at every click. */
  | { kind: 'paste'; pieces: Clip[] }

/** A copied piece, placed relative to the corner of its group. */
interface Clip { item: string; x: number; y: number; rotation: IsoRotation }

/** Device pixels per screen pixel in the sprites: sharp up to 2× zoom on
 *  an ordinary screen, or 1× on a dense one. */
const SPRITE_SCALE = 2
const MAX_ZOOM = 2.4
const NONE: ReadonlySet<string> = new Set()
const NO_ITEMS: string[] = []
const PAPER = '#bdb6ab'
const GROUND = '#d3cdc2'

/* The panels belong to the map, not to the app around it: printed paper
 * with a grain, an ink outline and a hard offset shadow, the same in both
 * themes, like the legend of an illustrated map. */
const INK = '#2a2024'
/** Figures on the map's paper: ink, and the two signs a balance can take. */
const TONE: Record<StatusTone, string> = { default: INK, danger: '#a33b2a', success: '#2f6b3a' }
const PANEL = '#efe7d6'
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.12 0 0 0 0 0.1 0 0 0 0.11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
const panel = {
  bgcolor: PANEL,
  backgroundImage: GRAIN,
  border: `2px solid ${INK}`,
  borderRadius: '10px',
  boxShadow: `3px 3px 0 rgba(42,32,36,0.35), inset 0 1px 0 rgba(255,255,255,0.7)`,
  color: INK,
  '& .MuiIconButton-root': { color: INK },
  '& .MuiIconButton-root.Mui-disabled': { color: 'rgba(42,32,36,0.3)' },
}

/* A sprite is drawn once, at SPRITE_SCALE. Far out, the canvas would
 * shrink it 10 or 20 times in a single step, which samples pixels instead
 * of averaging them, and fine lines — mullions, floor lines — turn into
 * moiré. So each sprite keeps copies of itself halved again and again, a
 * mipmap, and the board draws the one nearest the size on screen. */
const mipmaps = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>()
/** `source` as it should be drawn when each of its pixels covers
 *  1 / `shrink` pixel on screen. */
function mipOf(source: HTMLCanvasElement, shrink: number) {
  const level = Math.floor(Math.log2(Math.max(1, shrink)))
  if (level === 0) return source
  let chain = mipmaps.get(source)
  if (!chain) mipmaps.set(source, chain = [source])
  while (chain.length <= level) {
    const larger = chain[chain.length - 1]
    if (larger.width === 1 && larger.height === 1) break
    const half = document.createElement('canvas')
    half.width = Math.max(1, Math.round(larger.width / 2))
    half.height = Math.max(1, Math.round(larger.height / 2))
    const c = half.getContext('2d')
    if (!c) break
    c.imageSmoothingQuality = 'high'
    c.drawImage(larger, 0, 0, half.width, half.height)
    chain.push(half)
  }
  return chain[Math.min(level, chain.length - 1)]
}

const sprites = new Map<string, Sprite>()
const appearanceOf = (item: IsoBuilderItem) => item.appearanceKey ?? (typeof item.recipe === 'string' ? item.recipe : item.id)
const recipeOf = (item: IsoBuilderItem): Recipe => typeof item.recipe === 'string' ? ISO_RECIPES[item.recipe] : item.recipe
/** Kept by id, like the sprites: measuring draws the recipe. */
const measures = new Map<string, { volume: number; height: number }>()
function measureOf(item: IsoBuilderItem) {
  const key = appearanceOf(item)
  let measure = measures.get(key)
  if (!measure) measures.set(key, measure = isoPieceMeasure(item.recipe))
  return measure
}
/** Cheapest first. The price comes from the volume, so the volume breaks
 *  ties — and orders a shop where everything is free the same way. */
const cheaperFirst = (a: IsoBuilderItem, b: IsoBuilderItem) =>
  (a.price ?? 0) - (b.price ?? 0) || measureOf(a).volume - measureOf(b).volume
const metres = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const cubicMetres = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
function spriteOf(item: IsoBuilderItem, rotation: IsoRotation, imageRevision = spriteImageRevision()) {
  const name = appearanceOf(item)
  const key = `${name}:${rotation}:${imageRevision}`
  let sprite = sprites.get(key)
  if (!sprite) {
    sprite = renderSprite(recipeOf(item), rotation, SPRITE_SCALE, name.length * 131 + 7)
    sprites.set(key, sprite)
  }
  return sprite
}

const footprintOf = (item: IsoBuilderItem, rotation: IsoRotation): [number, number] => {
  const [w, d] = recipeOf(item).size
  return rotation % 2 ? [d, w] : [w, d]
}

/** A placed piece as the camera sees it: position and footprint in
 *  turned tiles. */
interface Piece {
  id: string
  x: number
  y: number
  w: number
  d: number
  sprite: Sprite
  flat: boolean
  /** The sprite's box in board pixels, for culling and for picking. */
  left: number
  top: number
  right: number
  bottom: number
}

const world = (gx: number, gy: number): [number, number] => [(gx - gy) * HALF_W, (gx + gy) * HALF_H]

/* The camera turns the board a quarter at a time, the way a piece turns:
 * (x, y) → (size − y, x), about the board's centre. Everything the game
 * keeps — placements, occupancy, land — stays in board tiles; only what is
 * drawn and where the pointer lands go through the turn. So a piece seen
 * by a camera turned `c` is its own sprite turned by its rotation plus c. */
interface Rect { x: number; y: number; w: number; d: number }
function turnPoint([x, y]: Pt, turns: number, size: number): Pt {
  for (let i = 0; i < turns; i++) [x, y] = [size - y, x]
  return [x, y]
}
function unturnPoint([x, y]: Pt, turns: number, size: number): Pt {
  for (let i = 0; i < turns; i++) [x, y] = [y, size - x]
  return [x, y]
}
/** A rectangle of board tiles as the camera sees it — or, `back`, a
 *  rectangle on screen as the board has it. */
function turnRect(r: Rect, turns: number, size: number, back = false): Rect {
  const turn = back ? unturnPoint : turnPoint
  const [ax, ay] = turn([r.x, r.y], turns, size), [bx, by] = turn([r.x + r.w, r.y + r.d], turns, size)
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), d: Math.abs(by - ay) }
}
const turned = (rotation: number, camera: number) => ((rotation + camera) % 4) as IsoRotation

function pieceOf(placement: IsoBuilderPlacement, item: IsoBuilderItem, camera: IsoRotation, size: number, imageRevision: number): Piece {
  const [w, d] = footprintOf(item, placement.rotation)
  const seen = turnRect({ x: placement.x, y: placement.y, w, d }, camera, size)
  const sprite = spriteOf(item, turned(placement.rotation, camera), imageRevision)
  const [ox, oy] = world(seen.x, seen.y)
  const left = ox - sprite.anchor[0], top = oy - sprite.anchor[1]
  return { id: placement.id, ...seen, sprite, flat: !!item.flat, left, top, right: left + sprite.width, bottom: top + sprite.height }
}

/** Back to front. Only pieces whose sprites cross on screen can hide one
 *  another, so only those are compared — found through a coarse grid of
 *  screen buckets instead of every pair. For two such pieces, the axes
 *  that separate their footprints decide which is behind: the lower x, the
 *  lower y. When x says one thing and y the other, the two stand side by
 *  side on screen and can never hide each other, so they get no order at
 *  all — forcing one there is what closed loops, and a piece caught in a
 *  loop used to be painted over everything, pavement over towers. */
function paintOrder(pieces: Piece[]): Piece[] {
  const side = (a0: number, a1: number, b0: number, b1: number) => a1 <= b0 ? 1 : b1 <= a0 ? -1 : 0
  /** 1 when a is behind b, −1 when b is behind a, 0 when neither. */
  const behind = (a: Piece, b: Piece) => {
    const vx = side(a.x, a.x + a.w, b.x, b.x + b.w), vy = side(a.y, a.y + a.d, b.y, b.y + b.d)
    if (vx && vy && vx !== vy) return 0
    return vx || vy || Math.sign(b.x + b.y - a.x - a.y)
  }
  const BUCKET = 256
  const buckets = new Map<string, number[]>()
  pieces.forEach((p, i) => {
    for (let bx = Math.floor(p.left / BUCKET); bx <= Math.floor(p.right / BUCKET); bx++)
      for (let by = Math.floor(p.top / BUCKET); by <= Math.floor(p.bottom / BUCKET); by++) {
        const key = `${bx},${by}`
        const list = buckets.get(key)
        if (list) list.push(i); else buckets.set(key, [i])
      }
  })
  const incoming = pieces.map(() => 0)
  const edges = pieces.map(() => [] as number[])
  const seen = new Set<number>()
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const i = Math.min(list[a], list[b]), j = Math.max(list[a], list[b])
      const pair = i * pieces.length + j
      if (seen.has(pair)) continue
      seen.add(pair)
      const p = pieces[i], q = pieces[j]
      if (p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top) continue
      const order = behind(p, q)
      if (order > 0) { edges[i].push(j); incoming[j]++ } else if (order < 0) { edges[j].push(i); incoming[i]++ }
    }
  }
  const ready = pieces.map((_, i) => i).filter(i => incoming[i] === 0)
  const done = pieces.map(() => false)
  const order: Piece[] = []
  while (order.length < pieces.length) {
    // Overlapping pieces can still close a loop: release the rearmost piece
    // left and go on, instead of painting the loop over everything else.
    if (!ready.length) {
      let rearmost = -1
      pieces.forEach((p, i) => { if (!done[i] && (rearmost < 0 || p.x + p.y < pieces[rearmost].x + pieces[rearmost].y)) rearmost = i })
      ready.push(rearmost)
    }
    const i = ready.pop()!
    if (done[i]) continue
    done[i] = true
    order.push(pieces[i])
    for (const j of edges[i]) if (--incoming[j] === 0 && !done[j]) ready.push(j)
  }
  return order
}

export default function AppIsoBuilder({
  items, placements, size, height, boundless = false, terrain, onPlace, onMove, onRemove,
  upgradeOf, onUpgrade, pending = NO_ITEMS, onPlacePending, budget, priceLabel, marked = NONE, status, onReplace,
}: AppIsoBuilderProps) {
  const imageRevision = useSyncExternalStore(subscribeSpriteImages, spriteImageRevision, spriteImageRevision)
  const isLand = useMemo(() => terrain ? terrainAvailability(terrain, size) : null, [terrain, size])
  const host = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const groups = useMemo(() => [
    ...(pending.length ? [PENDING] : []),
    ...new Set(items.filter(item => !item.hidden).map(item => item.group)),
  ], [items, pending.length])
  const [group, setGroup] = useState(groups[0] ?? '')
  const [subgroupsByGroup, setSubgroupsByGroup] = useState<Record<string, string>>({})
  const [tool, setTool] = useState<Tool>({ kind: 'select' })
  const [camera, setCamera] = useState<IsoRotation>(0)
  const [selection, setSelection] = useState<string[]>([])
  const selected = useMemo(() => new Set(selection), [selection])
  const [immersive, setImmersive] = useState(false)
  const [shopOpen, setShopOpen] = useState(true)
  const [statusOpen, setStatusOpen] = useState(true)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})

  /* Worked out once per change of the city, not per frame. */
  const occupancy = useMemo(() => {
    const cells = new Map<string, string>()
    for (const placement of placements) {
      const item = itemsById.get(placement.item)
      if (!item) continue
      const [w, d] = footprintOf(item, placement.rotation)
      for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) cells.set(`${placement.x + i},${placement.y + j}`, placement.id)
    }
    return cells
  }, [placements, itemsById])
  const layers = useMemo(() => {
    const all = placements.flatMap(placement => {
      const item = itemsById.get(placement.item)
      return item ? [pieceOf(placement, item, camera, size, imageRevision)] : []
    })
    return { flat: all.filter(p => p.flat), standing: paintOrder(all.filter(p => !p.flat)) }
  }, [placements, itemsById, camera, size, imageRevision])

  /* The canvas reads the latest of everything through a ref, so the
     listeners are attached once and the view never resets. */
  const live = useRef({ tool, camera, layers, occupancy, itemsById, selected, marked, budget, onPlace, onPlacePending, onMove, onRemove })
  live.current = { tool, camera, layers, occupancy, itemsById, selected, marked, budget, onPlace, onPlacePending, onMove, onRemove }
  const view = useRef({ zoom: 1, panX: 0, panY: 0, fitted: false })
  const hover = useRef<{ x: number; y: number } | null>(null)
  /** Selected pieces being dragged, and by how many tiles so far. */
  const carry = useRef<{ id: string; ids: Set<string>; from: { x: number; y: number }; start: { x: number; y: number }; dragged: boolean; dx: number; dy: number } | null>(null)
  /** A line of pieces being dragged out, from the tile pressed to the tile
   *  under the pointer. */
  const lay = useRef<{ from: { x: number; y: number }; to: { x: number; y: number }; start: { x: number; y: number }; dragged: boolean } | null>(null)
  /** The rectangle being dragged out, corner cells in tiles. */
  const marquee = useRef<{ from: { x: number; y: number }; to: { x: number; y: number }; add: boolean; start: { x: number; y: number }; dragged: boolean } | null>(null)
  const redraw = useRef<() => void>(() => {})
  const turnCamera = useRef<(step: 1 | -1) => void>(() => {})
  const actions = useRef({ setTool, setSelection, setCamera })

  /** Whether a footprint is free, counting the pieces in `ignore` as
   *  gone: the ones being moved leave their own cells. */
  const fits = (x: number, y: number, w: number, d: number, ignore: ReadonlySet<string> = NONE) => {
    if (x < 0 || y < 0 || x + w > size || y + d > size) return false
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      if (isLand && !isLand(x + i, y + j)) return false
      const owner = live.current.occupancy.get(`${x + i},${y + j}`)
      if (owner && !ignore.has(owner)) return false
    }
    return true
  }
  const placementsRef = useRef(placements)
  placementsRef.current = placements
  const fitsRef = useRef(fits)
  fitsRef.current = fits
  /** Whether these items may go up now: the budget covers what they cost,
   *  and none takes a unique key another piece holds. `ignore` is a piece
   *  that is only moving, and so neither pays again nor holds its key. */
  const canBuild = (built: string[], ignore?: string) => {
    const pieces = built.flatMap(id => itemsById.get(id) ?? [])
    const cost = ignore ? 0 : pieces.reduce((sum, item) => sum + (item.price ?? 0), 0)
    if (budget !== undefined && cost > 0 && cost > budget) return false
    const keys = pieces.flatMap(item => item.unique ?? [])
    if (new Set(keys).size < keys.length) return false
    const held = new Set(placements.filter(placement => placement.id !== ignore).flatMap(placement => itemsById.get(placement.item)?.unique ?? []))
    return keys.every(key => !held.has(key))
  }
  const canBuildRef = useRef(canBuild)
  canBuildRef.current = canBuild

  // Shop pictures, one piece at a time so the board is never held up, and
  // each only once: a picker that makes a new item per size must not redraw
  // every picture at each step.
  const pictured = useRef(new Set<string>())
  useEffect(() => {
    let cancelled = false
    const waiting = new Set(pending)
    const queue = items.filter(item => (!item.hidden || waiting.has(item.id)) && !pictured.current.has(`${appearanceOf(item)}:${imageRevision}`))
    const next = () => {
      const item = queue.shift()
      if (!item || cancelled) return
      const sprite = spriteOf(item, 0)
      const thumb = document.createElement('canvas')
      thumb.width = thumb.height = 128
      const k = Math.min(120 / sprite.canvas.width, 120 / sprite.canvas.height)
      const w = sprite.canvas.width * k, h = sprite.canvas.height * k
      if (sprite.ground) thumb.getContext('2d')!.drawImage(mipOf(sprite.ground, 1 / k), (128 - w) / 2, 128 - h - 4, w, h)
      thumb.getContext('2d')!.drawImage(mipOf(sprite.canvas, 1 / k), (128 - w) / 2, 128 - h - 4, w, h)
      const url = thumb.toDataURL()
      pictured.current.add(`${appearanceOf(item)}:${imageRevision}`)
      setThumbnails(current => ({ ...current, [item.id]: url }))
      window.setTimeout(next, 0)
    }
    window.setTimeout(next, 30)
    return () => { cancelled = true }
  }, [items, pending, imageRevision])

  useEffect(() => {
    const element = host.current
    const found = canvasRef.current
    if (!element || !found) return
    // Typed once here: the hoisted draw() below would lose the narrowing.
    const canvas: HTMLCanvasElement = found
    const ctx = canvas.getContext('2d')!
    const shadows = document.createElement('canvas')
    /* The terrain as each camera sees it, built the first time that camera
       turns to it. The beach painter is built with the canvas: it asks this
       context which side of the coast is sea. */
    const scenes = new Map<number, { land: Path2D; rivers: Path2D[]; beach: BeachPainter | null }>()
    const sceneOf = (turns: number) => {
      if (!terrain) return null
      let scene = scenes.get(turns)
      if (!scene) {
        const turn = (polygon: Pt[]) => polygon.map(p => turnPoint(p, turns, size))
        const land = terrainPath(terrain.polygons.map(turn))
        scene = {
          land,
          rivers: (terrain.waterways ?? []).map(polygon => terrainPath([turn(polygon)])),
          beach: terrain.beach ? beachPainter({ ...terrain.beach, shores: terrain.beach.shores.map(turn) }, terrain.water, land, ctx) : null,
        }
        scenes.set(turns, scene)
      }
      return scene
    }
    /** Whether a rectangle as seen on screen is free on the board. */
    const fitsSeen = (r: Rect, ignore: ReadonlySet<string> = NONE) => {
      const b = turnRect(r, live.current.camera, size, true)
      return fitsRef.current(b.x, b.y, b.w, b.d, ignore)
    }
    /** The pieces a dragged line lays, as the camera sees them: along
     *  whichever axis the drag went further, each piece turned to run that
     *  way, one after another from the tile pressed. */
    const layLine = (line: { from: { x: number; y: number }; to: { x: number; y: number } }) => {
      const { tool, itemsById } = live.current
      const item = tool.kind === 'place' ? itemsById.get(tool.item) : undefined
      if (!item) return []
      const [dx, dy] = [line.to.x - line.from.x, line.to.y - line.from.y]
      const alongX = Math.abs(dx) >= Math.abs(dy)
      const seen = (alongX ? 0 : 1) as IsoRotation
      const [w, d] = footprintOf(item, seen)
      const step = alongX ? w : d
      const reach = alongX ? dx : dy
      const x0 = alongX ? line.from.x : line.from.x - Math.floor((w - 1) / 2)
      const y0 = alongX ? line.from.y - Math.floor((d - 1) / 2) : line.from.y
      return Array.from({ length: Math.floor(Math.abs(reach) / step) + 1 }, (_, i) => {
        const offset = Math.sign(reach) * i * step
        return { item, seen, x: x0 + (alongX ? offset : 0), y: y0 + (alongX ? 0 : offset), w, d }
      })
    }
    /** A copied group as the camera sees it. */
    const seenClips = (clips: Clip[]) => {
      let out = clips
      for (let i = 0; i < live.current.camera; i++) out = turnClips(out, live.current.itemsById)
      return out
    }
    let grain: CanvasPattern | null = null
    let frame = 0
    const invalidate = () => { if (!frame) frame = requestAnimationFrame(draw) }
    redraw.current = invalidate

    const cssSize = () => ({ width: canvas.width / (window.devicePixelRatio || 1), height: canvas.height / (window.devicePixelRatio || 1) })
    const toGrid = (sx: number, sy: number) => {
      const { zoom, panX, panY } = view.current
      const wx = (sx - panX) / zoom, wy = (sy - panY) / zoom
      return { gx: (wx / HALF_W + wy / HALF_H) / 2, gy: (wy / HALF_H - wx / HALF_W) / 2 }
    }

    /* Keep a small inset beyond every viewport corner, so even the coast
       stroke at the outer map boundary never enters the screen. */
    const cameraInset = Math.min(2, size / 8)
    const sceneryMargin = terrain?.sceneryMargin ?? 0
    const cameraMin = cameraInset - sceneryMargin
    const cameraMax = size + sceneryMargin - cameraInset
    const overviewZoom = () => {
      const { width, height: h } = cssSize()
      // Fit the playable map between the toolbar and catalog. Scenery
      // fills the margins, but must not enlarge the zoom-out range.
      return Math.min(width * 0.94 / (size * HALF_W * 2), Math.max(80, h - 234) * 0.94 / (size * HALF_H * 2))
    }
    const minZoom = () => {
      const { width, height: h } = cssSize()
      if (boundless) {
        const cover = (width / HALF_W + h / HALF_H) / (2 * (cameraMax - cameraMin))
        if (terrain && sceneryMargin) return Math.max(cover, overviewZoom())
        return terrain ? cover : Math.max(0.25, cover)
      }
      return terrain ? Math.min(0.25, width * 0.94 / (size * HALF_W * 2), Math.max(80, h - 234) / (size * HALF_H * 2 + 240)) : 0.25
    }
    const clamp = () => {
      if (!boundless) return
      const { width, height: h } = cssSize()
      if (terrain && sceneryMargin) {
        // Keep navigation on the playable board. At the overview the
        // camera stays centered; zooming in gradually opens the pan range.
        // The outer terrain is only a backdrop, never a navigation target.
        const center = toGrid(width / 2, (h - 170 + 64) / 2)
        const { zoom } = view.current
        const range = size / 2 * Math.max(0, 1 - minZoom() / zoom)
        const limit = (value: number) => Math.min(size / 2 + range, Math.max(size / 2 - range, value))
        const dx = limit(center.gx) - center.gx
        const dy = limit(center.gy) - center.gy
        view.current = {
          ...view.current,
          panX: view.current.panX - (dx - dy) * HALF_W * zoom,
          panY: view.current.panY - (dx + dy) * HALF_H * zoom,
        }
        return
      }
      const corners = [toGrid(0, 0), toGrid(width, 0), toGrid(0, h), toGrid(width, h)]
      const gxs = corners.map(c => c.gx), gys = corners.map(c => c.gy)
      const shift = (lo: number, hi: number) => lo < cameraMin ? cameraMin - lo : hi > cameraMax ? cameraMax - hi : 0
      const dgx = shift(Math.min(...gxs), Math.max(...gxs))
      const dgy = shift(Math.min(...gys), Math.max(...gys))
      if (!dgx && !dgy) return
      const { zoom } = view.current
      view.current = {
        ...view.current,
        panX: view.current.panX - (dgx - dgy) * HALF_W * zoom,
        panY: view.current.panY - (dgx + dgy) * HALF_H * zoom,
      }
    }

    const diamond = (x: number, y: number, w: number, d: number) => {
      const corners = [world(x, y), world(x + w, y), world(x + w, y + d), world(x, y + d)]
      ctx.beginPath()
      corners.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)))
      ctx.closePath()
    }
    /** Sprite pixels per device pixel on screen, set by every frame. */
    let shrink = 1
    const paste = (target: CanvasRenderingContext2D, piece: { left: number; top: number; sprite: Sprite }, which: 'canvas' | 'body' | 'ground' | 'shadow' = 'canvas') => {
      if (which === 'canvas' && piece.sprite.ground) target.drawImage(mipOf(piece.sprite.ground, shrink), piece.left, piece.top, piece.sprite.width, piece.sprite.height)
      const source = which === 'ground' ? piece.sprite.ground : which === 'shadow' ? piece.sprite.shadow : piece.sprite.canvas
      if (source) target.drawImage(mipOf(source, shrink), piece.left, piece.top, piece.sprite.width, piece.sprite.height)
    }

    function draw() {
      frame = 0
      const dpr = window.devicePixelRatio || 1
      const { zoom, panX, panY } = view.current
      shrink = SPRITE_SCALE / (zoom * dpr)
      const { tool, camera, selected, layers, itemsById } = live.current
      const scene = sceneOf(camera)
      const holding = tool.kind === 'place' || tool.kind === 'move' || tool.kind === 'paste'
      const carried = carry.current?.dragged ? carry.current : null
      const hidden = (id: string) => (tool.kind === 'move' && tool.id === id) || !!carried?.ids.has(id)
      const { width, height: h } = cssSize()
      // What the screen shows, in board pixels, with a margin for shadows.
      const view0 = { left: -panX / zoom - 40, top: -panY / zoom - 40, right: (width - panX) / zoom + 40, bottom: (h - panY) / zoom + 40 }
      const inView = (p: Piece) => !hidden(p.id) && p.right > view0.left && p.left < view0.right && p.bottom > view0.top && p.top < view0.bottom
      const flat = layers.flat.filter(inView)
      const standing = layers.standing.filter(inView)
      const worldTransform = [dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY] as const

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = terrain?.water ?? (boundless ? GROUND : PAPER)
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(...worldTransform)
      ctx.lineJoin = 'round'
      if (!boundless && !terrain) {
        diamond(0, 0, size, size)
        ctx.fillStyle = GROUND
        ctx.fill()
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.2 / zoom
        ctx.stroke()
      }
      if (terrain && scene) {
        scene.beach?.water(ctx)
        ctx.fillStyle = terrain.land
        ctx.fill(scene.land)
        scene.beach?.sand(ctx)
        ctx.strokeStyle = terrain.coast
        ctx.lineWidth = 1.5 / zoom
        ctx.stroke(scene.land)
      }
      ctx.save()
      if (scene) ctx.clip(scene.land)
      // The grid: only the lines on screen, and none when too far out to read.
      if (zoom > 0.3) {
        const corners = [toGrid(0, 0), toGrid(width, 0), toGrid(0, h), toGrid(width, h)]
        const g0 = Math.max(1, Math.floor(Math.min(...corners.map(c => c.gx))))
        const g1 = Math.min(size - 1, Math.ceil(Math.max(...corners.map(c => c.gx))))
        const h0 = Math.max(1, Math.floor(Math.min(...corners.map(c => c.gy))))
        const h1 = Math.min(size - 1, Math.ceil(Math.max(...corners.map(c => c.gy))))
        const y0 = Math.max(0, h0 - 1), y1 = Math.min(size, h1 + 1), x0 = Math.max(0, g0 - 1), x1 = Math.min(size, g1 + 1)
        ctx.strokeStyle = `rgba(42,32,36,${holding ? 0.28 : 0.1})`
        ctx.lineWidth = 0.8 / zoom
        ctx.beginPath()
        for (let i = g0; i <= g1; i++) { ctx.moveTo(...world(i, y0)); ctx.lineTo(...world(i, y1)) }
        for (let i = h0; i <= h1; i++) { ctx.moveTo(...world(x0, i)); ctx.lineTo(...world(x1, i)) }
        ctx.stroke()
      }
      ctx.restore()
      // Paint channels after the grid, including their overlaps, so delta
      // junctions remain water and no construction grid crosses the river.
      if (terrain && scene) {
        ctx.fillStyle = terrain.water
        for (const path of scene.rivers) ctx.fill(path)
      }
      for (const piece of flat) paste(ctx, piece)
      for (const piece of standing) paste(ctx, piece, 'ground')

      // Shadows go down together, so where two overlap the ground is not
      // darker than where one falls.
      if (shadows.width !== canvas.width || shadows.height !== canvas.height) { shadows.width = canvas.width; shadows.height = canvas.height }
      const s = shadows.getContext('2d')!
      s.setTransform(1, 0, 0, 1, 0, 0)
      s.clearRect(0, 0, shadows.width, shadows.height)
      s.setTransform(...worldTransform)
      for (const piece of standing) paste(s, piece, 'shadow')
      ctx.save()
      if (!boundless) { diamond(0, 0, size, size); ctx.clip() }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 0.24
      ctx.drawImage(shadows, 0, 0)
      ctx.restore()

      for (const piece of standing) paste(ctx, piece, 'body')
      // A gold marker on the pieces that can grow, the same size at any zoom.
      // It stands at the foot of the piece, in front: a tall tower's top is
      // off screen long before its base is.
      for (const piece of [...standing, ...flat]) {
        if (!live.current.marked.has(piece.id)) continue
        const [fx, fy] = world(piece.x + piece.w, piece.y + piece.d)
        const [bx, by, br] = [fx, fy - 26 / zoom, 13 / zoom]
        ctx.beginPath()
        ctx.arc(bx, by, br, 0, Math.PI * 2)
        ctx.fillStyle = '#f4c542'
        ctx.fill()
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.6 / zoom
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(bx, by - br * 0.55); ctx.lineTo(bx + br * 0.45, by); ctx.lineTo(bx + br * 0.18, by)
        ctx.lineTo(bx + br * 0.18, by + br * 0.5); ctx.lineTo(bx - br * 0.18, by + br * 0.5); ctx.lineTo(bx - br * 0.18, by)
        ctx.lineTo(bx - br * 0.45, by); ctx.closePath()
        ctx.fillStyle = INK
        ctx.fill()
      }

      if (carried) {
        // Every carried piece at its new spot, green where it fits.
        const { ids, dx, dy } = carried
        const [ox, oy] = [(dx - dy) * HALF_W, (dx + dy) * HALF_H]
        for (const piece of [...layers.flat, ...layers.standing]) {
          if (!ids.has(piece.id)) continue
          diamond(piece.x + dx, piece.y + dy, piece.w, piece.d)
          ctx.fillStyle = fitsSeen({ ...piece, x: piece.x + dx, y: piece.y + dy }, ids) ? 'rgba(76,175,80,0.45)' : 'rgba(229,57,53,0.45)'
          ctx.fill()
          ctx.save()
          ctx.globalAlpha = 0.8
          paste(ctx, { left: piece.left + ox, top: piece.top + oy, sprite: piece.sprite })
          ctx.restore()
        }
      } else if (selected.size && (tool.kind === 'select' || tool.kind === 'area')) {
        ctx.strokeStyle = '#ffc233'
        ctx.fillStyle = 'rgba(255,194,51,0.22)'
        ctx.lineWidth = 2.5 / zoom
        for (const piece of [...layers.flat, ...layers.standing]) {
          if (!selected.has(piece.id)) continue
          diamond(piece.x, piece.y, piece.w, piece.d)
          ctx.fill()
          ctx.stroke()
        }
      }
      const box = marquee.current?.dragged && boxOf(marquee.current)
      if (box) {
        diamond(box.x, box.y, box.w, box.d)
        ctx.fillStyle = 'rgba(255,194,51,0.18)'
        ctx.fill()
        ctx.setLineDash([6 / zoom, 4 / zoom])
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.5 / zoom
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (tool.kind === 'paste' && hover.current) {
        const at = hover.current
        const ghosts = seenClips(tool.pieces).flatMap(clip => {
          const item = itemsById.get(clip.item)
          return item ? [{ clip, item, x: at.x + clip.x, y: at.y + clip.y, size: footprintIn(itemsById, clip) }] : []
        })
        const affordable = canBuildRef.current(tool.pieces.map(clip => clip.item))
        for (const { x, y, size: [w, d] } of ghosts) {
          diamond(x, y, w, d)
          ctx.fillStyle = fitsSeen({ x, y, w, d }) && affordable ? 'rgba(76,175,80,0.45)' : 'rgba(229,57,53,0.45)'
          ctx.fill()
        }
        ctx.save()
        ctx.globalAlpha = 0.7
        for (const { clip, item, x, y } of ghosts.sort((a, b) => a.x + a.y - b.x - b.y)) {
          const sprite = spriteOf(item, clip.rotation)
          const [ox, oy] = world(x, y)
          paste(ctx, { left: ox - sprite.anchor[0], top: oy - sprite.anchor[1], sprite })
        }
        ctx.restore()
      }
      const laying = lay.current?.dragged ? layLine(lay.current) : null
      if (laying) {
        for (const piece of laying) {
          diamond(piece.x, piece.y, piece.w, piece.d)
          ctx.fillStyle = fitsSeen(piece) ? 'rgba(76,175,80,0.45)' : 'rgba(229,57,53,0.45)'
          ctx.fill()
          const sprite = spriteOf(piece.item, piece.seen)
          const [ox, oy] = world(piece.x, piece.y)
          ctx.save()
          ctx.globalAlpha = 0.7
          paste(ctx, { left: ox - sprite.anchor[0], top: oy - sprite.anchor[1], sprite })
          ctx.restore()
        }
      }
      const hand = laying ? null : handItem()
      if (hand && hover.current) {
        const seen = turned(hand.rotation, camera)
        const [w, d] = footprintOf(hand.item, seen)
        const spot = hover.current
        const ok = fitsSeen({ ...spot, w, d }, tool.kind === 'move' ? new Set([tool.id]) : NONE) &&
          canBuildRef.current([hand.item.id], tool.kind === 'move' ? tool.id : undefined)
        diamond(spot.x, spot.y, w, d)
        ctx.fillStyle = ok ? 'rgba(76,175,80,0.45)' : 'rgba(229,57,53,0.45)'
        ctx.fill()
        const sprite = spriteOf(hand.item, seen)
        const [ox, oy] = world(spot.x, spot.y)
        ctx.save()
        ctx.globalAlpha = 0.7
        paste(ctx, { left: ox - sprite.anchor[0], top: oy - sprite.anchor[1], sprite })
        ctx.restore()
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      if (terrain) return
      grain ??= makeGrain(ctx)
      if (grain) {
        ctx.save()
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillStyle = grain
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
      }
    }

    function handItem() {
      const { tool, itemsById } = live.current
      if (tool.kind !== 'place' && tool.kind !== 'move') return null
      const item = itemsById.get(tool.item)
      return item ? { item, rotation: tool.rotation } : null
    }

    const fit = () => {
      const { width, height: measured } = element.getBoundingClientRect()
      if (!width || !measured) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(measured * dpr)
      if (!view.current.fitted) {
        if (boundless) {
          // Terrain opens near the widest safe view, without exposing its
          // outer edges. Plain boards retain their piece-scale view.
          const [cx, cy] = world(size / 2, size / 2)
          const zoom = terrain ? minZoom() * (sceneryMargin ? 1 : 1.15) : 1
          const centerY = terrain && sceneryMargin ? (measured - 170 + 64) / 2 : measured / 2
          view.current = { zoom, panX: width / 2 - cx * zoom, panY: centerY - cy * zoom, fitted: true }
        } else {
          // The whole board in view between the toolbar and the shop, with
          // room above it for the tallest towers.
          const SKY = 240, TOOLBAR = 64, SHOP = 170
          const zoom = Math.min(1.2, (width * 0.94) / (size * HALF_W * 2), (measured - TOOLBAR - SHOP) / (size * HALF_H * 2 + SKY))
          view.current = { zoom, panX: width / 2, panY: TOOLBAR + SKY * zoom, fitted: true }
        }
      }
      if (view.current.zoom < minZoom()) view.current = { ...view.current, zoom: minZoom() }
      clamp()
      invalidate()
    }
    const observer = new ResizeObserver(fit)
    observer.observe(element)

    /** The footprint of what is in hand: one piece, or a copied group. */
    const handBox = (): [number, number] | null => {
      const { tool, camera, itemsById } = live.current
      if (tool.kind === 'paste') return clipBox(seenClips(tool.pieces), itemsById)
      const hand = handItem()
      return hand ? footprintOf(hand.item, turned(hand.rotation, camera)) : null
    }
    const cellAt = (event: PointerEvent) => {
      const box = handBox()
      if (!box) return null
      const rect = canvas.getBoundingClientRect()
      const { gx, gy } = toGrid(event.clientX - rect.left, event.clientY - rect.top)
      const [w, d] = box
      return { x: Math.round(gx - w / 2), y: Math.round(gy - d / 2) }
    }
    const tileAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const { gx, gy } = toGrid(event.clientX - rect.left, event.clientY - rect.top)
      return { x: Math.floor(gx), y: Math.floor(gy) }
    }
    /** Every piece whose footprint the rectangle touches. */
    const piecesIn = (box: { x: number; y: number; w: number; d: number }) => {
      const { standing, flat } = live.current.layers
      return [...flat, ...standing]
        .filter(p => p.x < box.x + box.w && p.x + p.w > box.x && p.y < box.y + box.d && p.y + p.d > box.y)
        .map(p => p.id)
    }
    /** The piece under the pointer: standing ones by the pixels of their
     *  sprite, front first; flat ones by their footprint. */
    const pieceAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = event.clientX - rect.left, sy = event.clientY - rect.top
      const { zoom, panX, panY } = view.current
      const wx = (sx - panX) / zoom, wy = (sy - panY) / zoom
      const { standing, flat } = live.current.layers
      for (let i = standing.length - 1; i >= 0; i--) {
        const piece = standing[i]
        if (wx < piece.left || wx >= piece.right || wy < piece.top || wy >= piece.bottom) continue
        const px = Math.floor((wx - piece.left) * SPRITE_SCALE), py = Math.floor((wy - piece.top) * SPRITE_SCALE)
        if ([piece.sprite.canvas, piece.sprite.ground].some(layer => layer && layer.getContext('2d')!.getImageData(px, py, 1, 1).data[3] > 40)) return piece.id
      }
      const { gx, gy } = toGrid(sx, sy)
      return flat.find(p => gx >= p.x && gx < p.x + p.w && gy >= p.y && gy < p.y + p.d)?.id ?? null
    }

    // Pointers: a drag pans, two fingers pinch, a still click acts.
    const pointers = new Map<number, { x: number; y: number }>()
    let press: { x: number; y: number; panX: number; panY: number; moved: boolean; button: number } | null = null
    let pinch: { distance: number; zoom: number } | null = null
    const zoomAt = (sx: number, sy: number, next: number) => {
      const { zoom, panX, panY } = view.current
      const clamped = Math.min(MAX_ZOOM, Math.max(minZoom(), next))
      view.current = { ...view.current, zoom: clamped, panX: sx - (sx - panX) * (clamped / zoom), panY: sy - (sy - panY) * (clamped / zoom) }
      clamp()
      invalidate()
    }
    /** Turns the camera a quarter, keeping the spot at the centre of the
     *  screen where it is. */
    turnCamera.current = step => {
      const { width, height: h } = cssSize()
      const [sx, sy] = [width / 2, h / 2]
      const { gx, gy } = toGrid(sx, sy)
      const before = live.current.camera
      const next = ((before + step + 4) % 4) as IsoRotation
      const [wx, wy] = world(...turnPoint(unturnPoint([gx, gy], before, size), next, size))
      const { zoom } = view.current
      view.current = { ...view.current, panX: sx - wx * zoom, panY: sy - wy * zoom }
      hover.current = null
      carry.current = marquee.current = lay.current = press = null
      clamp()
      actions.current.setCamera(next)
    }
    const down = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.current.zoom }
        press = null
        if (marquee.current || carry.current || lay.current) { marquee.current = carry.current = lay.current = null; invalidate() }
        return
      }
      const { tool, selected } = live.current
      // Grabbing a piece carries the selection with it: in the select tool
      // any piece (it becomes the selection unless it is already in it), in
      // the area tool only one already selected.
      if (event.button === 0 && !event.shiftKey && (tool.kind === 'select' || tool.kind === 'area')) {
        const id = pieceAt(event)
        if (id && (tool.kind === 'select' || selected.has(id))) {
          const ids = selected.has(id) ? new Set(selected) : new Set([id])
          if (!selected.has(id)) actions.current.setSelection([id])
          carry.current = { id, ids, from: tileAt(event), start: { x: event.clientX, y: event.clientY }, dragged: false, dx: 0, dy: 0 }
          press = null
          return
        }
      }
      // The area tool, or Shift with the pointer, drags out a selection
      // instead of the map.
      if (event.button === 0 && (tool.kind === 'area' || (tool.kind === 'select' && event.shiftKey))) {
        const cell = tileAt(event)
        marquee.current = { from: cell, to: cell, add: event.shiftKey, start: { x: event.clientX, y: event.clientY }, dragged: false }
        press = null
        invalidate()
        return
      }
      // A piece laid in lines — a road — drags out a line instead of the
      // map; a click without a drag still lays one.
      if (event.button === 0 && tool.kind === 'place' && live.current.itemsById.get(tool.item)?.drag) {
        const cell = tileAt(event)
        lay.current = { from: cell, to: cell, start: { x: event.clientX, y: event.clientY }, dragged: false }
      }
      press = { x: event.clientX, y: event.clientY, panX: view.current.panX, panY: view.current.panY, moved: false, button: event.button }
    }
    const move = (event: PointerEvent) => {
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const rect = canvas.getBoundingClientRect()
        zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance)
        return
      }
      if (carry.current) {
        const { from, start, dragged, dx, dy } = carry.current
        if (!dragged && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5) return
        const cell = tileAt(event)
        carry.current = { ...carry.current, dragged: true, dx: cell.x - from.x, dy: cell.y - from.y }
        if (!dragged || cell.x - from.x !== dx || cell.y - from.y !== dy) invalidate()
        return
      }
      if (marquee.current) {
        const { to, start, dragged } = marquee.current
        if (!dragged && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5) return
        const cell = tileAt(event)
        marquee.current = { ...marquee.current, to: cell, dragged: true }
        if (!dragged || cell.x !== to.x || cell.y !== to.y) invalidate()
        return
      }
      if (lay.current) {
        const { to, start, dragged } = lay.current
        if (!dragged && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5) return
        const cell = tileAt(event)
        lay.current = { ...lay.current, to: cell, dragged: true }
        if (!dragged || cell.x !== to.x || cell.y !== to.y) invalidate()
        return
      }
      if (press) {
        const dx = event.clientX - press.x, dy = event.clientY - press.y
        if (press.moved || Math.hypot(dx, dy) > 5) {
          press.moved = true
          view.current = { ...view.current, panX: press.panX + dx, panY: press.panY + dy }
          clamp()
          invalidate()
        }
        return
      }
      if (event.pointerType === 'mouse') {
        const cell = cellAt(event)
        if (cell && (cell.x !== hover.current?.x || cell.y !== hover.current?.y)) { hover.current = cell; invalidate() }
      }
    }
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinch = null
      if (lay.current) {
        const line = lay.current.dragged ? layLine(lay.current) : null
        lay.current = null
        if (line) {
          press = null
          invalidate()
          if (event.type !== 'pointerup' || !line.length) return
          // Lay what fits and skip what does not: a road runs up to the
          // buildings in its way, not over them.
          const { camera, tool, budget, onPlace } = live.current
          const rotation = ((line[0].seen - camera + 4) % 4) as IsoRotation
          // As far as the money goes; free pieces always go.
          const each = line[0].item.price ?? 0
          const affordable = budget === undefined || each === 0 ? line.length : Math.max(0, Math.floor(budget / each))
          const laid = line.filter(piece => fitsSeen(piece)).slice(0, affordable).map(piece => {
            const { x, y } = turnRect(piece, camera, size, true)
            return { item: piece.item.id, x, y, rotation }
          })
          if (laid.length) onPlace(laid)
          if (tool.kind === 'place') actions.current.setTool({ ...tool, rotation })
          return
        }
      }
      if (carry.current) {
        const { id, ids, dragged, dx, dy } = carry.current
        carry.current = null
        invalidate()
        if (event.type !== 'pointerup') return
        // A click without a drag narrows the selection to that one piece.
        if (!dragged) { actions.current.setSelection([id]); return }
        if (!dx && !dy) return
        // All or nothing: if one piece does not fit, none moves.
        const { layers, camera, onMove } = live.current
        const moved = [...layers.flat, ...layers.standing].filter(piece => ids.has(piece.id)).map(piece => ({ ...piece, x: piece.x + dx, y: piece.y + dy }))
        if (!moved.every(piece => fitsSeen(piece, ids))) return
        const rotation = new Map(placementsRef.current.map(placement => [placement.id, placement.rotation]))
        onMove(moved.map(piece => {
          const { x, y } = turnRect(piece, camera, size, true)
          return { id: piece.id, x, y, rotation: rotation.get(piece.id) ?? 0 }
        }))
        return
      }
      if (marquee.current) {
        const { add, dragged } = marquee.current
        const box = boxOf(marquee.current)
        marquee.current = null
        invalidate()
        if (event.type !== 'pointerup') return
        const { setSelection } = actions.current
        if (dragged) {
          const ids = piecesIn(box)
          setSelection(current => add ? [...new Set([...current, ...ids])] : ids)
          return
        }
        // A click that never became a drag picks the piece drawn under it;
        // with Shift it goes into the selection, or back out.
        const id = pieceAt(event)
        if (!add) setSelection(id ? [id] : [])
        else if (id) setSelection(current => current.includes(id) ? current.filter(other => other !== id) : [...current, id])
        return
      }
      const pressed = press
      press = null
      if (!pressed || pressed.moved) return
      const { tool, onPlace, onPlacePending, onMove, onRemove } = live.current
      const { setTool, setSelection } = actions.current
      if (pressed.button === 2) { setTool({ kind: 'select' }); return }
      if (pressed.button !== 0) return
      if (tool.kind === 'place' || tool.kind === 'move' || tool.kind === 'paste') {
        const cell = cellAt(event)
        if (!cell) return
        // Without hover, the first tap shows where it would go and a second
        // tap on the same spot builds.
        if (event.pointerType !== 'mouse' && (cell.x !== hover.current?.x || cell.y !== hover.current?.y)) {
          hover.current = cell
          invalidate()
          return
        }
        hover.current = cell
        const { camera, itemsById } = live.current
        if (tool.kind === 'paste') {
          // All or nothing: a copy that does not fit whole is not built.
          const seen = seenClips(tool.pieces).map(clip => {
            const [w, d] = footprintIn(itemsById, clip)
            return { clip, rect: { x: cell.x + clip.x, y: cell.y + clip.y, w, d } }
          })
          if (!seen.every(({ rect }) => fitsSeen(rect)) || !canBuildRef.current(tool.pieces.map(clip => clip.item))) return
          onPlace(seen.map(({ clip, rect }) => {
            const { x, y } = turnRect(rect, camera, size, true)
            return { item: clip.item, x, y, rotation: ((clip.rotation - camera + 4) % 4) as IsoRotation }
          }))
          return
        }
        const hand = handItem()!
        const [w, d] = footprintOf(hand.item, turned(hand.rotation, camera))
        const ignore = tool.kind === 'move' ? new Set([tool.id]) : NONE
        if (!fitsSeen({ ...cell, w, d }, ignore)) return
        if (!canBuildRef.current([hand.item.id], tool.kind === 'move' ? tool.id : undefined)) return
        const { x, y } = turnRect({ ...cell, w, d }, camera, size, true)
        const spot = { x, y, rotation: hand.rotation }
        if (tool.kind === 'place' && tool.pending) { onPlacePending?.({ item: tool.item, ...spot }); setTool({ kind: 'select' }) }
        else if (tool.kind === 'place') {
          onPlace([{ item: tool.item, ...spot }])
          // One of a kind: once it is down there is nothing left in hand.
          if (hand.item.unique) setTool({ kind: 'select' })
        }
        else { onMove([{ id: tool.id, ...spot }]); setTool({ kind: 'select' }); setSelection([tool.id]) }
        return
      }
      const id = pieceAt(event)
      if (tool.kind === 'demolish') { if (id) onRemove([id]); return }
      setSelection(id ? [id] : [])
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, view.current.zoom * Math.exp(-event.deltaY * 0.0015))
    }
    const menu = (event: Event) => event.preventDefault()
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('contextmenu', menu)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('contextmenu', menu)
      redraw.current = () => {}
    }
  }, [size, boundless, terrain])

  useEffect(() => { redraw.current() }, [layers, tool, selected, immersive, marked])

  // The tab of waiting items closes once the last one is down.
  useEffect(() => {
    if (!groups.includes(group)) setGroup(groups[0] ?? '')
  }, [groups, group])

  // Pieces removed leave the selection with them.
  useEffect(() => {
    const present = new Set(placements.map(placement => placement.id))
    setSelection(current => current.every(id => present.has(id)) ? current : current.filter(id => present.has(id)))
  }, [placements])

  // Turning and moving act on one piece; removing, on all of them.
  const single = selection.length === 1 ? placements.find(placement => placement.id === selection[0]) : undefined
  const upgrade = single && upgradeOf && onUpgrade ? upgradeOf(single) : null
  /** Takes the piece off the board and puts its successor in hand. */
  const takeUpgrade = () => {
    if (!single || !upgrade || !onUpgrade) return
    onUpgrade(single.id, upgrade.item)
    setSelection([])
    setGroup(PENDING)
    setShopOpen(true)
    setTool({ kind: 'place', item: upgrade.item, rotation: single.rotation, pending: true })
  }
  const singleItem = single ? itemsById.get(single.item) : undefined
  const handItem = tool.kind === 'place' && !tool.pending ? itemsById.get(tool.item) : undefined
  const appearanceItem = singleItem ?? handItem
  const variants = appearanceItem?.variants
  const chooseVariant = (id: string) => {
    const next = itemsById.get(id)
    if (!next || !appearanceItem) return
    const [w, d] = recipeOf(appearanceItem).size
    const [nw, nd] = recipeOf(next).size
    if (w !== nw || d !== nd || next.unique !== appearanceItem.unique) return
    if (single && onReplace) onReplace(single.id, id)
    else if (tool.kind === 'place' && !tool.pending) setTool({ ...tool, item: id })
  }
  const materialPicker = variants && (single ? onReplace : handItem) && <>
    <AppText variant="caption" tint={INK}>{variants.label}</AppText>
    <Box role="group" aria-label={variants.label} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
      {variants.options.map(option => <ButtonBase key={option.id} aria-pressed={option.id === variants.selected}
        onClick={() => chooseVariant(option.id)} sx={{ px: 0.75, py: 0.75, borderRadius: '5px', fontSize: '0.75rem',
          border: `1px solid ${option.id === variants.selected ? '#ad8a3e' : 'rgba(42,32,36,0.25)'}`,
          bgcolor: option.id === variants.selected ? '#2a2524' : 'rgba(255,255,255,0.3)',
          color: option.id === variants.selected ? '#f0d690' : INK,
        }}>{option.label}</ButtonBase>)}
    </Box>
  </>


  const rotateHand = () => setTool(current => current.kind === 'place' || current.kind === 'move'
    ? { ...current, rotation: ((current.rotation + 1) % 4) as IsoRotation }
    : current.kind === 'paste' ? { ...current, pieces: turnClips(current.pieces, itemsById) } : current)
  /** The selection, kept relative to its corner, ready to be built again. */
  const clipboard = useRef<Clip[] | null>(null)
  const copy = () => {
    const pieces = placements.filter(placement => selected.has(placement.id) && !itemsById.get(placement.item)?.unique)
    if (!pieces.length) return null
    const x0 = Math.min(...pieces.map(piece => piece.x)), y0 = Math.min(...pieces.map(piece => piece.y))
    clipboard.current = pieces.map(({ item, x, y, rotation }) => ({ item, x: x - x0, y: y - y0, rotation }))
    return clipboard.current
  }
  const pasteClipboard = () => {
    if (!clipboard.current) return
    setSelection([])
    setTool({ kind: 'paste', pieces: clipboard.current })
  }
  const duplicate = () => { if (copy()) pasteClipboard() }
  /** Turns a placed piece where it stands, when it still fits turned. */
  const rotateSelected = () => {
    if (!single || !singleItem) return
    const spot = { x: single.x, y: single.y, rotation: ((single.rotation + 1) % 4) as IsoRotation }
    const [w, d] = footprintOf(singleItem, spot.rotation)
    if (fits(spot.x, spot.y, w, d, new Set([single.id]))) onMove([{ id: single.id, ...spot }])
  }
  const pickUp = () => {
    if (single) setTool({ kind: 'move', id: single.id, item: single.item, rotation: single.rotation })
  }

  const keyboard = useRef({ rotateHand, rotateSelected, pickUp, copy, pasteClipboard })
  keyboard.current = { rotateHand, rotateSelected, pickUp, copy, pasteClipboard }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      const { tool, selected, onRemove } = live.current
      const holding = tool.kind === 'place' || tool.kind === 'move' || tool.kind === 'paste'
      const selecting = tool.kind === 'select' || tool.kind === 'area'
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && (key === 'c' || key === 'v')) {
        // Only when there is something to copy or paste: otherwise the
        // browser keeps its own shortcut.
        if (key === 'c' && selecting && selected.size) { event.preventDefault(); keyboard.current.copy() }
        if (key === 'v' && clipboard.current) { event.preventDefault(); keyboard.current.pasteClipboard() }
        return
      }
      if (!event.ctrlKey && !event.metaKey && (key === 'q' || key === 'e')) {
        turnCamera.current(key === 'e' ? -1 : 1)
        return
      }
      if (event.key === 'r' || event.key === 'R') {
        if (holding) keyboard.current.rotateHand()
        else keyboard.current.rotateSelected()
      } else if (event.key === 'm' || event.key === 'M') {
        if (tool.kind === 'select' || tool.kind === 'area') keyboard.current.pickUp()
      } else if (event.key === 'Escape') {
        if (selected.size && (tool.kind === 'select' || tool.kind === 'area')) setSelection([])
        else if (tool.kind !== 'select') setTool({ kind: 'select' })
        else if (document.fullscreenElement) void document.exitFullscreen()
        else setImmersive(false)
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected.size && (tool.kind === 'select' || tool.kind === 'area')) {
        onRemove([...selected])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!immersive) return
    const leave = () => { if (!document.fullscreenElement) setImmersive(false) }
    document.addEventListener('fullscreenchange', leave)
    return () => document.removeEventListener('fullscreenchange', leave)
  }, [immersive])
  const toggleImmersive = () => {
    if (immersive) {
      if (document.fullscreenElement) void document.exitFullscreen()
      setImmersive(false)
      return
    }
    setImmersive(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const holding = tool.kind === 'place' || tool.kind === 'move' || tool.kind === 'paste'
  const inHand = tool.kind === 'place' && !tool.pending ? itemsById.get(tool.item) : undefined
  const hint = inHand && budget !== undefined && (inHand.price ?? 0) > budget
    ? 'Saldo insuficiente para este item'
    : tool.kind === 'place'
    ? tool.pending ? 'Clique para colocar · R gira · Esc guarda para depois' : 'Clique para construir · R gira · Esc solta'
    : tool.kind === 'paste'
      ? 'Clique para colar · R gira · Esc solta'
    : tool.kind === 'move'
      ? 'Clique no novo lugar · R gira · Esc cancela'
      : tool.kind === 'demolish'
        ? 'Clique numa peça para remover · Esc sai'
        : tool.kind === 'area'
          ? 'Arraste para selecionar uma área · Shift soma · Delete remove · Esc sai'
          : null
  // Offsets are not spacing in `sx`: a bare number there is pixels.
  const edge = (theme: Theme) => theme.spacing(space.sm)
  const groupedItems = (group === PENDING
    ? pending.flatMap(id => itemsById.get(id) ?? [])
    : items.filter(item => item.group === group && !item.hidden)
  ).sort(cheaperFirst)
  // In the order of their cheapest piece.
  const subgroups = [...new Set(groupedItems.map(item => item.subgroup))]
  const subgroup = subgroups.includes(subgroupsByGroup[group]) ? subgroupsByGroup[group] : subgroups[0]
  const shopItems = groupedItems.filter(item => item.subgroup === subgroup)
  const singleMeasure = singleItem && measureOf(singleItem)


  return <Box sx={immersive
    ? { position: 'fixed', inset: 0, zIndex: 'modal', bgcolor: PAPER }
    : { position: 'relative', height, borderRadius: (theme: Theme) => `${theme.radius.md}px`, overflow: 'hidden', bgcolor: PAPER }}>
    <Box ref={host} sx={{ position: 'absolute', inset: 0 }}>
      <Box component="canvas" ref={canvasRef} aria-label="Mapa isométrico. Arraste para mover o mapa, roda ou pinça para aproximar."
        sx={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: holding || tool.kind === 'area' ? 'crosshair' : 'grab' }} />
    </Box>

    <Box sx={{ position: 'absolute', top: edge, left: edge, display: 'flex', gap: space.xs, p: space.xs, ...panel }}>
      <AppIconButton label={immersive ? 'Sair da tela cheia' : 'Tela cheia'} tooltip onClick={toggleImmersive}>
        {immersive ? <FullscreenExitIcon /> : <FullscreenIcon />}
      </AppIconButton>
      <ToolButton active={tool.kind === 'select'} label="Selecionar" onClick={() => setTool({ kind: 'select' })}><NearMeIcon /></ToolButton>
      <ToolButton active={tool.kind === 'area'} label="Selecionar área" onClick={() => setTool({ kind: 'area' })}><HighlightAltIcon /></ToolButton>
      <ToolButton active={tool.kind === 'demolish'} label="Demolir" onClick={() => { setSelection([]); setTool({ kind: 'demolish' }) }}><DeleteIcon /></ToolButton>
      <AppIconButton label="Girar (R)" tooltip disabled={!holding} onClick={rotateHand}>
        <RotateRightIcon />
      </AppIconButton>
      <AppIconButton label="Girar o mapa (Q)" tooltip onClick={() => turnCamera.current(1)}>
        <Rotate90DegreesCcwIcon />
      </AppIconButton>
      <AppIconButton label="Girar o mapa (E)" tooltip onClick={() => turnCamera.current(-1)}>
        <Rotate90DegreesCwIcon />
      </AppIconButton>
    </Box>

    {status && <Box sx={{ position: 'absolute', top: { xs: 64, sm: 60 }, left: edge, width: 232, ...panel }}>
      <ButtonBase focusRipple onClick={() => setStatusOpen(open => !open)} aria-expanded={statusOpen}
        sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.xs, px: space.sm, py: space.xs, borderRadius: '8px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <AppText variant="caption" tint="rgba(42,32,36,0.65)">{status.label}</AppText>
          <AppText weight="strong" tint={TONE[status.tone ?? 'default']}>{status.value}</AppText>
        </Box>
        {statusOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ButtonBase>
      {statusOpen && <Box sx={{ px: space.sm, pb: space.sm, display: 'flex', flexDirection: 'column', gap: '2px', borderTop: `1px dashed rgba(42,32,36,0.3)`, pt: space.xs }}>
        {status.rows.map(row => (
          <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: space.sm }}>
            <AppText variant="caption" tint="rgba(42,32,36,0.7)">{row.label}</AppText>
            <AppText variant="caption" weight="strong" tint={TONE[row.tone ?? 'default']}>{row.value}</AppText>
          </Box>
        ))}
        {status.note && <AppText variant="caption" tint="rgba(42,32,36,0.6)">{status.note}</AppText>}
      </Box>}
    </Box>}

    {hint && <Box sx={{ position: 'absolute', top: edge, right: edge, maxWidth: 420, px: space.sm, py: space.xs, display: { xs: 'none', sm: 'block' }, ...panel }}>
      <AppText variant="caption" tint={INK}>{hint}</AppText>
    </Box>}

    {handItem?.variants && <Box sx={{ position: 'absolute', top: { xs: 64, sm: 60 }, right: edge, p: space.sm, width: 220,
      display: 'flex', flexDirection: 'column', gap: space.xs, ...panel }}>
      <AppText weight="strong" tint={INK}>{handItem.label}</AppText>
      {materialPicker}
    </Box>}

    {selection.length > 0 && (tool.kind === 'select' || tool.kind === 'area') && <Box sx={{
      position: 'absolute', top: { xs: 64, sm: 60 }, right: edge, p: space.sm, width: 220,
      display: 'flex', flexDirection: 'column', gap: space.xs, ...panel,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText weight="strong" tint={INK}>{singleItem ? singleItem.label : `${selection.length} peças`}</AppText>
        <AppIconButton label="Fechar" size="sm" onClick={() => setSelection([])}><CloseIcon fontSize="small" /></AppIconButton>
      </Box>
      {singleMeasure && singleMeasure.volume > 0 && [
        { label: 'Altura', value: `${metres.format(singleMeasure.height)} m` },
        { label: 'Volume', value: `${cubicMetres.format(singleMeasure.volume)} m³` },
      ].map(row => (
        <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: space.sm }}>
          <AppText variant="caption" tint="rgba(42,32,36,0.7)">{row.label}</AppText>
          <AppText variant="caption" weight="strong" tint={INK}>{row.value}</AppText>
        </Box>
      ))}
      {materialPicker}
      {upgrade && <PanelButton icon={<UpgradeIcon fontSize="small" />} highlight onClick={takeUpgrade}>{upgrade.label}</PanelButton>}
      {singleItem && <>
        <PanelButton icon={<OpenWithIcon fontSize="small" />} onClick={pickUp}>Mover (M)</PanelButton>
        <PanelButton icon={<RotateRightIcon fontSize="small" />} onClick={rotateSelected}>Girar (R)</PanelButton>
      </>}
      <PanelButton icon={<ContentCopyIcon fontSize="small" />} onClick={duplicate}>Duplicar (Ctrl+C, Ctrl+V)</PanelButton>
      <PanelButton icon={<DeleteIcon fontSize="small" />} danger onClick={() => onRemove(selection)}>
        {singleItem ? 'Remover' : 'Remover todas'}
      </PanelButton>
    </Box>}

    <Box sx={{ position: 'absolute', left: edge, right: edge, bottom: edge, p: space.md, borderRadius: '18px', bgcolor: '#f7f4ec', border: '1px solid #d1c9b8', boxShadow: '0 8px 32px #201d2433', color: INK }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: space.xs, overflowX: 'auto', pb: '2px' }}>
        <AppIconButton label={shopOpen ? 'Recolher loja' : 'Abrir loja'} size="sm" onClick={() => setShopOpen(open => !open)}>
          {shopOpen ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </AppIconButton>
        {groups.map(name => <ButtonBase key={name} focusRipple aria-pressed={name === group} onClick={() => { setGroup(name); setShopOpen(true) }} sx={{
          flexShrink: 0, px: 2, minHeight: 42, borderRadius: '12px', border: 'none',
          bgcolor: name === group ? INK : name === PENDING ? '#f4d98c' : 'rgba(255,255,255,0.35)', color: name === group ? PANEL : INK,
          fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.02em',
          boxShadow: name === group ? '0 2px 6px #201d2420' : 'none', '&:hover': { bgcolor: name === group ? INK : '#e9e4d8' },
        }}>{name === PENDING ? `${name} · ${pending.length}` : name}</ButtonBase>)}
      </Box>
      {shopOpen && <Box role="group" aria-label={`Categorias de ${group}`}
        sx={{ display: 'flex', gap: space.sm, overflowX: 'auto', pt: space.sm, pb: space.sm, borderBottom: '1px solid #ded7c8' }}>
        {subgroups.map(name => <ButtonBase key={name} focusRipple aria-pressed={name === subgroup}
          onClick={() => setSubgroupsByGroup(current => ({ ...current, [group]: name }))}
          sx={{ flexShrink: 0, px: 1.5, minHeight: 36, borderRadius: '9px', fontSize: '0.75rem',
            border: 'none', fontWeight: name === subgroup ? 700 : 400,
            bgcolor: name === subgroup ? '#e7ddc3' : 'transparent', color: INK,
          }}>
          {name}<Box component="span" sx={{ ml: 1, opacity: 0.55, fontSize: '0.68rem' }}>{groupedItems.filter(item => item.subgroup === name).length}</Box>
        </ButtonBase>)}
      </Box>}
      {shopOpen && <Box sx={{ display: 'flex', gap: space.sm, overflowX: 'auto', pt: space.sm, pb: '4px' }}>
        {shopItems.map((item, index) => {
          const waiting = group === PENDING
          const active = tool.kind === 'place' && tool.item === item.id && !!tool.pending === waiting
          const [w, d] = recipeOf(item).size
          const short = !waiting && budget !== undefined && (item.price ?? 0) > 0 && (item.price ?? 0) > budget
          return <ButtonBase key={`${item.id}:${index}`} focusRipple
            onClick={() => { setSelection([]); setTool(active ? { kind: 'select' } : { kind: 'place', item: item.id, rotation: 0, pending: waiting }) }}
            sx={{
              flexShrink: 0, width: 136, display: 'flex', flexDirection: 'column', alignItems: 'center', p: space.xs,
              borderRadius: '12px', border: `1.5px solid ${active ? '#a58a4d' : '#e2ddd2'}`,
              bgcolor: active ? '#eee5cd' : '#fffdf8',
              boxShadow: active ? '0 0 0 2px #b79a5833' : '0 2px 4px #201d2408',
              transform: active ? 'translate(1px, 1px)' : 'none',
              transition: 'transform 80ms, box-shadow 80ms',
              opacity: short ? 0.55 : 1,
              '&:hover': { bgcolor: active ? '#f4d98c' : '#ece3d1' },
            }}>
            {thumbnails[item.id]
              ? <Box component="img" src={thumbnails[item.id]} alt="" sx={{ width: 96, height: 96 }} />
              : <Box sx={{ width: 96, height: 96 }} />}
            {/* Two lines at most, centred, the same height on every card. */}
            <Box sx={{
              width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              '& > *': { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
            }}>
              <AppText variant="caption" weight="strong" tint={INK}>{item.label}</AppText>
            </Box>
            <AppText variant="caption" tint={short ? '#a33b2a' : 'rgba(42,32,36,0.6)'}>
              {priceLabel && item.price !== undefined ? `${item.price ? priceLabel(item.price) : 'Grátis'} · ${w}×${d}` : `${w}×${d}`}
            </AppText>
          </ButtonBase>
        })}
      </Box>}
    </Box>
  </Box>
}

/** The tiles between two corner cells, whichever way the drag went. */
function boxOf({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const x = Math.min(from.x, to.x), y = Math.min(from.y, to.y)
  return { x, y, w: Math.abs(to.x - from.x) + 1, d: Math.abs(to.y - from.y) + 1 }
}

const footprintIn = (items: Map<string, IsoBuilderItem>, clip: Clip): [number, number] => {
  const item = items.get(clip.item)
  return item ? footprintOf(item, clip.rotation) : [1, 1]
}
/** The tiles a copied group spans. */
function clipBox(clips: Clip[], items: Map<string, IsoBuilderItem>): [number, number] {
  return clips.reduce<[number, number]>(([w, d], clip) => {
    const [cw, cd] = footprintIn(items, clip)
    return [Math.max(w, clip.x + cw), Math.max(d, clip.y + cd)]
  }, [0, 0])
}
/** The group turned a quarter the way a single piece turns, (x, y) →
 *  (D − y, x): every piece moves round the group and turns with it. */
function turnClips(clips: Clip[], items: Map<string, IsoBuilderItem>): Clip[] {
  const [, depth] = clipBox(clips, items)
  return clips.map(clip => {
    const [, cd] = footprintIn(items, clip)
    return { ...clip, x: depth - clip.y - cd, y: clip.x, rotation: ((clip.rotation + 1) % 4) as IsoRotation }
  })
}

/** A tool on the toolbar: pressed in while it is the one in use. */
function ToolButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return <Box sx={{
    borderRadius: '8px',
    bgcolor: active ? '#f4d98c' : 'transparent',
    boxShadow: active ? `inset 0 0 0 1.5px ${INK}, inset 2px 2px 0 rgba(42,32,36,0.2)` : 'none',
  }}>
    <AppIconButton label={label} tooltip onClick={onClick}>{children}</AppIconButton>
  </Box>
}

/** A button on a map panel: paper, ink outline, pressed on click. */
function PanelButton({ icon, danger = false, highlight = false, onClick, children }: { icon: ReactNode; danger?: boolean; highlight?: boolean; onClick: () => void; children: ReactNode }) {
  return <ButtonBase focusRipple onClick={onClick} sx={{
    justifyContent: 'center', gap: 1, py: 0.6, borderRadius: '6px', border: `1.5px solid ${INK}`,
    bgcolor: danger ? '#e9b3a6' : highlight ? '#f4d98c' : '#e4dac6', backgroundImage: GRAIN, color: INK,
    fontSize: '0.85rem', fontWeight: 600,
    boxShadow: '2px 2px 0 rgba(42,32,36,0.3)',
    '&:active': { transform: 'translate(1px, 1px)', boxShadow: '1px 1px 0 rgba(42,32,36,0.3)' },
  }}>{icon}{children}</ButtonBase>
}

/** A faint paper grain laid over the whole board. */
function makeGrain(ctx: CanvasRenderingContext2D) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 96
  const t = tile.getContext('2d')
  if (!t) return null
  const image = t.createImageData(96, 96)
  const random = mulberry(7)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = random() * 255
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v
    image.data[i + 3] = 20
  }
  t.putImageData(image, 0, 0)
  return ctx.createPattern(tile, 'repeat')
}
