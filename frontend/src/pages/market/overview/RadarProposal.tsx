import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AppButton,
  AppCard,
  AppChartArea,
  AppChip,
  AppDivider,
  AppGrid,
  AppGridItem,
  AppMetric,
  AppSelect,
  AppStack,
  AppTabs,
  AppText,
  SectionLabel,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'
import {
  changeTone,
  markets,
  PERIODS,
  PERIOD_LABEL,
  scenarios,
  signed,
  stories,
  type Period,
} from './mockData'
import { AgendaList, MiniChart, StoryRow, type OpenDetail } from './MarketPieces'

const REGIONS = [
  { id: 'all', label: 'Todos os mercados' },
  { id: 'br', label: 'Brasil' },
  { id: 'world', label: 'Mundo' },
]

export default function RadarProposal({ onOpen }: { onOpen: OpenDetail }) {
  const theme = useAppTheme()
  const [region, setRegion] = useState('all')
  const [period, setPeriod] = useState<Period>('month')
  const [selectedId, setSelectedId] = useState('ibov')
  const visible = markets.filter((m) => region === 'all' || m.region === region)
  const selected = visible.find((m) => m.id === selectedId) ?? visible[0]
  const ranked = useMemo(
    () =>
      markets
        .filter((m) => region === 'all' || m.region === region)
        .map((m) => ({ name: m.title, value: m.changes[period] }))
        .sort((a, b) => b.value - a.value),
    [region, period]
  )
  const positive = ranked.filter((m) => m.value > 0).length
  const related = stories.filter((s) => s.related.includes(selected.id))
  return (
    <AppStack gap="xl">
      <AppStack gap="md">
        <AppStack direction="row" justify="between" align="center" gap="md" wrap>
          <AppStack gap="xs">
            <SectionLabel>O MAPA DO MOMENTO</SectionLabel>
            <SectionTitle>Veja o movimento. Escolha onde aprofundar.</SectionTitle>
          </AppStack>
          <AppSelect
            label="Comparar período"
            size="sm"
            value={period}
            options={PERIODS}
            onChange={(value) => setPeriod(value as Period)}
          />
        </AppStack>
        <AppTabs items={REGIONS} value={region} onChange={setRegion} label="Região do radar" />
      </AppStack>

      <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg" align="start">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppGrid cols={{ xs: 1, sm: 2, md: 3 }} gap="md">
            {visible.map((market) => (
              <AppCard
                key={market.id}
                selected={selected.id === market.id}
                interactive
                role="button"
                tabIndex={0}
                aria-label={`Selecionar ${market.title}`}
                aria-pressed={selected.id === market.id}
                onClick={() => setSelectedId(market.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedId(market.id)
                  }
                }}
              >
                <AppStack gap="sm">
                  <AppStack direction="row" justify="between" align="center" gap="xs">
                    <AppText weight="strong">{market.title}</AppText>
                    <AppText variant="caption" tone="secondary">
                      {market.region === 'br' ? 'BR' : 'GLOBAL'}
                    </AppText>
                  </AppStack>
                  <AppMetric
                    label={PERIOD_LABEL[period]}
                    value={signed(market.changes[period])}
                    size="lg"
                    tone={changeTone(market.changes[period])}
                  />
                  <MiniChart market={market} period={period} height={55} />
                  <AppStack direction="row" justify="between" gap="xs" wrap>
                    <AppText variant="caption" tone="secondary">
                      {market.value}
                    </AppText>
                    <AppText variant="caption">
                      {selected.id === market.id ? 'Em foco ↓' : 'Explorar ↗'}
                    </AppText>
                  </AppStack>
                </AppStack>
              </AppCard>
            ))}
          </AppGrid>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppCard padding="lg">
            <AppStack gap="md">
              <SectionLabel>O MOVIMENTO EM PERSPECTIVA</SectionLabel>
              <AppMetric
                label={`${PERIOD_LABEL[period]}, entre as referências exibidas`}
                value={`${positive} de ${ranked.length} avançaram`}
                size="lg"
              />
              <AppText variant="bodySmall" tone="secondary">
                {ranked[0].name} lidera este recorte. {ranked[ranked.length - 1].name} fica na outra
                ponta.
              </AppText>
              <AppChartArea height={Math.max(200, ranked.length * 31)}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ranked}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fill: theme.palette.chart.label, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={95}
                      tick={{ fill: theme.palette.chart.label, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine x={0} stroke={theme.palette.divider} />
                    <Tooltip formatter={(value) => [signed(Number(value)), PERIOD_LABEL[period]]} />
                    <Bar dataKey="value" barSize={12} radius={3} isAnimationActive={false}>
                      {ranked.map((m) => (
                        <Cell
                          key={m.name}
                          fill={m.value < 0 ? theme.palette.error.main : theme.palette.success.main}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </AppChartArea>
              <AppText variant="caption" tone="secondary">
                Variações nas moedas de origem; CDI pelo rendimento acumulado. Não representa uma
                carteira nem um indicador de amplitude da bolsa.
              </AppText>
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>

      <AppCard padding="lg">
        <AppGrid cols={{ xs: 1, md: 12 }} gap="lg">
          <AppGridItem span={{ xs: 1, md: 4 }}>
            <AppStack gap="md">
              <SectionLabel>{`EM FOCO · ${selected.label}`}</SectionLabel>
              <AppMetric label={selected.title} value={selected.value} size="lg" />
              <MiniChart market={selected} period={period} height={110} />
              <AppText variant="caption" tone="secondary">
                Trajetória ilustrativa · base 100
              </AppText>
            </AppStack>
          </AppGridItem>
          <AppGridItem span={{ xs: 1, md: 8 }}>
            <AppStack gap="md">
              <SectionTitle>{selected.summary}</SectionTitle>
              <AppText tone="secondary" variant="bodySmall">
                {selected.sections[0].text}
              </AppText>
              <AppDivider />
              <AppGrid cols={{ xs: 1, sm: 2 }} gap="md">
                <AppStack gap="sm">
                  <SectionLabel>A PRÓXIMA PERGUNTA</SectionLabel>
                  <AppText variant="bodySmall">{selected.sections[1].text}</AppText>
                </AppStack>
                <AppStack gap="sm">
                  <SectionLabel>CONEXÕES COM AS NOTÍCIAS</SectionLabel>
                  {related.map((story) => (
                    <AppButton
                      key={story.id}
                      emphasis="ghost"
                      size="sm"
                      onClick={() => onOpen(story)}
                    >
                      {story.title} ↗
                    </AppButton>
                  ))}
                </AppStack>
              </AppGrid>
              <AppStack direction="row">
                <AppButton emphasis="outline" onClick={() => onOpen(selected)}>
                  Abrir leitura completa →
                </AppButton>
              </AppStack>
            </AppStack>
          </AppGridItem>
        </AppGrid>
      </AppCard>

      <AppStack gap="md">
        <AppStack direction="row" justify="between" gap="sm" wrap>
          <AppStack gap="xs">
            <SectionLabel>PARA ONDE ISSO PODE IR</SectionLabel>
            <SectionTitle>O cenário muda quando os sinais mudam</SectionTitle>
          </AppStack>
          <AppChip label="Hipóteses · 3–6 meses" emphasis="outline" />
        </AppStack>
        <AppGrid cols={{ xs: 1, md: 3 }} gap="md">
          {scenarios.map((scenario, index) => (
            <AppCard key={scenario.id} padding="lg">
              <AppStack gap="md">
                <AppStack direction="row" justify="between" align="center">
                  <SectionLabel>{`0${index + 1}`}</SectionLabel>
                  <AppChip
                    label={index === 0 ? 'Referência' : index === 1 ? 'Alívio' : 'Pressão'}
                    emphasis="outline"
                  />
                </AppStack>
                <SectionTitle>{scenario.title}</SectionTitle>
                <AppText variant="bodySmall" tone="secondary">
                  {scenario.summary}
                </AppText>
                <AppDivider />
                <SectionLabel>SINAL PARA ACOMPANHAR</SectionLabel>
                <AppText variant="bodySmall">{scenario.trigger}</AppText>
                <AppText variant="caption" tone="secondary">
                  {scenario.affected}
                </AppText>
                <AppButton emphasis="ghost" size="sm" onClick={() => onOpen(scenario)}>
                  Condições e contrapontos →
                </AppButton>
              </AppStack>
            </AppCard>
          ))}
        </AppGrid>
      </AppStack>

      <AppGrid cols={{ xs: 1, lg: 12 }} gap="xl" align="start">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppStack gap="lg">
            <AppStack gap="xs">
              <SectionLabel>O QUE ESTÁ POR TRÁS DOS NÚMEROS</SectionLabel>
              <SectionTitle>Notícias do seu recorte</SectionTitle>
            </AppStack>
            {stories
              .filter((s) => region === 'all' || s.region === region)
              .map((story) => (
                <StoryRow key={story.id} story={story} onOpen={onOpen} />
              ))}
          </AppStack>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppCard padding="lg">
            <AgendaList onOpen={onOpen} />
          </AppCard>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
