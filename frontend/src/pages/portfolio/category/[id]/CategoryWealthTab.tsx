import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import { AppCard, AppText } from '@/components/ui'
import type { PatrimonyEntry } from '@/types'

interface Props {
  /** Nome da categoria, que é a coluna dela na evolução patrimonial. */
  category: string
  patrimonyEvolution: PatrimonyEntry[]
  /** CAGR da categoria em fração, o que a projeção assume por padrão. */
  cagr: number | null
}

/** A evolução patrimonial da categoria.
 *
 *  Sem o gráfico de aportes que a tela da carteira mostra ao lado: `aported`
 *  vem somado por dia para a carteira inteira e não é recortado por categoria,
 *  então ali ele seria o número da carteira sob o título de uma categoria. */
export default function CategoryWealthTab({ category, patrimonyEvolution, cagr }: Props) {
  if (patrimonyEvolution.length === 0) {
    return <AppText tone="secondary">Sem histórico de patrimônio para esta categoria.</AppText>
  }

  return (
    <AppCard>
      <PortfolioPatrimonyChart
        patrimonyEvolution={patrimonyEvolution}
        selected={category}
        /* A categoria é a da página: o seletor não tem para onde levar. */
        onSelectedChange={() => {}}
        categoryOptions={[{ value: category, label: category }]}
        defaultRate={cagr == null ? null : Number((cagr * 100).toFixed(2))}
        height={480}
        persistKey={`category-patrimony:${category}`}
      />
    </AppCard>
  )
}
