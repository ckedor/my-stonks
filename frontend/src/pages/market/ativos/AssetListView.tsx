import {
  AppAssetLogo,
  AppIconButton,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { formatBRL } from '@/lib/utils/format'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import AssetChange from './AssetChange'
import { TypeBadge, type MarketAsset } from './AssetCard'
import type { MarketQuote } from './useMarketQuotes'

/** Denser alternative to the cards: more rows per screen when the user is
 *  scanning a long list rather than browsing. */
export default function AssetListView({
  assets,
  quoteOf,
  onOpen,
  onBuy,
  pageSize,
}: {
  assets: MarketAsset[]
  /** Quantas linhas por página. A tabela pagina o conjunto inteiro para que a
   *  ordenação do cabeçalho valha sobre a lista toda, e não sobre a fatia. */
  pageSize?: number
  quoteOf: (asset: MarketAsset) => MarketQuote | undefined
  onOpen: (asset: MarketAsset) => void
  onBuy: (asset: MarketAsset) => void
}) {
  const columns: AppSimpleTableColumn<MarketAsset>[] = [
    {
      label: 'Ticker',
      sortValue: (asset) => asset.ticker ?? '',
      render: (asset) => (
        <AppStack direction="row" gap="sm" align="center">
          <AppAssetLogo src={asset.logo_url ?? quoteOf(asset)?.logoUrl} size={22} />
          <AppText variant="bodySmall" weight="strong" noWrap>
            {asset.ticker ?? '—'}
          </AppText>
        </AppStack>
      ),
    },
    {
      label: 'Nome',
      sortValue: (asset) => asset.name,
      render: (asset) => (
        <AppText variant="bodySmall" tone="secondary">
          {asset.name}
        </AppText>
      ),
    },
    {
      label: 'Tipo',
      sortValue: (asset) => asset.asset_type?.short_name ?? '',
      render: (asset) =>
        asset.asset_type?.short_name ? <TypeBadge label={asset.asset_type.short_name} /> : null,
    },
    {
      label: 'Preço',
      align: 'right',
      sortValue: (asset) => quoteOf(asset)?.price ?? null,
      render: (asset) => (
        <AppText variant="bodySmall" noWrap inline>
          {formatBRL(quoteOf(asset)?.price)}
        </AppText>
      ),
    },
    {
      label: 'Dia',
      align: 'right',
      sortValue: (asset) => quoteOf(asset)?.changePercent ?? null,
      render: (asset) => <AssetChange value={quoteOf(asset)?.changePercent} />,
    },
    {
      label: 'Ações',
      align: 'right',
      render: (asset) => (
        <AppIconButton
          size="sm"
          tone="primary"
          label="Registrar compra"
          tooltip
          onClick={(event) => {
            event.stopPropagation()
            onBuy(asset)
          }}
        >
          <AddShoppingCartIcon fontSize="small" />
        </AppIconButton>
      ),
    },
  ]

  return (
    <AppSimpleTable
      rows={assets}
      columns={columns}
      getRowKey={(asset) => asset.id}
      pageSize={pageSize}
      surface="outlined"
      onRowClick={onOpen}
    />
  )
}
