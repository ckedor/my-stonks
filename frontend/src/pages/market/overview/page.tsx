import {
  AppCard,
  AppChartArea,
  AppChip,
  AppGrid,
  AppGridItem,
  AppMetric,
  AppSimpleTable,
  AppStack,
  AppStackItem,
  AppTabs,
  AppText,
  SectionLabel,
  SectionTitle,
  useAppTheme,
  type AppSimpleTableColumn,
} from '@/components/ui'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import CurrencyBitcoinRoundedIcon from '@mui/icons-material/CurrencyBitcoinRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded'
import NewspaperRoundedIcon from '@mui/icons-material/NewspaperRounded'
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded'
import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  assetPulse,
  brazilRows,
  globalRows,
  marketSeries,
  news,
  portfolioImpacts,
  usRows,
  type AssetPulse,
  type MarketRow,
  type MarketSeries,
  type Trend,
  type Valuation,
} from './mockData'

const changeTone = (value: number): 'success' | 'danger' | 'secondary' =>
  value > 0 ? 'success' : value < 0 ? 'danger' : 'secondary'
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`

const brazilSeries = marketSeries.filter((series) => ['cdi', 'ipca', 'ibov'].includes(series.key))
const usSeries = marketSeries.filter((series) => ['sp500', 'nasdaq', 'usd'].includes(series.key))
const worldSeries = marketSeries.filter((series) => ['btc', 'msci'].includes(series.key))
const brazilPulse = assetPulse.filter((item) => item.region === 'BR')
const usPulse = assetPulse.filter((item) => item.region === 'US')
const worldPulse = assetPulse.filter((item) => item.region === 'WORLD')
const brazilNews = news.filter((item) => item.region === 'BR')
const usNews = news.filter((item) => item.region === 'US')
const worldNews = news.filter((item) => item.region === 'WORLD')
const brazilImpacts = portfolioImpacts.filter((item) => item.region === 'BR')
const usImpacts = portfolioImpacts.filter((item) => item.region === 'US')
const worldImpacts = portfolioImpacts.filter((item) => item.region === 'WORLD')

const CHART_HEIGHT = 100

/** Cabeçalho de um bloco da página: a sobrancelha diz de que assunto ele
 *  trata, o título nomeia o bloco e a linha abaixo explica o que se lê ali. */
function BlockHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <AppStack gap="none">
      {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
      <SectionTitle>{title}</SectionTitle>
      {description && (
        <AppText variant="bodySmall" tone="secondary">
          {description}
        </AppText>
      )}
    </AppStack>
  )
}

function MarketChartCard({ series }: { series: MarketSeries }) {
  const theme = useAppTheme()
  const gradientId = `market-gradient-${series.key}`

  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack direction="row" justify="between" align="start" gap="sm">
          <AppMetric label={series.name} value={series.value} />
          <AppChip
            label={`+${series.change12m.toFixed(1).replace('.', ',')}%`}
            tone="success"
          />
        </AppStack>

        <AppChartArea height={CHART_HEIGHT}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series.data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={series.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={series.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)} pts`, 'Base 100']}
                labelStyle={{ color: theme.palette.text.secondary }}
                contentStyle={{
                  borderRadius: 8,
                  borderColor: theme.palette.divider,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={series.color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </AppChartArea>

        <AppText variant="caption" tone="secondary">
          12 meses · base 100
        </AppText>
      </AppStack>
    </AppCard>
  )
}

const TREND_ICON: Record<Trend, { icon: React.ReactNode; tone: 'success' | 'danger' | 'secondary' }> = {
  Alta: { icon: <ArrowUpwardRoundedIcon fontSize="small" />, tone: 'success' },
  Queda: { icon: <ArrowDownwardRoundedIcon fontSize="small" />, tone: 'danger' },
  Lateral: { icon: <ArrowForwardRoundedIcon fontSize="small" />, tone: 'secondary' },
}

function TrendBadge({ trend }: { trend: Trend }) {
  const { icon, tone } = TREND_ICON[trend]
  return (
    <AppStack direction="row" gap="xs" align="center" justify="end">
      <AppText variant="caption" weight="strong" tone={tone}>
        {trend}
      </AppText>
      {icon}
    </AppStack>
  )
}

function MarketTable({
  title,
  icon,
  rows,
}: {
  title: string
  icon: React.ReactNode
  rows: MarketRow[]
}) {
  const columns: AppSimpleTableColumn<MarketRow>[] = [
    {
      label: 'Indicador',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" noWrap>
          {row.name}
        </AppText>
      ),
    },
    {
      label: 'Atual',
      align: 'right',
      render: (row) => (
        <AppText variant="bodySmall" noWrap>
          {row.value}
        </AppText>
      ),
    },
    {
      label: 'Mês',
      align: 'right',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" tone={changeTone(row.month)}>
          {signed(row.month)}
        </AppText>
      ),
    },
    {
      label: '12M',
      align: 'right',
      render: (row) => (
        <AppText variant="bodySmall" weight="strong" tone={changeTone(row.year)}>
          {signed(row.year)}
        </AppText>
      ),
    },
    { label: 'Tendência', align: 'right', render: (row) => <TrendBadge trend={row.trend} /> },
  ]

  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack direction="row" gap="sm" align="center">
          {icon}
          <SectionTitle>{title}</SectionTitle>
        </AppStack>
        <AppSimpleTable rows={rows} columns={columns} getRowKey={(row) => row.name} />
      </AppStack>
    </AppCard>
  )
}

