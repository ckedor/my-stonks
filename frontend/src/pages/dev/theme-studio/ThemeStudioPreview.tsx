import PortfolioOverviewScreen from '@/components/portfolio-overview/PortfolioOverviewScreen'
import { AppButton, AppChip, AppStack, AppTextField, SectionTitle } from '@/components/ui'
import type { ThemePreset } from '@/theme/presets'
import { useMemo } from 'react'
import { mockPortfolioOverview } from './mockPortfolio'

/* O dashboard da carteira de verdade — a mesma `PortfolioOverviewScreen` da
 * página —, com uma carteira de mentira, no lugar e na largura em que a
 * página o desenha: sem moldura nem respiro a mais. O tema não é aplicado
 * aqui, e sim na casca inteira do estúdio; o que está aqui só herda.
 *
 * Abaixo dele, uma fileira curta dos controles que o dashboard não mostra:
 * botões nas três ênfases, etiquetas de estado e um campo.
 *
 * As categorias pegam as cores de série do tema, na ordem, como faria quem
 * escolhesse as cores das suas categorias pela paleta: é assim que as cores
 * de gráfico do tema aparecem na pizza e na tabela. */
export default function ThemeStudioPreview({ draft }: { draft: ThemePreset }) {
  const data = useMemo(() => mockPortfolioOverview(draft.palette.chart.colors), [draft.palette.chart.colors])

  return (
    <AppStack gap="lg">
      <PortfolioOverviewScreen {...data} onAssetSelect={() => undefined} />

      <AppStack gap="sm">
        <SectionTitle>Controles</SectionTitle>
        <AppStack direction="row" gap="sm" wrap align="center">
          <AppButton>Registrar compra</AppButton>
          <AppButton emphasis="outline">Exportar</AppButton>
          <AppButton emphasis="ghost">Cancelar</AppButton>
          <AppButton tone="danger" emphasis="outline">
            Excluir
          </AppButton>
          <AppChip label="Liquidado" tone="success" />
          <AppChip label="Na fila" emphasis="outline" />
          <AppChip label="Esticado" tone="caution" />
          <AppChip label="Falhou" tone="danger" />
          <AppStack grow>
            <AppTextField label="Buscar ativo" value="PETR4" onChange={() => undefined} density="compact" />
          </AppStack>
        </AppStack>
      </AppStack>
    </AppStack>
  )
}
