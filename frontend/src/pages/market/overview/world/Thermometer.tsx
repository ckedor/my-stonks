import { useState } from 'react'
import {
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
} from 'recharts'
import type { LevelReading } from '@/api/market'
import {
  AppCard,
  AppChartArea,
  AppInlineToggle,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'
import {
  PERCENTILE_ZONE_LABEL,
  percentileLabel,
  percentileZone,
  thermometerDomain,
  thermometerRows,
  type PercentileZone,
  type ThermometerMetric,
  type ThermometerRow,
} from './readings'

const METRICS: { value: ThermometerMetric; label: string }[] = [
  { value: 'trend', label: 'Distância da tendência' },
  { value: 'decade', label: 'Retorno de 10 anos' },
  { value: 'drawdown', label: 'Queda desde o topo' },
]

/** O que cada pergunta mede, e como ler o lado direito da régua. */
const QUESTION: Record<
  ThermometerMetric,
  { ask: string; read: string; left: string; right: string }
> = {
  trend: {
    ask: 'Quão longe o preço está da própria média de 40 semanas, comparado com todas as semanas da história do mercado.',
    read: 'À direita, esticado para cima como poucas vezes; à esquerda, afundado abaixo da tendência como poucas vezes. O meio é o normal.',
    left: 'Abaixo da tendência como raramente',
    right: 'Acima da tendência como raramente',
  },
  decade: {
    ask: 'O retorno anual dos últimos 10 anos, comparado com todas as janelas de 10 anos da história do mercado.',
    read: 'À direita, uma década melhor que quase todas as anteriores; à esquerda, uma década perdida. Só entra quem tem mais de 10 anos de histórico com folga.',
    left: 'Década das piores',
    right: 'Década das melhores',
  },
  drawdown: {
    ask: 'Quanto o preço está abaixo da máxima semanal da própria história.',
    read: 'Em pontos percentuais, não em percentil: no zero, está no topo; quanto mais à esquerda, mais fundo o buraco.',
    left: 'Mais longe do topo',
    right: 'No topo',
  },
}

const ROW_HEIGHT = 38

/** As faixas da régua de percentil: os 10% e os 30% de cada ponta. */
const BANDS: { from: number; to: number; strong: boolean }[] = [
  { from: 0, to: 10, strong: true },
  { from: 10, to: 30, strong: false },
  { from: 70, to: 90, strong: false },
  { from: 90, to: 100, strong: true },
]

const PERCENTILE_TICKS = [0, 10, 30, 50, 70, 90, 100]

/** Onde cada mercado está na própria história, uma pergunta por vez.
 *
 *  Um pirulito por mercado: a haste sai do meio da régua — o percentil 50,
 *  ou o topo, na queda — e vai até o número de hoje, então o comprimento é
 *  o quanto ele foge do normal. A régua vai só até onde os pontos chegam,
 *  com folga; as faixas marcam os decis e quintis das pontas, onde o número
 *  é raro. A ordem é a da régua, então o topo da lista é quem está mais
 *  extremo. */
export default function Thermometer({ readings }: { readings: LevelReading[] }) {
  const theme = useAppTheme()
  const [metric, setMetric] = useState<ThermometerMetric>('trend')
  const { rows, missing } = thermometerRows(readings, metric)
  const question = QUESTION[metric]
  const isDrawdown = metric === 'drawdown'
  const domain = thermometerDomain(rows, metric)
  const [low, high] = domain
  const anchor = isDrawdown ? 0 : 50
  const band = theme.palette.chart.label
  const ticks = isDrawdown
    ? undefined
    : [...new Set([low, ...PERCENTILE_TICKS.filter((tick) => tick > low && tick < high), high])]
  /* Quente acima do meio, frio abaixo, e tanto mais forte quanto mais rara
     a faixa: a cor repete a posição, para a lista ler de relance. A queda
     não tem faixa nem meio, e fica numa cor só. */
  const ZONE_STRENGTH: Record<PercentileZone, number> = {
    'very-high': 1,
    high: 0.75,
    middle: 0.45,
    low: 0.75,
    'very-low': 1,
  }
  const paintOf = (row: ThermometerRow) => {
    const zone = percentileZone(row.percentile)
    if (isDrawdown || zone == null) return { color: theme.palette.chart.colors[0], strength: 1 }
    return {
      color: row.position >= anchor ? theme.palette.primary.main : theme.palette.chart.colors[0],
      strength: ZONE_STRENGTH[zone],
    }
  }

  return (
    <AppStack gap="md">
      <AppStack gap="xs">
        <SectionLabel>O TERMÔMETRO</SectionLabel>
        <SectionTitle>Onde cada mercado está na própria história</SectionTitle>
      </AppStack>
      <AppCard padding="lg">
        <AppStack gap="md">
          <AppInlineToggle options={METRICS} value={metric} onChange={setMetric} />
          <AppStack gap="xs">
            <AppText variant="bodySmall">{question.ask}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {question.read}
            </AppText>
          </AppStack>
          <AppChartArea height={rows.length * ROW_HEIGHT + 48}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                {!isDrawdown &&
                  BANDS.map(({ from, to, strong }) => {
                    const x1 = Math.max(from, low)
                    const x2 = Math.min(to, high)
                    return x1 < x2 ? (
                      <ReferenceArea
                        key={from}
                        x1={x1}
                        x2={x2}
                        fill={band}
                        fillOpacity={strong ? 0.12 : 0.05}
                        stroke="none"
                      />
                    ) : null
                  })}
                <ReferenceLine x={anchor} stroke={theme.palette.divider} strokeWidth={1.5} />
                <XAxis
                  type="number"
                  dataKey="position"
                  domain={domain}
                  ticks={ticks}
                  allowDataOverflow
                  tickFormatter={(value: number) => (isDrawdown ? `${value}%` : `${value}`)}
                  tick={{ fill: theme.palette.chart.label, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={170}
                  tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDuplicatedCategory={false}
                  // Num gráfico de dispersão a categoria empilha de baixo para
                  // cima; sem isto a primeira linha da ordem ia para o fim.
                  reversed
                />
                <Tooltip cursor={false} content={<RowTooltip metric={metric} />} />
                <Scatter
                  data={rows}
                  isAnimationActive={false}
                  shape={(shapeProps: unknown) => {
                    const props = shapeProps as LollipopProps
                    return (
                      <Lollipop
                        {...props}
                        anchor={anchor}
                        domain={domain}
                        {...paintOf(props.payload)}
                        track={theme.palette.divider}
                        halo={theme.palette.background.paper}
                        label={theme.palette.text.primary}
                      />
                    )
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </AppChartArea>
          <AppStack direction="row" justify="between" gap="sm">
            <AppText variant="caption" tone="secondary">
              ← {question.left}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {question.right} →
            </AppText>
          </AppStack>
          <AppText variant="caption" tone="secondary">
            {isDrawdown
              ? 'Ordem: do mais longe do topo para o mais perto. A régua vai até a queda mais funda de hoje.'
              : 'Ordem: do mais alto na própria história para o mais baixo. A haste parte do percentil 50; as faixas são os 10% e os 30% das pontas, e a régua vai só até onde os pontos chegam.'}
            {missing.length > 0 && ` Sem histórico para esta pergunta: ${missing.join(', ')}.`}
          </AppText>
        </AppStack>
      </AppCard>
    </AppStack>
  )
}

interface LollipopProps {
  cx?: number
  cy?: number
  payload: ThermometerRow
}

/** Um mercado na régua: o trilho da linha inteira, a haste do meio até o
 *  número e o ponto, com o valor do lado de fora da haste. A escala do eixo
 *  não chega ao desenho do ponto, então a posição do meio sai da área do
 *  gráfico e do domínio, que são os mesmos que o eixo usa. */
function Lollipop({
  cx,
  cy,
  payload,
  anchor,
  domain,
  color,
  strength,
  track,
  halo,
  label,
}: LollipopProps & {
  anchor: number
  domain: [number, number]
  color: string
  /** Opacidade da haste e do ponto: 1 nas pontas raras, menos no meio. */
  strength: number
  track: string
  halo: string
  label: string
}) {
  const plot = usePlotArea()
  if (cx == null || cy == null || plot == null) return null
  const [low, high] = domain
  const anchorX = plot.x + ((anchor - low) / (high - low)) * plot.width
  const outward = cx >= anchorX ? 1 : -1
  return (
    <g>
      <line x1={plot.x} x2={plot.x + plot.width} y1={cy} y2={cy} stroke={track} strokeWidth={1} />
      <line
        x1={anchorX}
        x2={cx}
        y1={cy}
        y2={cy}
        stroke={color}
        strokeOpacity={strength}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={7.5} fill={halo} />
      <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={strength} />
      <text
        x={cx + outward * 13}
        y={cy}
        dominantBaseline="central"
        textAnchor={outward > 0 ? 'start' : 'end'}
        fill={label}
        fontSize={11}
        fontWeight={600}
      >
        {payload.value}
      </text>
    </g>
  )
}

function RowTooltip({
  metric,
  active,
  payload,
}: {
  metric: ThermometerMetric
  active?: boolean
  payload?: { payload: ThermometerRow }[]
}) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  const zone = percentileZone(row.percentile)
  return (
    <AppCard padding="sm">
      <AppStack gap="none">
        <AppText variant="bodySmall" weight="strong">
          {row.name}
        </AppText>
        <AppText variant="bodySmall">{row.value}</AppText>
        {metric !== 'drawdown' && (
          <AppText variant="caption" tone="secondary">
            {percentileLabel(row.percentile)}
            {zone ? ` · ${PERCENTILE_ZONE_LABEL[zone].toLowerCase()}` : ''}
          </AppText>
        )}
      </AppStack>
    </AppCard>
  )
}