const VALUATION_TONE: Record<Valuation, 'success' | 'info' | 'caution'> = {
  Descontado: 'success',
  Neutro: 'info',
  Esticado: 'caution',
}

function AssetPulseCard({ item }: { item: AssetPulse }) {
  return (
    <AppCard accentEdge={item.accent}>
      <AppStack gap="sm">
        <AppStack direction="row" justify="between" align="center" gap="sm">
          <SectionTitle>{item.name}</SectionTitle>
          <AppChip label={item.valuation} tone={VALUATION_TONE[item.valuation]} />
        </AppStack>
        <AppText variant="caption" weight="strong" tint={item.accent}>
          {item.change}
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          {item.summary}
        </AppText>
      </AppStack>
    </AppCard>
  )
}

function NewsList({ items }: { items: typeof news }) {
  return (
    <AppStack gap="sm">
      {items.map((item) => (
        <AppCard key={item.title}>
          <AppStack direction="row" gap="md" align="start">
            <NewspaperRoundedIcon color="primary" />
            <AppStackItem>
              <AppStack gap="xs">
                <AppStack direction="row" justify="between" gap="sm" collapseBelow="sm">
                  <AppStack gap="none">
                    <SectionLabel>{item.tag}</SectionLabel>
                    <AppText weight="strong">{item.title}</AppText>
                  </AppStack>
                  <AppText variant="caption" tone="secondary" noWrap>
                    Maio 2026
                  </AppText>
                </AppStack>
                <AppText variant="bodySmall" tone="secondary">
                  {item.summary}
                </AppText>
                <AppText variant="caption" weight="strong">
                  Leitura de mercado: {item.impact}
                </AppText>
              </AppStack>
            </AppStackItem>
          </AppStack>
        </AppCard>
      ))}
    </AppStack>
  )
}

const IMPACT_TONE: Record<string, 'success' | 'caution' | 'neutral'> = {
  Positivo: 'success',
  'Atenção': 'caution',
}

function PortfolioImpactList({ items }: { items: typeof portfolioImpacts }) {
  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack gap="xs">
          <AppStack direction="row" gap="sm" align="center">
            <CurrencyBitcoinRoundedIcon color="primary" />
            <SectionTitle>Mapa de impactos</SectionTitle>
          </AppStack>
          <AppText variant="bodySmall" tone="secondary">
            Não é recomendação. Este bloco será conectado às exposições reais da carteira.
          </AppText>
        </AppStack>

        {items.map((item) => (
          <AppStack key={item.title} gap="xs">
            <AppStack direction="row" justify="between" align="center" gap="sm">
              <AppText weight="strong">{item.title}</AppText>
              <AppChip
                label={item.tone}
                tone={IMPACT_TONE[item.tone] ?? 'neutral'}
                emphasis="outline"
              />
            </AppStack>
            <AppText variant="bodySmall" tone="secondary">
              {item.text}
            </AppText>
          </AppStack>
        ))}
      </AppStack>
    </AppCard>
  )
}

