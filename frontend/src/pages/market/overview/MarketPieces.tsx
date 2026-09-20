import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import {
  AppButton,
  AppCard,
  AppChartArea,
  AppChip,
  AppDivider,
  AppGrid,
  AppMetric,
  AppSideDrawer,
  AppStack,
  AppStackItem,
  AppText,
  SectionLabel,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'
import {
  changeTone,
  agenda,
  curve,
  markets,
  PERIOD_LABEL,
  signed,
  type Detail,
  type Market,
  type Period,
  type Story,
} from './mockData'

export type OpenDetail = (detail: Detail) => void

export function MiniChart({
  market,
  period = 'month',
  height = 64,
}: {
  market: Market
  period?: Period
  height?: number
}) {
  const theme = useAppTheme()
  const id = useId().replace(/:/g, '')
  const color = market.changes[period] < 0 ? theme.palette.error.main : theme.palette.success.main
  return (
    <AppStack
      role="img"
      aria-label={`${market.title}: trajetória ilustrativa, ${signed(market.changes[period])} no período`}
    >
      <AppChartArea height={height}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curve(market, period)} margin={{ top: 6, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={['dataMin - 0.1', 'dataMax + 0.1']} />
            <Tooltip
              formatter={(value) => [Number(value).toFixed(2), 'Índice ilustrativo · base 100']}
              labelFormatter={() => 'Trajetória do período'}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </AppChartArea>
    </AppStack>
  )
}

export function QuoteStrip({ onOpen }: { onOpen: OpenDetail }) {
  return (
    <AppGrid cols={{ xs: 1, sm: 3 }} gap="md">
      {markets.slice(0, 3).map((market) => (
        <AppCard
          key={market.id}
          interactive
          role="button"
          tabIndex={0}
          aria-label={`Explorar ${market.title}`}
          onClick={() => onOpen(market)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen(market)
            }
          }}
        >
          <AppStack gap="sm">
            <AppStack direction="row" justify="between" align="center" gap="sm">
              <AppMetric label={market.title} value={market.value} size="lg" />
              <ArrowForwardRoundedIcon fontSize="small" />
            </AppStack>
            <MiniChart market={market} height={48} />
            <AppStack direction="row" justify="between" gap="sm" wrap>
              <AppText variant="bodySmall" weight="strong" tone={changeTone(market.changes.month)}>
                {signed(market.changes.month)} no mês
              </AppText>
              <AppText variant="caption" tone="secondary">
                {market.id === 'cdi'
                  ? 'Rendimento acumulado'
                  : market.id === 'btc'
                    ? 'Cotação em USD'
                    : 'Cotação em BRL'}
              </AppText>
            </AppStack>
          </AppStack>
        </AppCard>
      ))}
    </AppGrid>
  )
}

export function MarketTile({
  market,
  period,
  onOpen,
}: {
  market: Market
  period: Period
  onOpen: OpenDetail
}) {
  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack direction="row" justify="between" align="start" gap="sm" wrap>
          <AppMetric label={market.title} value={market.value} />
          <AppText weight="strong" tone={changeTone(market.changes[period])}>
            {signed(market.changes[period])}
          </AppText>
        </AppStack>
        <MiniChart market={market} period={period} />
        <AppText variant="caption" tone="secondary">
          {market.label} · {PERIOD_LABEL[period].toLowerCase()}
        </AppText>
        <AppButton emphasis="ghost" size="sm" onClick={() => onOpen(market)}>
          Entender o movimento →
        </AppButton>
      </AppStack>
    </AppCard>
  )
}

export function StoryRow({
  story,
  onOpen,
  number,
}: {
  story: Story
  onOpen: OpenDetail
  number?: string
}) {
  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="md" align="start">
        {number && (
          <AppText variant="cardValue" tone="secondary">
            {number}
          </AppText>
        )}
        <AppStackItem>
          <AppStack gap="sm">
            <AppStack direction="row" justify="between" gap="sm" wrap>
              <SectionLabel>{story.tag}</SectionLabel>
              <AppText variant="caption" tone="secondary">
                {story.time}
              </AppText>
            </AppStack>
            <SectionTitle>{story.title}</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              {story.summary}
            </AppText>
            <AppStack direction="row" gap="sm" align="center" wrap>
              <AppButton emphasis="ghost" size="sm" onClick={() => onOpen(story)}>
                Ler contexto e contrapontos →
              </AppButton>
              <AppText variant="caption" tone="secondary">
                2 min de leitura
              </AppText>
            </AppStack>
          </AppStack>
        </AppStackItem>
      </AppStack>
      <AppDivider />
    </AppStack>
  )
}

export function AgendaList({ onOpen }: { onOpen: OpenDetail }) {
  return (
    <AppStack gap="lg">
      <AppStack gap="xs">
        <SectionLabel>O QUE VEM A SEGUIR</SectionLabel>
        <SectionTitle>Na próxima semana</SectionTitle>
      </AppStack>
      {agenda.map((item) => (
        <AppStack key={item.title} direction="row" gap="md" align="start">
          <AppStack gap="none">
            <AppText variant="cardValue" weight="strong">
              {item.day}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {item.month}
            </AppText>
          </AppStack>
          <AppStack gap="xs">
            <AppText weight="strong">{item.title}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {item.summary}
            </AppText>
            <AppButton emphasis="ghost" size="sm" onClick={() => onOpen(item)}>
              O que observar →
            </AppButton>
          </AppStack>
        </AppStack>
      ))}
      <AppText variant="caption" tone="secondary">
        Datas e eventos ilustrativos.
      </AppText>
    </AppStack>
  )
}

export function DetailDrawer({ detail, onClose }: { detail: Detail | null; onClose: () => void }) {
  const market = detail && 'changes' in detail ? (detail as Market) : null
  return (
    <AppSideDrawer
      open={detail !== null}
      onClose={onClose}
      title="Uma leitura mais próxima"
      width="md"
    >
      {detail && (
        <AppStack gap="lg">
          <AppStack gap="sm">
            <AppChip label="Edição demonstrativa" emphasis="outline" />
            <SectionLabel>{detail.label}</SectionLabel>
            <SectionTitle prominence="lead">{detail.title}</SectionTitle>
            <AppText tone="secondary">{detail.summary}</AppText>
          </AppStack>
          {market && (
            <AppStack gap="md">
              <AppMetric label={market.title} value={market.value} size="lg" />
              <MiniChart market={market} height={150} />
              <AppText variant="caption" tone="secondary">
                Trajetória ilustrativa do mês · base 100
              </AppText>
            </AppStack>
          )}
          <AppDivider />
          {detail.sections.map((section) => (
            <AppStack key={section.title} gap="sm">
              <SectionTitle>{section.title}</SectionTitle>
              <AppText variant="bodySmall" tone="secondary">
                {section.text}
              </AppText>
            </AppStack>
          ))}
          <AppDivider />
          <AppText variant="caption" tone="secondary">
            Conteúdo fictício para avaliar a experiência. Cotações, notícias, cenários e datas não
            são informações atuais de mercado.
          </AppText>
          <AppButton emphasis="outline" onClick={onClose}>
            Voltar ao panorama
          </AppButton>
        </AppStack>
      )}
    </AppSideDrawer>
  )
}
