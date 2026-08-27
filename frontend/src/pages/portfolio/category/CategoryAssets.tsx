import AssetCard from '@/components/portfolio-asset/AssetCard'
import { AppGrid, AppStack, AppText, SectionTitle } from '@/components/ui'
import type { PortfolioPositionEntry } from '@/types'

interface Props {
  positions: PortfolioPositionEntry[]
  portfolioId: number
  /** Cor da categoria — a do anel de peso e do realce do card, que é a
   *  mesma que os gráficos desenham para ela. */
  color: string
}

/** Os ativos da categoria, um card cada.
 *
 *  O peso é dentro da categoria, e não na carteira inteira: esta tela fala de
 *  uma categoria, e o número que interessa aqui é quanto cada ativo pesa
 *  dentro dela. */
export default function CategoryAssets({ positions, portfolioId, color }: Props) {
  const total = positions.reduce((sum, position) => sum + position.value, 0)

  return (
    <AppStack gap="md">
      <SectionTitle>Ativos</SectionTitle>

      {positions.length === 0 ? (
        <AppText tone="secondary">Nenhum ativo nesta categoria.</AppText>
      ) : (
        <AppGrid cols={{ xs: 1, sm: 2, md: 3, lg: 4 }} gap="md">
          {positions.map((position) => (
            <AssetCard
              key={position.asset_id}
              position={position}
              portfolioId={portfolioId}
              weight={total > 0 ? (position.value / total) * 100 : 0}
              accentColor={color}
            />
          ))}
        </AppGrid>
      )}
    </AppStack>
  )
}
