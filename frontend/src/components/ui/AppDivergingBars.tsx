import { Box, useTheme } from '@mui/material'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import AppFloatingCard from './AppFloatingCard'

/* Barras horizontais que saem de uma linha de zero, para cada lado.
 *
 * Diferente do `AppBarChart`, que compara grandezas todas do mesmo sinal:
 * aqui o que se lê de relance é quem está acima e quem está abaixo de zero,
 * e por isso a linha do zero não fica na borda — ela se move conforme o
 * quanto o pior e o melhor se afastam.
 *
 * A cor é do sinal, não de quem chama: verde acima e vermelho abaixo é a
 * mesma leitura em qualquer métrica que atravesse o zero. */

const BAR_HEIGHT = 28
const BAR_GAP = 4
/** Coluna dos rótulos, à esquerda da linha do zero. */
const LABEL_WIDTH = 140
const LABEL_FONT_SIZE = 11
const PADDING_RIGHT = 12
const MIN_HEIGHT = 100
/** Abaixo disso o valor não cabe dentro da barra e fica de fora. */
const MIN_WIDTH_FOR_VALUE = 50
const BAR_OPACITY = 0.85
const TOOLTIP_WIDTH = 240
const TOOLTIP_OFFSET = 12

export interface AppDivergingBar {
  key: string | number
  /** Nome à esquerda da linha do zero. */
  label: string
  /** Comprimento e lado da barra. */
  value: number
  /** O valor escrito dentro da barra, já formatado. */
  display: string
}

export interface AppDivergingBarsProps {
  /** Na ordem em que serão desenhadas, de cima para baixo. */
  bars: AppDivergingBar[]
  onSelect?: (key: string | number) => void
  /** Conteúdo do balão que segue o cursor. Sem ela, não há balão. */
  renderTooltip?: (bar: AppDivergingBar) => ReactNode
}

export default function AppDivergingBars({ bars, onSelect, renderTooltip }: AppDivergingBarsProps) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<{ bar: AppDivergingBar; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const values = bars.map((bar) => bar.value)
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 0)
  const range = maxValue - minValue || 1

  const barAreaWidth = Math.max(width - LABEL_WIDTH - PADDING_RIGHT, 0)
  const zeroX = LABEL_WIDTH + (barAreaWidth * -minValue) / range
  const pxPerUnit = barAreaWidth / range
  const totalHeight = bars.length * (BAR_HEIGHT + BAR_GAP)

  return (
    <Box
      ref={containerRef}
      sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto' }}
      onMouseLeave={() => setHovered(null)}
    >
      {width > 0 && (
        <svg width={width} height={Math.max(totalHeight, MIN_HEIGHT)}>
          <line
            x1={zeroX}
            y1={0}
            x2={zeroX}
            y2={totalHeight}
            stroke={theme.palette.divider}
            strokeWidth={1}
          />

          {bars.map((bar, index) => {
            const y = index * (BAR_HEIGHT + BAR_GAP)
            const isPositive = bar.value >= 0
            const fullWidth = Math.abs(bar.value * pxPerUnit)
            /* A barra nunca invade a coluna dos rótulos: sem isso, o pior
               valor da lista escreve por cima do próprio nome. */
            const rawX = isPositive ? zeroX : zeroX - fullWidth
            const barX = Math.max(rawX, LABEL_WIDTH)
            const barWidth = Math.max(fullWidth - (barX - rawX), 0)

            return (
              <g
                key={bar.key}
                cursor={onSelect ? 'pointer' : undefined}
                onClick={onSelect ? () => onSelect(bar.key) : undefined}
                onMouseMove={(event) => {
                  const bounds = containerRef.current?.getBoundingClientRect()
                  if (!bounds) return
                  setHovered({
                    bar,
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                  })
                }}
              >
                <text
                  x={LABEL_WIDTH - 8}
                  y={y + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={LABEL_FONT_SIZE}
                  fontWeight={600}
                  fill={theme.palette.text.primary}
                >
                  {bar.label}
                </text>

                <rect
                  x={barX}
                  y={y + 2}
                  width={Math.max(barWidth, 1)}
                  height={BAR_HEIGHT - 4}
                  rx={3}
                  fill={isPositive ? theme.palette.success.main : theme.palette.error.main}
                  opacity={BAR_OPACITY}
                />

                {barWidth > MIN_WIDTH_FOR_VALUE && (
                  <text
                    x={isPositive ? barX + barWidth - 4 : barX + 4}
                    y={y + BAR_HEIGHT / 2}
                    textAnchor={isPositive ? 'end' : 'start'}
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight={600}
                    fill="#fff"
                  >
                    {bar.display}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {hovered && renderTooltip && (
        <AppFloatingCard
          width={TOOLTIP_WIDTH}
          left={Math.min(hovered.x + TOOLTIP_OFFSET, Math.max(width - TOOLTIP_WIDTH - TOOLTIP_OFFSET, 0))}
          top={hovered.y + TOOLTIP_OFFSET}
        >
          {renderTooltip(hovered.bar)}
        </AppFloatingCard>
      )}
    </Box>
  )
}
