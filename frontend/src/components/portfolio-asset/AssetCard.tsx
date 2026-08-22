import { formatSpan } from '@/components/charts/candle/helpers'
import {
  AppCard,
  AppSkeleton,
  AppStack,
  AppStackItem,
  AppText,
  MiniDonut,
  Sparkline,
  useAppTheme,
} from '@/components/ui'
import { useAssetReturnWindow } from '@/hooks/useAssetReturnWindow'
import { useCurrency } from '@/hooks/useCurrency'
import { formatFixedIncomeDescription } from '@/lib/utils/fixedIncome'
import { useNavigate } from 'react-router-dom'

interface AssetCardPosition {
  asset_id: number
  ticker: string
  name?: string
  type: string
  value: number
  /** Anualizado da posição na carteira, em fração (0,19 = 19% a.a.). */
  cagr?: number | null
  /** Remuneração, só em renda fixa. Nulo em todo o resto. */
  index?: string | null
  fee?: number | null
  fixed_income_type?: string | null
  fixed_income_type_id?: number | null
}

interface Props {
  position: AssetCardPosition
  portfolioId: number
  /** Peso na carteira, em pontos percentuais. */
  weight: number
  accentColor: string
}

/** Meses da janela do mini gráfico. */
const WINDOW_MONTHS = 12

export default function AssetCard({ position, portfolioId, weight, accentColor }: Props) {
  const navigate = useNavigate()
  const theme = useAppTheme()
  const { format: formatCurrency } = useCurrency()

  const { values, period } = useAssetReturnWindow(
    portfolioId,
    position.asset_id,
    position.ticker,
    WINDOW_MONTHS,
  )

  const color =
    period == null || period.totalReturn >= 0
      ? theme.palette.success.main
      : theme.palette.error.main

  // Em fração na listagem de posições, como a coluna CAGR da visão de lista
  // também o trata.
  const cagr = position.cagr != null ? position.cagr * 100 : null

  // "IPCA + 7,00%", "110,00% do CDI", "Prefixado 12,00%" — a mesma frase que a
  // página do ativo monta, pelo mesmo formatador.
  const remuneration = formatFixedIncomeDescription({
    typeName: position.fixed_income_type,
    typeId: position.fixed_income_type_id,
    indexName: position.index,
    fee: position.fee,
  })

  return (
    <AppCard
      interactive
      accentColor={accentColor}
      onClick={() => navigate(`/portfolio/asset/${position.asset_id}`)}
    >
      <AppStack gap="sm">
        <AppStack direction="row" align="start" justify="between" gap="xs">
          <AppStackItem minWidth={0}>
            <AppText variant="bodySmall" weight="strong" noWrap>
              {position.ticker}
            </AppText>
            <AppText variant="caption" tone="secondary" noWrap>
              {remuneration || position.name || position.type}
            </AppText>
          </AppStackItem>
          {/* O peso como fatia, e não como frase: é o mesmo dado da lista, lido
              do mesmo jeito, e ocupa o canto sem gastar uma linha. */}
          <MiniDonut value={weight} color={accentColor} size={36} />
        </AppStack>

        <AppText variant="cardValue">
          {formatCurrency(Math.round(position.value)).replace(/,\d{2}$/, '')}
        </AppText>

        {values ? (
          <Sparkline values={values} color={color} width={200} />
        ) : (
          <AppSkeleton height={36} />
        )}

        {/* O retorno da janela e o anualizado da posição, lado a lado: um diz o
            que aconteceu no período desenhado, o outro a que ritmo a posição
            cresce desde que existe. */}
        <AppStack direction="row" align="baseline" justify="between" gap="xs">
          <AppStack direction="row" align="baseline" gap="xs">
            <AppText variant="caption" tone="secondary" noWrap>
              {period ? formatSpan(period.days) : `${WINDOW_MONTHS}m`}
            </AppText>
            <AppText variant="bodySmall" weight="strong" tint={color}>
              {period
                ? `${period.totalReturn >= 0 ? '+' : ''}${period.totalReturn.toFixed(2).replace('.', ',')}%`
                : '—'}
            </AppText>
          </AppStack>

          {/* "a.a." já diz que é anualizado; o rótulo CAGR ao lado era a mesma
              informação duas vezes. */}
          {cagr != null && (
            <AppText variant="bodySmall" weight="strong" tone={cagr >= 0 ? 'success' : 'danger'}>
              {cagr >= 0 ? '+' : ''}
              {cagr.toFixed(2).replace('.', ',')}% a.a.
            </AppText>
          )}
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
