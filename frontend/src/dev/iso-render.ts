import { assetBuildingItem, parseAssetBuildingId } from '@/components/city-game/asset-buildings'
import { itemPrice } from '@/components/city-game/economy'
import { HALF_H, HALF_W, meters, renderSprite, type Recipe, type Sprite } from '@/components/ui/iso/engine'
import { ISO_RECIPES, type IsoRecipeKey } from '@/components/ui/iso/recipes'
import { isoPieceMeasure } from '@/components/ui/iso/volume'

/* A folha de estudo de uma peça, para quem modela olhar o que desenhou:
   a referência à esquerda, a peça do lado, com régua em metros, e as outras
   três vistas. `scripts/iso-render.mjs` abre esta página num Chromium sem
   tela e grava a folha em PNG. Não é teste — não compara pixel com nada. */

/** O chão do tabuleiro, para a peça aparecer como no jogo. */
const GROUND = '#d3cdc2'
const INK = '#2a2024'
const VIEW_HEIGHT = 860
const GAP = 40
const HEADER = 56
const SWATCHES = 64

type Band = 'top' | 'mid' | 'base'

interface Options {
  recipe: string
  /** A foto de referência, como data URL. */
  reference?: string
  /** Um terço da vista principal, de perto, para conferir detalhe. */
  band?: Band
  /** Qual quarto de volta vai grande. */
  rotation?: number
}

interface Placed { sprite: Sprite; x: number; y: number; scale: number; crop?: [number, number] }

async function render({ recipe: key, reference, band, rotation = 0 }: Options) {
  // Uma escultura de ativo não está no catálogo: nasce do id do prédio,
  // como `asset-building:FII:XPML11:20000`.
  const asset = parseAssetBuildingId(key)
  if (!asset && !Object.hasOwn(ISO_RECIPES, key)) throw new Error(`Receita desconhecida: ${key}`)
  const recipe: Recipe = asset ? assetBuildingItem(asset).recipe as Recipe : ISO_RECIPES[key as IsoRecipeKey]
  await recipe.ready
  const [w, d] = recipe.size
  const measure = isoPieceMeasure(recipe)
  const price = asset ? 0 : itemPrice({ id: key, label: key, group: '', subgroup: '', recipe })

  // O tamanho a escala 1 decide a escala da vista.
  const probe = renderSprite(recipe, rotation, 1, 7)
  const fit = (box: number) => Math.min(8, box / probe.height, 900 / probe.width)
  const mainScale = band ? Math.min(16, fit(VIEW_HEIGHT) * 3) : fit(VIEW_HEIGHT)
  const main = renderSprite(recipe, rotation, mainScale, 7)
  const third = main.canvas.height / 3
  const crop: [number, number] | undefined = band
    ? [{ top: 0, mid: third, base: third * 2 }[band], third]
    : undefined

  const image = reference ? await loadImage(reference) : null
  const refScale = image ? Math.min(1, VIEW_HEIGHT / image.height, 800 / image.width) : 0
  const refWidth = image ? image.width * refScale : 0

  const ruler = 70
  const x0 = GAP + (image ? refWidth + GAP : 0) + ruler
  const placed: Placed[] = [{ sprite: main, x: x0, y: HEADER, scale: mainScale, crop }]
  let width = x0 + main.canvas.width + GAP
  if (!band) {
    // As outras três vistas, empilhadas à direita.
    const small = (VIEW_HEIGHT - GAP * 2) / 3
    let y = HEADER
    for (let r = 1; r < 4; r++) {
      const turn = (rotation + r) % 4
      const p = renderSprite(recipe, turn, 1, 7)
      const s = Math.min(4, small / p.height, 360 / p.width)
      const sprite = renderSprite(recipe, turn, s, 7)
      placed.push({ sprite, x: width, y, scale: s })
      y += small + GAP
    }
    width += Math.max(...placed.slice(1).map(p => p.sprite.canvas.width)) + GAP
  }

  const sheet = document.createElement('canvas')
  sheet.width = Math.ceil(width)
  sheet.height = HEADER + VIEW_HEIGHT + GAP + (image ? SWATCHES : 0)
  const ctx = sheet.getContext('2d')!
  ctx.fillStyle = GROUND
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  ctx.fillStyle = INK
  ctx.font = '600 20px sans-serif'
  const summary = `${key} · ${w}×${d} lotes (${w * 12}×${d * 12} m) · altura ${measure.height.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m · volume ${Math.round(measure.volume).toLocaleString('pt-BR')} m³ · US$ ${price.toLocaleString('pt-BR')}`
  ctx.fillText(band ? `${summary} · ${band}` : summary, GAP, 34)

  const palette = image ? paletteOf(image) : []
  if (image) {
    ctx.drawImage(image, GAP, HEADER, refWidth, image.height * refScale)
    drawPalette(ctx, palette, GAP, HEADER + VIEW_HEIGHT + GAP / 2)
  }
  for (const p of placed) paste(ctx, p)
  if (!band) drawRuler(ctx, main, mainScale, x0 - ruler + 20, HEADER, recipe.size, rotation, measure.height)

  return { dataUrl: sheet.toDataURL('image/png'), size: [w, d], height: measure.height, volume: measure.volume, price, palette }
}

