import { AppCard, AppChip, AppIconButton, AppStack, AppStackItem, AppText } from '@/components/ui'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'

export interface MarketAsset {
  id: number
  ticker: string | null
  name: string
  asset_type_id: number
  asset_type?: { id: number; short_name: string; name: string; asset_class_id?: number }
}

/** Muted, readable badge. Colouring every type competes with the ticker for
 *  attention, so the type reads as a label rather than a status. */
export function TypeBadge({ label }: { label: string }) {
  return <AppChip label={label} />
}

export default function AssetCard({
  asset,
  onOpen,
  onBuy,
}: {
  asset: MarketAsset
  onOpen: () => void
  onBuy: () => void
}) {
  return (
    <AppCard interactive onClick={onOpen}>
      <AppStack gap="xs">
        <AppStack direction="row" gap="sm" align="center">
          <AppText variant="cardValue" noWrap>
            {asset.ticker ?? asset.name}
          </AppText>
          {asset.asset_type?.short_name && <TypeBadge label={asset.asset_type.short_name} />}
        </AppStack>

        <AppStackItem>
          <AppText variant="bodySmall" tone="secondary">
            {asset.name}
          </AppText>
        </AppStackItem>

        <AppStack direction="row" justify="end">
          <AppIconButton
            size="sm"
            tone="primary"
            label="Registrar compra"
            tooltip
            onClick={(event) => {
              event.stopPropagation()
              onBuy()
            }}
          >
            <AddShoppingCartIcon fontSize="small" />
          </AppIconButton>
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
