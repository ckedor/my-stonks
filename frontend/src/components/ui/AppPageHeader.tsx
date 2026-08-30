import type { ReactNode } from 'react'
import AppBreadcrumbs from './AppBreadcrumbs'
import AppCard from './AppCard'
import AppStack from './AppStack'
import PageTitle from './PageTitle'

/* Cabeçalho de uma tela de conteúdo — a mesma abertura em toda página.
 *
 * Antes cada tela montava o próprio: umas com breadcrumb, outras sem, uma
 * com o quadradinho de cor da categoria ao lado do nome, três sem título
 * nenhum. O resultado era um app que parecia montado por gente diferente
 * mesmo com todos os imports vindo do mesmo lugar — a refatoração anterior
 * resolveu a procedência dos componentes, não a gramática da tela.
 *
 * A ordem é fixa: rastro, título, ações na mesma linha, métricas embaixo.
 * Quem chama escolhe o que preencher, não como dispor.
 *
 * Não existe prop de cor, e a falta é a regra: cor no app identifica série
 * de gráfico, não título de página. Sem lugar onde passá-la, não há como
 * uma tela reintroduzir o quadradinho colorido por conta própria. */

export interface AppPageHeaderBreadcrumb {
  label: string
  /** Ausente no último item, que é a própria página. */
  href?: string
}

export interface AppPageHeaderProps {
  /** O que a tela mostra. */
  title: string
  /** O caminho até aqui, terminando na própria página. Ausente na raiz de
   *  uma seção, que não está dentro de nada.
   *
   *  Só é desenhado quando há profundidade de verdade: `Carteira >
   *  Rentabilidade` repete a seção que a coluna de navegação já marca e o
   *  título logo abaixo já diz — dois níveis não são um caminho. */
  breadcrumbs?: AppPageHeaderBreadcrumb[]
  /** Uma linha sob o título, para a tela cujo nome não basta — o que o
   *  catálogo de mercado cobre, do que a visão de FIIs é feita. */
  description?: string
  /** Filtros e botões da tela, à direita do título — o seletor de
   *  categoria, o alternador de métrica, o botão de salvar. */
  actions?: ReactNode
  /** A fileira de `AppMetric` que resume a tela, num card sob o título.
   *  Faz parte do cabeçalho porque é a resposta imediata à pergunta que o
   *  título faz, e não mais uma seção da página. */
  metrics?: ReactNode
}

export default function AppPageHeader({
  title,
  breadcrumbs,
  actions,
  metrics,
}: AppPageHeaderProps) {
  const trail = breadcrumbs && breadcrumbs.length > 2 ? breadcrumbs : null

  return (
    <AppStack gap="sm">
      {trail && <AppBreadcrumbs items={trail} />}

      {/* Alinhado pelo topo, e não pelo centro: a tela com muitos filtros
          quebra as ações em duas linhas, e centralizar deixava o título
          flutuando no meio de um bloco vazio. */}
      <AppStack direction="row" align="start" justify="between" gap="md" wrap>
        <PageTitle>{title}</PageTitle>
        {actions && (
          <AppStack direction="row" align="center" justify="end" gap="sm" wrap>
            {actions}
          </AppStack>
        )}
      </AppStack>

      {metrics && (
        <AppCard>
          <AppStack direction="row" gap="lg" wrap>
            {metrics}
          </AppStack>
        </AppCard>
      )}
    </AppStack>
  )
}
