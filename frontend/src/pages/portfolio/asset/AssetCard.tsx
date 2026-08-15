import { formatSpan } from '@/components/charts/candle/helpers'
import AppCard from '@/components/ui/AppCard'
import MiniDonut from '@/components/ui/MiniDonut'
import Sparkline from '@/components/ui/Sparkline'
import { useAssetReturnWindow } from '@/hooks/useAssetReturnWindow'
import { useCurrency } from '@/hooks/useCurrency'
import { formatFixedIncomeDescription } from '@/lib/utils/fixedIncome'
import { Box, Skeleton, Stack, Typography, useTheme } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export interface AssetCardPosition {
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
  const theme = useTheme()
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
      onClick={() => navigate(`/portfolio/asset/${position.asset_id}`)}
      sx={{
        cursor: 'pointer',
        transition: 'background-color 0.15s, border-color 0.15s',
        '&:hover': { bgcolor: 'action.hover', borderColor: accentColor },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box minWidth={0}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
            {position.ticker}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1.2, display: 'block' }}
            noWrap
          >
            {remuneration || position.name || position.type}
          </Typography>
        </Box>
        {/* O peso como fatia, e não como frase: é o mesmo dado da lista, lido
            do mesmo jeito, e ocupa o canto sem gastar uma linha. */}
        <MiniDonut value={weight} color={accentColor} size={36} />
      </Stack>

      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, mt: 1 }}>
        {formatCurrency(Math.round(position.value)).replace(/,\d{2}$/, '')}
      </Typography>

      <Box sx={{ mt: 1.5, height: 36 }}>
        {values ? (
          <Sparkline values={values} color={color} width={200} />
        ) : (
          <Skeleton variant="rounded" width="100%" height={36} />
        )}
      </Box>

      {/* O retorno da janela e o anualizado da posição, lado a lado: um diz o
          que aconteceu no período desenhado, o outro a que ritmo a posição
          cresce desde que existe. */}
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ mt: 0.75 }}>
        <Stack direction="row" alignItems="baseline" spacing={0.75} minWidth={0}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {period ? formatSpan(period.days) : `${WINDOW_MONTHS}m`}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color }}>
            {period
              ? `${period.totalReturn >= 0 ? '+' : ''}${period.totalReturn.toFixed(2).replace('.', ',')}%`
              : '—'}
          </Typography>
        </Stack>

        {/* "a.a." já diz que é anualizado; o rótulo CAGR ao lado era a mesma
            informação duas vezes. */}
        {cagr != null && (
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: cagr >= 0 ? 'success.main' : 'error.main' }}
          >
            {cagr >= 0 ? '+' : ''}
            {cagr.toFixed(2).replace('.', ',')}% a.a.
          </Typography>
        )}
      </Stack>
    </AppCard>
  )
}