/** Como o tabuleiro compõe: chão, sombra a 24%, corpo. */
function paste(ctx: CanvasRenderingContext2D, { sprite, x, y, crop }: Placed) {
  const [sy, sh] = crop ?? [0, sprite.canvas.height]
  const layer = (source: HTMLCanvasElement) =>
    ctx.drawImage(source, 0, sy, source.width, sh, x, y, source.width, sh)
  if (sprite.ground) layer(sprite.ground)
  if (sprite.shadow) { ctx.globalAlpha = 0.24; layer(sprite.shadow); ctx.globalAlpha = 1 }
  layer(sprite.canvas)
}

/** Uma régua vertical que nasce no canto da frente do lote. */
function drawRuler(
  ctx: CanvasRenderingContext2D, sprite: Sprite, scale: number, x: number, y: number,
  [w, d]: [number, number], rotation: number, height: number,
) {
  const [fw, fd] = rotation % 2 ? [d, w] : [w, d]
  const ground = y + (sprite.anchor[1] + (fw + fd) * HALF_H) * scale
  const perMetre = meters(1) * scale
  const step = height > 400 ? 100 : height > 80 ? 50 : 10
  const top = Math.max(step, Math.ceil(height / step) * step)
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = 1.5
  ctx.font = '13px sans-serif'
  ctx.beginPath()
  ctx.moveTo(x, ground)
  ctx.lineTo(x, ground - top * perMetre)
  for (let m = 0; m <= top; m += step / 5) {
    const major = m % step === 0
    ctx.moveTo(x, ground - m * perMetre)
    ctx.lineTo(x + (major ? 12 : 6), ground - m * perMetre)
    if (major) ctx.fillText(`${m} m`, x + 16, ground - m * perMetre + 4)
  }
  ctx.stroke()
  // Um lote de 12 m no chão, para a escala na horizontal.
  const lot = HALF_W * scale
  ctx.beginPath()
  ctx.moveTo(x, ground + 18)
  ctx.lineTo(x + lot, ground + 18)
  ctx.stroke()
  ctx.fillText('12 m', x, ground + 34)
}

/** As cores dominantes da foto, da mais presente à menos: k-médias sobre
 *  uma cópia pequena. Cor tirada de olho de uma foto sai errada; esta sai
 *  dos pixels. */
function paletteOf(image: HTMLImageElement, k = 10): { hex: string; share: number }[] {
  const side = 96
  const scale = Math.min(1, side / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const pixels: [number, number, number][] = []
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) pixels.push([data[i], data[i + 1], data[i + 2]])
  if (!pixels.length) return []
  // Sementes espalhadas pelo brilho, para o escuro e o claro terem vez.
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  let centres = Array.from({ length: k }, (_, i) => sorted[Math.floor((i + 0.5) * sorted.length / k)])
  let owner = new Array<number>(pixels.length).fill(0)
  for (let round = 0; round < 12; round++) {
    owner = pixels.map(p => {
      let best = 0, bestDistance = Infinity
      centres.forEach((c, i) => {
        const distance = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
        if (distance < bestDistance) { best = i; bestDistance = distance }
      })
      return best
    })
    centres = centres.map((c, i) => {
      const mine = pixels.filter((_, j) => owner[j] === i)
      return mine.length
        ? [0, 1, 2].map(ch => mine.reduce((sum, p) => sum + p[ch], 0) / mine.length) as [number, number, number]
        : c
    })
  }
  const hex = (c: number[]) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  return centres
    .map((c, i) => ({ hex: hex(c), share: owner.filter(o => o === i).length / pixels.length }))
    .filter(swatch => swatch.share > 0.005)
    .sort((a, b) => b.share - a.share)
}

function drawPalette(ctx: CanvasRenderingContext2D, palette: { hex: string; share: number }[], x: number, y: number) {
  ctx.font = '12px monospace'
  palette.forEach((swatch, i) => {
    const left = x + i * 104
    ctx.fillStyle = swatch.hex
    ctx.fillRect(left, y, 94, 30)
    ctx.strokeStyle = INK
    ctx.strokeRect(left, y, 94, 30)
    ctx.fillStyle = INK
    ctx.fillText(`${swatch.hex} ${Math.round(swatch.share * 100)}%`, left, y + 46)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Referência não carregou'))
    image.src = src
  })
}

declare global {
  interface Window { isoRender?: typeof render }
}
window.isoRender = render