interface RegionalPanelProps {
  label: string
  series: MarketSeries[]
  pulse: AssetPulse[]
  tables: { title: string; icon: React.ReactNode; rows: MarketRow[] }[]
  newsItems: typeof news
  impacts: typeof portfolioImpacts
}

function RegionalPanel({ label, series, pulse, tables, newsItems, impacts }: RegionalPanelProps) {
  return (
    <AppStack gap="xl">
      <AppStack gap="md">
        <BlockHeading title={`Termômetro 12M · ${label}`} />
        <AppGrid cols={{ xs: 1, sm: 2, lg: 3 }} gap="md">
          {series.map((item) => (
            <MarketChartCard key={item.key} series={item} />
          ))}
        </AppGrid>
      </AppStack>

      <AppStack gap="md">
        <BlockHeading title="Valuation estrutural · preço relativo das classes" />
        <AppGrid cols={{ xs: 1, sm: 2, lg: 3 }} gap="md">
          {pulse.map((item) => (
            <AssetPulseCard key={item.name} item={item} />
          ))}
        </AppGrid>
      </AppStack>

      <AppGrid cols={{ xs: 1 }} gap="md">
        {tables.map((table) => (
          <MarketTable key={table.title} {...table} />
        ))}
      </AppGrid>

      <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg" align="start">
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          <AppStack gap="md">
            <BlockHeading
              eyebrow={`Notícias · ${label}`}
              title="O que moveu o mercado"
              description="Os fatos mais relevantes e seus efeitos."
            />
            <NewsList items={newsItems} />
          </AppStack>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 5 }}>
          <AppStack gap="md">
            <BlockHeading
              eyebrow={`Sua carteira · ${label}`}
              title="Como isso conversa com você"
              description="Impactos ilustrativos nas exposições desta região."
            />
            <PortfolioImpactList items={impacts} />
          </AppStack>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}

/* As cotações de referência são fixas nesta tela de validação: elas ilustram a
   forma do bloco, e não uma leitura de mercado. */
const REFERENCE_QUOTES = [
  {
    name: 'Dólar',
    value: 'R$ 5,68',
    icon: <LanguageRoundedIcon />,
    tone: 'info' as const,
    month: { value: '+2,4%', tone: 'danger' as const },
    year: { value: '+7,8%', tone: 'danger' as const },
    high: 'R$ 5,92',
  },
  {
    name: 'Bitcoin',
    value: 'US$ 104.280',
    icon: <CurrencyBitcoinRoundedIcon />,
    tone: 'caution' as const,
    month: { value: '+8,7%', tone: 'success' as const },
    year: { value: '+62,5%', tone: 'success' as const },
    high: 'US$ 109k',
  },
  {
    name: 'CDI',
    value: '14,65% a.a.',
    icon: <AccountBalanceOutlinedIcon />,
    tone: 'success' as const,
    month: { value: '+1,1%', tone: 'success' as const },
    year: { value: '+11,2%', tone: 'success' as const },
    high: '14,65%',
  },
]

type RegionTab = 'us' | 'br' | 'world'

const REGION_TABS = [
  { id: 'us' as const, label: 'Estados Unidos' },
  { id: 'br' as const, label: 'Brasil' },
  { id: 'world' as const, label: 'Mundo' },
]

