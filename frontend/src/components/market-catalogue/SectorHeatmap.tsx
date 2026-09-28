import { scaleLinear } from '@visx/scale'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MarketCatalogueAsset } from '@/api/market'
import {
  AppCard,
  AppStack,
  AppText,
  AppTreemap,
  SectionTitle,
  useAppTheme,
  type AppTreemapGroup,
} from '@/components/ui'
import { COLOR_RANGE } from '@/pages/portfolio/asset/metric-color'
import { sectorGroups } from './market-highlights'
import { compactMoney } from './format'

/** Três por cento é o fim da escala: num dia de bolsa, passar disso já é
 *  notícia, e uma escala mais larga deixava o mapa inteiro cinza. */
const changeColor = scaleLinear<string>({ domain: [-3, 0, 3], range: COLOR_RANGE, clamp: true })

const LARGEST = 80

/** Abaixo disso o setor não tem altura para o próprio nome. */
const MIN_SECTOR_SHARE = 0.03

const signed = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

/** A bolsa num quadro: as maiores empresas, cada uma do tamanho do seu valor
 *  de mercado, agrupadas por setor e pintadas pela variação do dia. */
export default function SectorHeatmap({
  stocks,
  height,
}: {
  stocks: MarketCatalogueAsset[]
  height: number
}) {
  const theme = useAppTheme()
  const navigate = useNavigate()
  const byTicker = useMemo(() => new Map(stocks.map((asset) => [asset.ticker, asset])), [stocks])
  const groups: AppTreemapGroup[] = useMemo(
    () =>
      sectorGroups(stocks, LARGEST, MIN_SECTOR_SHARE).map((group) => ({
        label: group.sector,
        items: group.assets.map((asset) => ({
          key: asset.ticker,
          label: asset.ticker,
          caption: asset.change_percent == null ? '—' : signed(asset.change_percent),
          value: asset.market_cap!,
          tint: changeColor(asset.change_percent ?? 0),
        })),
      })),
    [stocks]
  )

  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack gap="none">
          <SectionTitle>Mapa da bolsa</SectionTitle>
          <AppText variant="caption" tone="secondary">
            As {LARGEST} maiores ações por valor de mercado, por setor, pintadas pela variação do
            dia
          </AppText>
        </AppStack>
        <AppTreemap
          groups={groups}
          height={height}
          backgroundColor={theme.palette.background.paper}
          labelColor={theme.palette.text.primary}
          onSelect={(key) => {
            const id = byTicker.get(String(key))?.asset_id
            if (id != null) navigate(`/market/asset/${id}`)
          }}
          renderTooltip={(leaf) => {
            const asset = byTicker.get(String(leaf.key))
            if (!asset) return null
            return (
              <AppStack gap="none">
                <AppText variant="caption" weight="strong">
                  {asset.ticker} · {asset.name}
                </AppText>
                <AppText variant="caption">{asset.subsector ?? '—'}</AppText>
                <AppText variant="caption">
                  Valor de mercado: {compactMoney(asset.market_cap)}
                </AppText>
                <AppText variant="caption">
                  Dia: {asset.change_percent == null ? '—' : signed(asset.change_percent)}
                </AppText>
              </AppStack>
            )
          }}
        />
      </AppStack>
    </AppCard>
  )
}
