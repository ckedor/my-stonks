import { AppPageHeader, AppSelect, AppStack, AppTabs } from '@/components/ui'
import { usePortfolioStore } from '@/stores/portfolio'
import dayjs from 'dayjs'
import { useState } from 'react'
import AssetsAndRights from './AssetsAndRights'
import DarfSummaryTable from './DarfSummaryTable'
import MonthlyGainsTable from './MonthlyGainsTable'

type TaxTab = 'darf' | 'assets' | 'fii' | 'common'

const TABS = [
  { id: 'darf' as const, label: 'DARF' },
  { id: 'assets' as const, label: 'Bens e Direitos' },
  { id: 'fii' as const, label: 'Apuração FIIs' },
  { id: 'common' as const, label: 'Apuração Operações Comuns' },
]

export default function TaxIncomePage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const [fiscalYear, setFiscalYear] = useState(dayjs().year() - 1)
  const [tab, setTab] = useState<TaxTab>('darf')

  const years = Array.from({ length: 5 }, (_, i) => dayjs().year() - i)

  if (!selectedPortfolio?.id) return null

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Declaração IR"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Declaração IR' },
        ]}
        actions={
          <AppSelect
            label="Ano"
            size="auto"
            options={years.map((year) => ({ value: String(year), label: String(year) }))}
            value={String(fiscalYear)}
            onChange={(value) => setFiscalYear(Number(value))}
          />
        }
      />

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Seções da declaração" />

      {tab === 'darf' && (
        <DarfSummaryTable fiscalYear={fiscalYear} portfolioId={selectedPortfolio.id} />
      )}
      {tab === 'assets' && (
        <AssetsAndRights fiscalYear={fiscalYear} portfolioId={selectedPortfolio.id} />
      )}
      {tab === 'fii' && (
        <MonthlyGainsTable scope="fii" fiscalYear={fiscalYear} portfolioId={selectedPortfolio.id} />
      )}
      {tab === 'common' && (
        <MonthlyGainsTable scope="common" fiscalYear={fiscalYear} portfolioId={selectedPortfolio.id} />
      )}
    </AppStack>
  )
}