export default function MarketOverviewTabsPage() {
  const theme = useAppTheme()
  const [regionTab, setRegionTab] = useState<RegionTab>('us')

  const TONE_COLOR = {
    info: theme.palette.info.main,
    caution: theme.palette.warning.main,
    success: theme.palette.success.main,
  }

  return (
    <AppStack gap="xl">
      <AppStack direction="row" justify="between" gap="md" collapseBelow="md">
        <AppStack direction="row" gap="sm" align="center">
          <AppText variant="pageHeading">Visão geral do mercado</AppText>
          <AppChip label="MOCK" tone="neutral" emphasis="outline" />
        </AppStack>
        <AppStack direction="row" gap="sm" align="center">
          <InsightsRoundedIcon fontSize="small" color="disabled" />
          <AppText variant="caption" tone="secondary">
            Dados ilustrativos para validação visual
          </AppText>
        </AppStack>
      </AppStack>

      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md" align="stretch">
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          <AppCard>
            <AppStack gap="md">
              <AppStack gap="xs">
                <SectionLabel>Resumo de maio</SectionLabel>
                <AppText variant="cardValue">
                  Juros altos ainda ditam o preço dos ativos, enquanto tecnologia e Bitcoin
                  sustentam o apetite por risco.
                </AppText>
              </AppStack>

              <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
                <AppStack gap="xs">
                  <AppText weight="strong">Principal tema · Juros nos EUA</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    A economia americana permaneceu resiliente e adiou a expectativa de cortes
                    mais rápidos pelo Fed. Treasuries subiram, o dólar ganhou força e ativos de
                    duration longa ficaram mais seletivos.
                  </AppText>
                </AppStack>
                <AppStack gap="xs">
                  <AppText weight="strong">Leitura macro</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    O cenário combina crescimento moderado, desinflação lenta e liquidez ainda
                    restrita. No Brasil, o CDI oferece carrego elevado, mas fiscal e inflação de
                    serviços limitam a queda dos juros longos.
                  </AppText>
                </AppStack>
              </AppGrid>
            </AppStack>
          </AppCard>
        </AppGridItem>

        <AppGridItem span={{ xs: 1, lg: 5 }}>
          <AppCard>
            <AppStack gap="sm">
              <AppStack direction="row" justify="between" align="center" gap="sm">
                <SectionTitle>Cotações de referência</SectionTitle>
                <AppText variant="caption" tone="secondary">
                  Maio 2026
                </AppText>
              </AppStack>

              {REFERENCE_QUOTES.map((quote) => (
                <AppCard key={quote.name} padding="sm" tint={TONE_COLOR[quote.tone]}>
                  <AppStack direction="row" gap="md" align="center" wrap>
                    <AppStackItem minWidth={155}>
                      <AppStack direction="row" gap="sm" align="center">
                        {quote.icon}
                        <AppMetric label={quote.name} value={quote.value} />
                      </AppStack>
                    </AppStackItem>
                    <AppMetric label="Mês" value={quote.month.value} tone={quote.month.tone} />
                    <AppMetric label="12 meses" value={quote.year.value} tone={quote.year.tone} />
                    <AppMetric label="Máxima" value={quote.high} />
                  </AppStack>
                </AppCard>
              ))}
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>

      <AppStack gap="lg">
        <AppTabs
          items={REGION_TABS}
          value={regionTab}
          onChange={setRegionTab}
          label="Região do mercado"
        />

        {regionTab === 'us' && (
          <RegionalPanel
            label="Estados Unidos"
            series={usSeries}
            pulse={usPulse}
            tables={[
              { title: 'Estados Unidos', icon: <ShowChartRoundedIcon fontSize="small" />, rows: usRows },
            ]}
            newsItems={usNews}
            impacts={usImpacts}
          />
        )}
        {regionTab === 'br' && (
          <RegionalPanel
            label="Brasil"
            series={brazilSeries}
            pulse={brazilPulse}
            tables={[
              { title: 'Brasil', icon: <AccountBalanceOutlinedIcon fontSize="small" />, rows: brazilRows },
            ]}
            newsItems={brazilNews}
            impacts={brazilImpacts}
          />
        )}
        {regionTab === 'world' && (
          <RegionalPanel
            label="Mundo"
            series={worldSeries}
            pulse={worldPulse}
            tables={[
              { title: 'Mundo e ativos globais', icon: <LanguageRoundedIcon fontSize="small" />, rows: globalRows },
            ]}
            newsItems={worldNews}
            impacts={worldImpacts}
          />
        )}
      </AppStack>
    </AppStack>
  )
}
