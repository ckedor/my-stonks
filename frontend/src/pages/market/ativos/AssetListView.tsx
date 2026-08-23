import { AppIconButton, AppSimpleTable, AppText, type AppSimpleTableColumn } from '@/components/ui'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import { TypeBadge, type MarketAsset } from './AssetCard'

/** Denser alternative to the cards: more rows per screen when the user is
 *  scanning a long list rather than browsing. */
export default function AssetListView({
  assets,
  onOpen,
  onBuy,
}: {
  assets: MarketAsset[]
  onOpen: (asset: MarketAsset) => void
  onBuy: (asset: MarketAsset) => void
}) {
  const columns: AppSimpleTableColumn<MarketAsset>[] = [
    {
      label: 'Ticker',
      render: (asset) => (
        <AppText variant="bodySmall" weight="strong" noWrap>
          {asset.ticker ?? '—'}
        </AppText>
      ),
    },
    {
      label: 'Nome',
      render: (asset) => (
        <AppText variant="bodySmall" tone="secondary">
          {asset.name}
        </AppText>
      ),
    },
    {
      label: 'Tipo',
      render: (asset) =>
        asset.asset_type?.short_name ? <TypeBadge label={asset.asset_type.short_name} /> : null,
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
      surface="outlined"
      onRowClick={onOpen}
    />
  )
}
