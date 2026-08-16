import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import {
    AppCard,
    AppHeroMetric,
    AppStack,
    AppText,
    LoadingSpinner,
    PageTitle,
    type AppSelectOption,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import { useReturnsStore } from '@/stores/portfolio/returns'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import PortfolioMonthlyAportsChart from './PortfolioMonthlyAportsChart'

export default function PortfolioPatrimonyEvolution() {
  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)
  const userCategories = selectedPortfolio?.custom_categories ?? []
  const { format: formatCurrency } = useCurrency()

  const patrimonyEvolution = usePatrimonyStore((s) => s.patrimony)
  const loading = usePatrimonyStore((s) => s.loading) && patrimonyEvolution.length === 0
  const categoryCagr = useReturnsStore((s) => s.categoryCagr)

  const [selectedCategory, setSelectedCategory] = useState<string>('portfolio')

  const categoryOptions = useMemo<AppSelectOption[]>(
    () => [
      { value: 'portfolio', label: 'Carteira' },
      ...userCategories.map((category) => ({ value: category.name, label: category.name })),
    ],
    [userCategories],
  )

  /* O patrimônio de hoje é o último ponto da série escolhida, e não a soma das
     posições: a página inteira fala da série, e um número vindo de outra fonte
     apareceria em desacordo com a ponta da própria curva logo abaixo dele. */
  const current = useMemo(() => {
    for (let i = patrimonyEvolution.length - 1; i >= 0; i--) {
      const value = patrimonyEvolution[i][selectedCategory]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return { value, date: patrimonyEvolution[i].date }
      }
    }
    return null
  }, [patrimonyEvolution, selectedCategory])

  const categoryLabel =
    categoryOptions.find((option) => option.value === selectedCategory)?.label ?? 'Carteira'

  /* O que a projeção assume por padrão: o que a carteira já vem fazendo.
   *
   *  A taxa é o CAGR da série escolhida, que o store guarda em fração. */
  const defaultRate = useMemo(() => {
    const cagr = categoryCagr[selectedCategory]
    return cagr == null ? null : Number((cagr * 100).toFixed(2))
  }, [categoryCagr, selectedCategory])

  /* O aporte é a média mensal do que entrou, e ele é líquido: `aported` vem do
   *  backend como quantidade × preço somada por dia, e venda entra com
   *  quantidade negativa — então resgate já desconta sozinho, sem a página
   *  precisar tratar saída como caso à parte.
   *
   *  A média é do histórico inteiro, e não dos últimos doze meses: o número
   *  serve de ponto de partida para uma projeção de anos, e uma janela curta
   *  faria um mês atípico virar a premissa de uma década. É portfolio-wide,
   *  igual para toda categoria — `aported` não é recortado por categoria. */
  const defaultContribution = useMemo(() => {
    if (patrimonyEvolution.length === 0) return null

    let total = 0
    for (const entry of patrimonyEvolution) {
      const value = entry.aported
      if (typeof value === 'number' && Number.isFinite(value)) total += value
    }
    if (total === 0) return null

    const first = dayjs(patrimonyEvolution[0].date)
    const last = dayjs(patrimonyEvolution[patrimonyEvolution.length - 1].date)
    const months = Math.max(1, last.diff(first, 'month'))

    return Math.round(total / months)
  }, [patrimonyEvolution])

  if (loading) return <LoadingSpinner />

  return (
    <AppStack gap="lg">
      <PageTitle>Evolução do Patrimônio</PageTitle>

      <AppHeroMetric
        label={selectedCategory === 'portfolio' ? 'Patrimônio' : `Patrimônio · ${categoryLabel}`}
        value={current ? formatCurrency(current.value) : '—'}
        detail={
          current && (
            <AppText variant="bodySmall" tone="secondary">
              Última posição em {new Date(current.date).toLocaleDateString('pt-BR')}
            </AppText>
          )
        }
      />

      <AppCard>
        <PortfolioPatrimonyChart
          patrimonyEvolution={patrimonyEvolution}
          selected={selectedCategory}
          onSelectedChange={setSelectedCategory}
          categoryOptions={categoryOptions}
          defaultRate={defaultRate}
          defaultContribution={defaultContribution}
          height={520}
          persistKey="portfolio-patrimony"
        />
      </AppCard>

      <AppCard>
        <PortfolioMonthlyAportsChart height={300} groupBy="month" defaultRange="1y" />
      </AppCard>
    </AppStack>
  )
}
