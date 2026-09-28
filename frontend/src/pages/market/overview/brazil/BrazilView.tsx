import { useMemo } from 'react'
import type { MarketCatalogueKind } from '@/api/market'
import { AppStack, AppSkeleton, AppText, SectionLabel, SectionTitle } from '@/components/ui'
import { cleanCatalogues } from '@/components/market-catalogue/market-highlights'
import SectorHeatmap from '@/components/market-catalogue/SectorHeatmap'
import { useMarketCatalogues } from '@/queries/market'

const KINDS: MarketCatalogueKind[] = ['stock']

/** O mapa pede a largura da tela: é nela que os setores pequenos ainda têm
 *  onde escrever o nome. */
const HEATMAP_HEIGHT = 620

/* O mapa só lê ações: o filtro de FIIs não se aplica, e o conjunto vazio
   diz isso sem buscar a leitura de FIIs à toa. */
const NO_FIIS: ReadonlySet<string> = new Set()

/** A aba Brasil: a bolsa do dia num quadro, empresa por empresa. */
export default function BrazilView() {
  const { catalogues, loading } = useMarketCatalogues(KINDS)
  const stocks = useMemo(
    () => cleanCatalogues(catalogues, NO_FIIS).get('stock') ?? [],
    [catalogues]
  )

  return (
    <AppStack gap="md">
      <AppStack gap="xs">
        <SectionLabel>A BOLSA HOJE</SectionLabel>
        <SectionTitle>Onde a B3 subiu e onde caiu</SectionTitle>
        <AppText variant="caption" tone="secondary">
          Clique numa empresa para abrir a tela dela.
        </AppText>
      </AppStack>
      {loading ? (
        <AppSkeleton height={HEATMAP_HEIGHT + 80} />
      ) : (
        <SectorHeatmap stocks={stocks} height={HEATMAP_HEIGHT} />
      )}
    </AppStack>
  )
}
