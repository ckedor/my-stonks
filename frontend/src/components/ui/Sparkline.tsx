import { Box } from '@mui/material'
import { useId } from 'react'

interface Props {
  values: number[]
  color: string
  width?: number
  height?: number
  /** Marca o zero, quando ele cai dentro da faixa desenhada. Sem essa linha,
   *  uma curva inteiramente negativa parece igual a uma inteiramente positiva:
   *  o traço é o mesmo, só a escala muda. Ignorado por `bars`, que já mede a
   *  partir do zero. */
  baseline?: number | null
  /** `bars` desenha uma barra por valor, a partir do zero — a série em que
   *  cada valor é um evento que aconteceu, e não uma amostra de algo
   *  contínuo. Padrão: `line`. */
  variant?: 'line' | 'bars'
  /** O que cada valor diz ao passar o mouse, um por valor, já formatado por
   *  quem chama. Sem eles a série mostra a forma e esconde o número, que numa
   *  faixa de seis pagamentos quase iguais é justamente o que se quer ler.
   *  Só em `bars`: uma linha não tem alvo por ponto. */
  titles?: string[]
}

/** Respiro entre barras, em unidades do viewBox. */
const BAR_GAP = 2
const BAR_RADIUS = 2
/** Peso das barras que só dão contexto à última. */
const BAR_QUIET_OPACITY = 0.45

/** Uma série sem eixos, rótulos ou grade — só a forma.
 *
 *  SVG em vez de uma biblioteca de gráficos: em 120×36 pixels não há tooltip,
 *  legenda ou escala para desenhar, e o custo de montar um gráfico de verdade
 *  por linha de uma lista não se paga. */
export default function Sparkline({
  values,
  color,
  width = 120,
  height = 36,
  baseline = 0,
  variant = 'line',
  titles,
}: Props) {
  const gradientId = useId()

  if (values.length < 2) return <Box sx={{ width, height }} />

  if (variant === 'bars') {
    /* Escala a partir do zero, sempre. Cortar a base para "mostrar a
       variação" transformaria seis pagamentos quase iguais numa escada, que
       é exatamente a leitura errada de uma série que mal se moveu. */
    const top = Math.max(...values)
    if (top <= 0) return <Box sx={{ width, height }} />

    const barWidth = (width - BAR_GAP * (values.length - 1)) / values.length

    return (
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        sx={{ width, height, display: 'block' }}
      >
        {values.map((value, index) => {
          const barHeight = Math.max((Math.max(value, 0) / top) * height, 1)
          const last = index === values.length - 1

          return (
            <rect
              key={index}
              x={index * (barWidth + BAR_GAP)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={BAR_RADIUS}
              fill={color}
              opacity={last ? 1 : BAR_QUIET_OPACITY}
            >
              {titles?.[index] && <title>{titles[index]}</title>}
            </rect>
          )
        })}
      </Box>
    )
  }

  const min = Math.min(...values, ...(baseline != null ? [baseline] : []))
  const max = Math.max(...values, ...(baseline != null ? [baseline] : []))
  // Faixa nula (uma série constante) desenharia uma divisão por zero; a curva
  // vai para o meio da altura.
  const span = max - min || 1

  const x = (index: number) => (index / (values.length - 1)) * width
  const y = (value: number) => height - ((value - min) / span) * height

  const points = values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`)
  const line = `M${points.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      sx={{ width, height, display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {baseline != null && baseline > min && baseline < max && (
        <line
          x1={0}
          x2={width}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </Box>
  )
}
