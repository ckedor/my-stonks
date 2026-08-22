
import { syncDividends } from '@/actions/portfolio'
import DividendForm from '@/components/DividendForm'
import DividendsCategoryChart from '@/components/DividendsCategoryChart'
import {
  AppAutocomplete,
  AppButton,
  AppCard,
  AppChip,
  AppColorSwatch,
  AppDivider,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppText,
  LoadingSpinner,
  PageTitle,
  useAppTheme,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { getLast12MonthDividendStats } from '@/lib/utils/dividends'
import { usePortfolioStore } from '@/stores/portfolio'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import type { Dividend } from '@/types'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'

/** Passando disto a tabela rola por dentro, com o cabeçalho parado. */
const TABLE_MAX_HEIGHT = 500

export default function PortfolioDividendsPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const userCategories = selectedPortfolio?.custom_categories ?? []

  const dividends = useDividendsStore(s => s.dividends)
  const dividendsLoading = useDividendsStore(s => s.loading) && dividends.length === 0
  const { format: formatCurrency } = useCurrency()
  const theme = useAppTheme()

  const loading = dividendsLoading
  const [selectedTicker, setSelectedTicker] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year())

  const [formOpen, setFormOpen] = useState(false)
  const [selectedDividend, setSelectedDividend] = useState<Dividend | null>(null)

  const filteredDividends = useMemo(() => {
    return dividends
      .filter((d) => {
        const matchTicker = selectedTicker ? d.ticker === selectedTicker : true
        const matchCategory = selectedCategory ? d.category === selectedCategory : true
        return matchTicker && matchCategory
      })
      .sort((a, b) => (dayjs(b.date).isAfter(dayjs(a.date)) ? 1 : -1))
  }, [dividends, selectedTicker, selectedCategory])

  const categories = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.category))).sort()
  }, [dividends])

  const categoryColors: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {}
    userCategories.forEach((cat) => {
      map[cat.name] = cat.color
    })
    return map
  }, [userCategories])

  const tickers = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => d.ticker))).sort()
  }, [dividends])

  const years = useMemo(() => {
    return Array.from(new Set(dividends.map((d) => dayjs(d.date).year())))
      .sort((a, b) => b - a)
  }, [dividends])

  // Total received in selected year
  const totalYear = useMemo(() => {
    return filteredDividends
      .filter((d) => dayjs(d.date).year() === selectedYear)
      .reduce((sum, d) => sum + d.amount, 0)
  }, [filteredDividends, selectedYear])

  const { total: total12m, average: average12m } = useMemo(
    () => getLast12MonthDividendStats(dividends),
    [dividends],
  )

  // Category totals for legend
  const categoryTotals = useMemo(() => {
    const yearDividends = filteredDividends.filter((d) => dayjs(d.date).year() === selectedYear)
    const map: Record<string, number> = {}
    yearDividends.forEach((d) => {
      map[d.category] = (map[d.category] ?? 0) + d.amount
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filteredDividends, selectedYear])

  // Dividends for the table (year-filtered)
  const tableDividends = useMemo(() => {
    return filteredDividends.filter((d) => dayjs(d.date).year() === selectedYear)
  }, [filteredDividends, selectedYear])

  const columns: AppSimpleTableColumn<Dividend>[] = [
    { label: 'Data', render: (dividend) => dayjs(dividend.date).format('DD/MM/YYYY') },
    {
      label: 'Ativo',
      render: (dividend) => (
        <AppText variant="bodySmall" weight="strong" inline>
          {dividend.ticker}
        </AppText>
      ),
    },
    {
      label: 'Categoria',
      render: (dividend) => (
        <AppChip label={dividend.category} tint={categoryColors[dividend.category]} />
      ),
    },
    {
      label: 'Valor',
      align: 'right',
      render: (dividend) => (
        <AppText
          variant="bodySmall"
          weight="strong"
          tone={dividend.amount >= 0 ? 'success' : 'danger'}
          inline
        >
          {dividend.amount >= 0 ? '+ ' : '- '}
          {formatCurrency(Math.abs(dividend.amount))}
        </AppText>
      ),
    },
  ]

  return (
    <AppStack gap="lg">
      <PageTitle>Proventos</PageTitle>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <AppStack direction="row" gap="md" wrap>
            <AppCard minWidth={200}>
              <AppStack gap="xs">
                <AppText variant="caption" tone="secondary">
                  Recebidos nos últimos 12 meses
                </AppText>
                <AppText variant="pageHeading">{formatCurrency(total12m)}</AppText>
              </AppStack>
            </AppCard>
            <AppCard minWidth={200}>
              <AppStack gap="xs">
                <AppText variant="caption" tone="secondary">
                  Média dos últimos 12 meses
                </AppText>
                <AppText variant="pageHeading">{formatCurrency(average12m)}</AppText>
              </AppStack>
            </AppCard>
            <AppCard minWidth={200}>
              <AppStack gap="xs">
                <AppText variant="caption" tone="secondary">
                  Total em {selectedYear}
                </AppText>
                <AppText variant="pageHeading">{formatCurrency(totalYear)}</AppText>
              </AppStack>
            </AppCard>
          </AppStack>

          <AppStack direction="row" gap="md" align="center" wrap>
            <AppAutocomplete
              label="Ativo"
              size="sm"
              options={tickers}
              value={selectedTicker || null}
              onChange={(value) => setSelectedTicker(value ?? '')}
              getOptionLabel={(ticker) => ticker}
              isOptionEqualToValue={(option, value) => option === value}
            />

            <AppSelect
              label="Categoria"
              options={[
                { value: '', label: 'Todas' },
                ...categories.map((category) => ({ value: category, label: category })),
              ]}
              value={selectedCategory}
              onChange={setSelectedCategory}
            />

            <AppSelect
              label="Ano"
              size="auto"
              options={years.map((year) => ({ value: String(year), label: String(year) }))}
              value={String(selectedYear)}
              onChange={(value) => setSelectedYear(Number(value))}
            />

            <AppButton
              size="sm"
              onClick={() => {
                setSelectedDividend(null)
                setFormOpen(true)
              }}
            >
              + Novo
            </AppButton>
          </AppStack>

          <AppCard>
            <AppStack gap="md">
              <DividendsCategoryChart
                dividends={filteredDividends}
                categoryColors={categoryColors}
                year={selectedYear}
                size={320}
              />

              {/* O total de cada categoria no ano, colado ao gráfico que as
                  empilha: é a leitura que a barra empilhada não dá. */}
              {categoryTotals.length > 0 && (
                <>
                  <AppDivider />
                  <AppStack direction="row" gap="md" wrap>
                    {categoryTotals.map(([category, total]) => (
                      <AppStack key={category} direction="row" align="center" gap="xs">
                        <AppColorSwatch color={categoryColors[category] ?? theme.palette.primary.main} />
                        <AppText variant="caption" tone="secondary">
                          {category}
                        </AppText>
                        <AppText variant="caption" weight="strong">
                          {formatCurrency(total)}
                        </AppText>
                      </AppStack>
                    ))}
                  </AppStack>
                </>
              )}
            </AppStack>
          </AppCard>

          <AppCard padding="none">
            <AppSimpleTable
              rows={tableDividends}
              columns={columns}
              getRowKey={(dividend) => dividend.id}
              maxHeight={TABLE_MAX_HEIGHT}
              onRowClick={(dividend) => {
                setSelectedDividend(dividend)
                setFormOpen(true)
              }}
              emptyMessage="Nenhum provento encontrado"
            />
          </AppCard>
        </>
      )}

      <DividendForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={() => {
          setFormOpen(false)
          if (selectedPortfolio) syncDividends(selectedPortfolio.id, true)
        }}
        dividend={selectedDividend ?? undefined}
      />
    </AppStack>
  )
}
