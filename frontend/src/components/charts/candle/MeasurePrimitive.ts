import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  IChartApi,
  SeriesType,
  Time,
} from 'lightweight-charts'
import { measureBetween, type MeasureAnchor } from './helpers'

export interface MeasureColors {
  /** Fill and outline when the second anchor is above the first. */
  up: string
  /** Fill and outline when it is below. */
  down: string
  /** Background of the readout box. */
  surface: string
  /** Text inside the readout box. */
  text: string
}

/** Opacity of the shaded area between the two anchors. Low enough that candles
 *  stay readable through it. */
const FILL_ALPHA = 0.12
const LABEL_PADDING = 6
const LABEL_GAP = 8
const LABEL_RADIUS = 4
const LABEL_FONT = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

const signed = (value: number, digits = 2) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`

class MeasureRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly points: { x: number; y: number }[],
    private readonly lines: string[],
    private readonly colors: MeasureColors,
    private readonly rising: boolean,
  ) {}

  draw(target: {
    useMediaCoordinateSpace: (fn: (scope: { context: CanvasRenderingContext2D }) => void) => void
  }): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const [from, to] = this.points
      const accent = this.rising ? this.colors.up : this.colors.down

      ctx.save()

      if (to) {
        const left = Math.min(from.x, to.x)
        const top = Math.min(from.y, to.y)
        const width = Math.abs(to.x - from.x)
        const height = Math.abs(to.y - from.y)

        ctx.fillStyle = accent
        ctx.globalAlpha = FILL_ALPHA
        ctx.fillRect(left, top, width, height)
        ctx.globalAlpha = 1

        ctx.strokeStyle = accent
        ctx.lineWidth = 1
        ctx.strokeRect(left, top, width, height)

        // The diagonal is what the user is actually reading: it connects the
        // two prices they picked rather than the corners of the box.
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()
      }

      for (const point of this.points) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = accent
        ctx.fill()
      }

      if (this.lines.length && to) {
        this.drawLabel(ctx, to, accent)
      }

      ctx.restore()
    })
  }

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    anchor: { x: number; y: number },
    accent: string,
  ): void {
    ctx.font = LABEL_FONT
    ctx.textBaseline = 'top'

    const lineHeight = 15
    const width = Math.max(...this.lines.map((line) => ctx.measureText(line).width))
    const boxWidth = width + LABEL_PADDING * 2
    const boxHeight = this.lines.length * lineHeight + LABEL_PADDING * 2
    const x = anchor.x + LABEL_GAP
    const y = anchor.y - boxHeight / 2

    ctx.beginPath()
    ctx.roundRect(x, y, boxWidth, boxHeight, LABEL_RADIUS)
    ctx.fillStyle = this.colors.surface
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = this.colors.text
    this.lines.forEach((line, index) => {
      ctx.fillText(line, x + LABEL_PADDING, y + LABEL_PADDING + index * lineHeight)
    })
  }
}

/**
 * Draws the span between two points the user picked, labelled with the change
 * between them.
 *
 * The library has no measure tool of its own -- that belongs to TradingView's
 * separate charting product -- so this is built on the primitive API, which
 * draws inside the chart's own canvas. That is what makes the measurement stick
 * to the data: anchors are held as time and price, and are re-projected to
 * pixels on every frame, so panning and zooming move it with the candles and a
 * log or percentage axis bends it the same way it bends the series.
 */
export class MeasurePrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null
  private series: ISeriesApi<SeriesType, Time> | null = null
  private requestUpdate?: () => void
  private anchors: MeasureAnchor[] = []
  private paneView: IPrimitivePaneView

  constructor(
    private colors: MeasureColors,
    /** Formats the absolute change; the percentage is formatted here. */
    private formatPrice: (value: number) => string = (value) => signed(value),
  ) {
    this.paneView = {
      zOrder: () => 'top',
      renderer: () => this.buildRenderer(),
    }
  }

  attached(param: {
    chart: IChartApi
    series: ISeriesApi<SeriesType, Time>
    requestUpdate: () => void
  }): void {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }

  detached(): void {
    this.chart = null
    this.series = null
    this.requestUpdate = undefined
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView]
  }

  /** Add a point, or start over once two are already down. */
  addAnchor(anchor: MeasureAnchor): void {
    this.anchors = this.anchors.length >= 2 ? [anchor] : [...this.anchors, anchor]
    this.requestUpdate?.()
  }

  clear(): void {
    this.anchors = []
    this.requestUpdate?.()
  }

  getAnchors(): MeasureAnchor[] {
    return this.anchors
  }

  setAnchors(anchors: MeasureAnchor[]): void {
    this.anchors = anchors.slice(0, 2)
    this.requestUpdate?.()
  }

  setColors(colors: MeasureColors): void {
    this.colors = colors
    this.requestUpdate?.()
  }

  private buildRenderer(): IPrimitivePaneRenderer | null {
    if (!this.anchors.length || !this.chart || !this.series) return null

    const timeScale = this.chart.timeScale()
    const points: { x: number; y: number }[] = []
    for (const anchor of this.anchors) {
      const x = timeScale.timeToCoordinate(anchor.time as Time)
      const y = this.series.priceToCoordinate(anchor.price)
      // An anchor scrolled out of the visible range has no coordinate; there is
      // nothing sensible to draw for a half-placed measurement.
      if (x === null || y === null) return null
      points.push({ x, y })
    }

    const [from, to] = this.anchors
    const measurement = to ? measureBetween(from, to) : null
    const lines = measurement
      ? [
          `${signed(measurement.variation * 100)}%`,
          this.formatPrice(measurement.absolute),
          `${measurement.days} ${measurement.days === 1 ? 'dia' : 'dias'}`,
        ]
      : []

    return new MeasureRenderer(points, lines, this.colors, (measurement?.variation ?? 0) >= 0)
  }
}
