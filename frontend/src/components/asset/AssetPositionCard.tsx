import { EMPTY_LIST } from '@/queries/empty'
import { usePositions, useSelectedPortfolio } from '@/queries/portfolio'
import { formatSpan } from '@/components/charts/candle/helpers'
import {
  AppButton,
  AppCard,
  AppIconLink,
  AppSkeleton,
  AppStack,
  AppText,
  MiniDonut,
  Sparkline,
  useAppTheme,
} from '@/components/ui'
import { useAssetReturnWindow } from '@/hooks/useAssetReturnWindow'
import { useCurrency } from '@/hooks/useCurrency'
import { useTradeFormStore } from '@/stores/trade-form'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useMemo } from 'react'

interface Props {
  assetId: number
  ticker: string
  name: string
  assetTypeId: number
}

/** Meses da janela do mini gráfico, igual à da listagem da carteira. */
const WINDOW_MONTHS = 12

const SPARKLINE_WIDTH = 160
const SPARKLINE_HEIGHT = 28

/** O que este ativo é na carteira de quem está olhando, na página de mercado.
 *
 *  A pergunta que se faz ao abrir a página de um ativo que já se tem é sempre a
 *  mesma — quanto eu tenho disso, e como está indo? — e a resposta estava a
 *  dois cliques. É o mesmo card da listagem da carteira, um pouco menor e sem
 *  o ticker no título, que aqui seria repetir o cabeçalho da página. Quem não
 *  tem o ativo recebe a outra resposta possível: o botão de comprar. */
export default function AssetPositionCard({ assetId, ticker, name, assetTypeId }: Props) {
  const selectedPortfolio = useSelectedPortfolio()
  const positions = usePositions().data ?? EMPTY_LIST
  const theme = useAppTheme()
  const { format: formatCurrency } = useCurrency()
  const { openTradeForm } = useTradeFormStore()

  const portfolioId = selectedPortfolio?.id

  // Quem entra direto na página de mercado também precisa das posições: a
  // query busca sozinha, e a moeda faz parte da chave, então trocar o seletor
  // já lê outra entrada em vez de precisar de um efeito que force a releitura.
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
      <AppCard minWidth={200}>
        <AppStack gap="sm" align="start">
          <AppText variant="bodySmall" tone="secondary">
            Você não tem {ticker}
          </AppText>
          <AppButton
            size="sm"
            icon={<AddShoppingCartIcon />}
            onClick={() => openTradeForm({ id: assetId, ticker, name, asset_type_id: assetTypeId })}
          >
            Comprar
          </AppButton>
        </AppStack>
      </AppCard>
    )
  }

  const color =
    period == null || period.totalReturn >= 0
      ? theme.palette.success.main
      : theme.palette.error.main
  const cagr = position.cagr != null ? position.cagr * 100 : null
  const periodTone = period == null || period.totalReturn >= 0 ? 'success' : 'danger'

  return (
    <AppCard minWidth={220}>
      <AppStack gap="xs">
        <AppStack direction="row" align="start" justify="between" gap="sm">
          <AppStack direction="row" align="center" gap="xs">
            <AppText variant="bodySmall" tone="secondary">
              Na carteira
            </AppText>
            <AppIconLink to={`/portfolio/asset/${assetId}`} label="Ver posição na carteira">
              <OpenInNewIcon fontSize="inherit" />
            </AppIconLink>
          </AppStack>
          <MiniDonut value={weight} color={theme.palette.primary.main} size={30} />
        </AppStack>

        <AppText variant="body" weight="strong">
          {formatCurrency(Math.round(position.value)).replace(/,\d{2}$/, '')}
        </AppText>

        {values ? (
          <Sparkline values={values} color={color} width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} />
        ) : (
          <AppSkeleton height={SPARKLINE_HEIGHT} />
        )}

        <AppStack direction="row" align="baseline" justify="between" gap="sm">
          <AppStack direction="row" align="baseline" gap="xs">
            <AppText variant="caption" tone="secondary" noWrap>
              {period ? formatSpan(period.days) : `${WINDOW_MONTHS}m`}
            </AppText>
            <AppText variant="caption" weight="strong" tone={periodTone}>
              {period
                ? `${period.totalReturn >= 0 ? '+' : ''}${period.totalReturn.toFixed(2).replace('.', ',')}%`
                : '—'}
            </AppText>
          </AppStack>

          {cagr != null && (
            <AppText variant="caption" weight="strong" tone={cagr >= 0 ? 'success' : 'danger'}>
              {cagr >= 0 ? '+' : ''}
              {cagr.toFixed(2).replace('.', ',')}% a.a.
            </AppText>
          )}
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
