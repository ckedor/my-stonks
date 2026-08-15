import { syncPositions } from '@/actions/portfolio'
import { formatSpan } from '@/components/charts/candle/helpers'
import AppCard from '@/components/ui/AppCard'
import MiniDonut from '@/components/ui/MiniDonut'
import Sparkline from '@/components/ui/Sparkline'
import { useAssetReturnWindow } from '@/hooks/useAssetReturnWindow'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useTradeFormStore } from '@/stores/trade-form'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Box, Button, Link as MuiLink, Skeleton, Stack, Typography, useTheme } from '@mui/material'
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  assetId: number
  ticker: string
  name: string
  assetTypeId: number
}

/** Meses da janela do mini gráfico, igual à da listagem da carteira. */
const WINDOW_MONTHS = 12

/** O que este ativo é na carteira de quem está olhando, na página de mercado.
 *
 *  A pergunta que se faz ao abrir a página de um ativo que já se tem é sempre a
 *  mesma — quanto eu tenho disso, e como está indo? — e a resposta estava a
 *  dois cliques. É o mesmo card da listagem da carteira, um pouco menor e sem
 *  o ticker no título, que aqui seria repetir o cabeçalho da página. Quem não
 *  tem o ativo recebe a outra resposta possível: o botão de comprar. */
export default function AssetPositionCard({ assetId, ticker, name, assetTypeId }: Props) {
  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)
  const positions = usePositionsStore((s) => s.positions)
  const theme = useTheme()
  const { currency, format: formatCurrency } = useCurrency()
  const { openTradeForm } = useTradeFormStore()

  // As posições são carregadas pelas páginas da carteira; quem entra direto na
  // de mercado também precisa delas. A ação é cacheada, então não custa uma
  // requisição a mais — e é cacheada *por moeda*, daí a dependência: sem ela o
  // card seguiria exibindo os valores da moeda anterior.
  const portfolioId = selectedPortfolio?.id
  useEffect(() => {
    if (portfolioId) syncPositions(portfolioId)
  }, [portfolioId, currency])

  const position = useMemo(
    () => positions.find((p) => p.asset_id === assetId),
    [positions, assetId],
  )

  const weight = useMemo(() => {
    const total = positions.reduce((sum, p) => sum + p.value, 0)
    return total > 0 && position ? (position.value / total) * 100 : 0
  }, [positions, position])

  const { values, period } = useAssetReturnWindow(
    position ? portfolioId : undefined,
    assetId,
    ticker,
    WINDOW_MONTHS,
  )

  if (!position) {
    return (
      <AppCard sx={{ minWidth: 200 }}>
        <Typography variant="body2" color="text.secondary">
          Você não tem {ticker}
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddShoppingCartIcon />}
          onClick={() => openTradeForm({ id: assetId, ticker, name, asset_type_id: assetTypeId })}
          sx={{ textTransform: 'none', mt: 1.25 }}
        >
          Comprar
        </Button>
      </AppCard>
    )
  }

  const color =
    period == null || period.totalReturn >= 0
      ? theme.palette.success.main
      : theme.palette.error.main
  const cagr = position.cagr != null ? position.cagr * 100 : null

  return (
    <AppCard sx={{ minWidth: 220 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Na carteira
          </Typography>
          <MuiLink
            component={Link}
            to={`/portfolio/asset/${assetId}`}
            color="text.secondary"
            aria-label="Ver posição na carteira"
            sx={{ display: 'inline-flex', '&:hover': { color: 'text.primary' } }}
          >
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </MuiLink>
        </Stack>
        <MiniDonut value={weight} color={theme.palette.primary.main} size={30} />
      </Stack>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3, mt: 0.5 }}>
        {formatCurrency(Math.round(position.value)).replace(/,\d{2}$/, '')}
      </Typography>

      <Box sx={{ mt: 1, height: 28 }}>
        {values ? (
          <Sparkline values={values} color={color} width={160} height={28} />
        ) : (
          <Skeleton variant="rounded" width="100%" height={28} />
        )}
      </Box>

      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ mt: 0.5 }}>
        <Stack direction="row" alignItems="baseline" spacing={0.5} minWidth={0}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {period ? formatSpan(period.days) : `${WINDOW_MONTHS}m`}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color }}>
            {period
              ? `${period.totalReturn >= 0 ? '+' : ''}${period.totalReturn.toFixed(2).replace('.', ',')}%`
              : '—'}
          </Typography>
        </Stack>

        {cagr != null && (
          <Typography
            variant="caption"
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
