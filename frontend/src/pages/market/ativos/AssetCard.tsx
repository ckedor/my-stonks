import {
  AppAssetLogo,
  AppCard,
  AppChip,
  AppIconButton,
  AppStack,
  AppStackItem,
  AppText,
} from '@/components/ui'
import { formatBRL } from '@/lib/utils/format'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import AssetChange from './AssetChange'
import type { MarketQuote } from './useMarketQuotes'

export interface MarketAsset {
  id: number
  ticker: string | null
  name: string
  logo_url?: string | null
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
  quote,
  onOpen,
  onBuy,
}: {
  asset: MarketAsset
  quote?: MarketQuote
  onOpen: () => void
  onBuy: () => void
}) {
  const logo = asset.logo_url ?? quote?.logoUrl

  return (
    <AppCard interactive onClick={onOpen}>
      <AppStack gap="xs">
        <AppStack direction="row" gap="sm" align="center">
          <AppAssetLogo src={logo} size={28} />
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

        {/* Preço e variação na mesma linha da ação: é o que faz o cartão valer
            a área que ocupa. Sem cotação, a linha some em vez de mostrar dois
            travessões. */}
        <AppStack direction="row" justify="between" align="center">
          {quote?.price != null ? (
            <AppStack direction="row" gap="sm" align="baseline">
              <AppText variant="bodySmall" weight="strong" inline>
                {formatBRL(quote.price)}
              </AppText>
              <AssetChange value={quote.changePercent} />
            </AppStack>
          ) : (
            <span />
          )}

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
