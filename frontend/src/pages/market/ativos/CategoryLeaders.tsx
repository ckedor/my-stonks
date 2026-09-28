import type { MarketCatalogueAsset } from '@/api/market'
import { AppCard, AppGrid, AppStack, AppText, SectionLabel } from '@/components/ui'
import MarketAssetRow from './MarketAssetRow'

interface LeaderRow {
  asset: MarketCatalogueAsset
  /** O número pelo qual a lista ordena, já escrito. */
  metric: string
  /** Uma linha de contexto sob ele. */
  detail?: string
}

export interface LeaderList {
  label: string
  /** O critério da ordem, dito no card: cada classe tem o seu. */
  caption: string
  rows: LeaderRow[]
}

/** Os principais de cada categoria, um card por classe. A ordem não é a mesma
 *  em todo card — valor de mercado não existe para um ETF, e retorno
 *  histórico não existe no catálogo de uma ação —, e por isso o card diz o
 *  critério dele. */
export default function CategoryLeaders({ lists }: { lists: LeaderList[] }) {
  return (
    <AppGrid cols={{ xs: 1, md: 2, lg: 3 }} gap="md">
      {lists.map((list) => (
        <AppCard key={list.label}>
          <AppStack gap="sm">
            <AppStack gap="none">
              <SectionLabel>{list.label}</SectionLabel>
              <AppText variant="caption" tone="secondary">
                {list.caption}
              </AppText>
            </AppStack>
            {list.rows.length === 0 ? (
              <AppText variant="bodySmall" tone="secondary">
                Sem dados para esta categoria.
              </AppText>
            ) : (
              <AppStack gap="none">
                {list.rows.map((row, index) => (
                  <MarketAssetRow
                    key={row.asset.ticker}
                    asset={row.asset}
                    leading={
                      <AppText variant="caption" tone="secondary">
                        {index + 1}
                      </AppText>
                    }
                    trailing={
                      <AppStack gap="none" align="end">
                        <AppText variant="bodySmall" weight="strong" noWrap>
                          {row.metric}
                        </AppText>
                        {row.detail && (
                          <AppText variant="caption" tone="secondary" noWrap>
                            {row.detail}
                          </AppText>
                        )}
                      </AppStack>
                    }
                  />
                ))}
              </AppStack>
            )}
          </AppStack>
        </AppCard>
      ))}
    </AppGrid>
  )
}
