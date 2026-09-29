import type { IncomeTaxAssessment } from '@/api/incomeTax'
import {
  AppEmptyState,
  AppMetric,
  AppPageHeader,
  AppSelect,
  AppStack,
  AppTabs,
} from '@/components/ui'
import { useIncomeTaxAssessment } from '@/queries/incomeTax'
import { useSelectedPortfolio } from '@/queries/portfolio'
import dayjs from 'dayjs'
import { useState } from 'react'
import AssetsAndRights from './AssetsAndRights'
import DarfTable from './DarfTable'
import RegimeTable from './RegimeTable'
import TaxIncomeSkeleton from './TaxIncomeSkeleton'
import TaxPendencies from './TaxPendencies'
import { formatTaxValue, money } from './format'

/* Imposto de renda sobre investimentos.
 *
 * A apuração é do contribuinte: soma todas as carteiras, porque o limite de
 * isenção e o prejuízo a compensar são do CPF. DARF, operações comuns, FII e
 * cripto são recortes da mesma apuração, calculada no backend — nenhuma aba
 * refaz conta. Bens e Direitos ainda é da carteira aberta. */

type TaxTab = 'darf' | 'common' | 'real_estate_fund' | 'crypto' | 'assets'

const TABS = [
  { id: 'darf' as const, label: 'DARF' },
  { id: 'common' as const, label: 'Operações comuns' },
  { id: 'real_estate_fund' as const, label: 'FII e Fiagro' },
  { id: 'crypto' as const, label: 'Cripto' },
  { id: 'assets' as const, label: 'Bens e Direitos' },
]

const YEARS = 6

function metrics(assessment: IncomeTaxAssessment) {
  const sum = (values: string[]) => values.reduce((total, value) => total + money(value), 0)
  const taxDue = sum(assessment.regimes.flatMap((regime) => regime.months.map((m) => m.tax_due)))
  const open = sum(assessment.obligations.map((obligation) => obligation.balance))
  const overdue = assessment.obligations.some((obligation) => obligation.status === 'overdue')
  const losses = sum(assessment.regimes.map((regime) => regime.loss_to_carry))
  const withheld = sum(assessment.regimes.map((regime) => regime.withheld_to_declare))
  return (
    <AppStack direction="row" gap="xl" wrap>
      <AppMetric
        label="Imposto apurado no ano"
        hint="Soma todas as suas carteiras: o limite de isenção e o prejuízo a compensar são do CPF."
        value={formatTaxValue(taxDue)}
      />
      <AppMetric
        label="DARF em aberto"
        value={formatTaxValue(open)}
        tone={overdue ? 'danger' : 'default'}
      />
      <AppMetric
        label="Prejuízo a compensar em 31/12"
        hint="Operações comuns e FII, para a ficha de Renda Variável da declaração."
        value={formatTaxValue(losses)}
      />
      <AppMetric
        label="IRRF para a declaração"
        hint="Retido nas vendas e não compensado no ano."
        value={formatTaxValue(withheld)}
      />
    </AppStack>
  )
}

export default function TaxIncomePage() {
  const selectedPortfolio = useSelectedPortfolio()
  const [fiscalYear, setFiscalYear] = useState(dayjs().year() - 1)
  const [tab, setTab] = useState<TaxTab>('darf')
  const { data: assessment, isPending, isError } = useIncomeTaxAssessment(fiscalYear)

  const years = Array.from({ length: YEARS }, (_, i) => dayjs().year() - i)
  /* O ano da tela é o ano-calendário, e a declaração dele é entregue no ano
     seguinte: o seletor diz os dois para ninguém escolher 2026 esperando a
     declaração de 2026. */
  const yearSelect = (
    <AppSelect
      label="Ano-calendário"
      size="md"
      options={years.map((year) => ({
        value: String(year),
        label: `${year} · declaração ${year + 1}`,
      }))}
      value={String(fiscalYear)}
      onChange={(value) => setFiscalYear(Number(value))}
    />
  )

  if (isPending) return <TaxIncomeSkeleton />

  const regime = assessment?.regimes.find((candidate) => candidate.regime === tab)

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Declaração IR"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Declaração IR' },
        ]}
        actions={yearSelect}
        metrics={assessment ? metrics(assessment) : undefined}
      />

      {isError || !assessment ? (
        <AppEmptyState
          size="section"
          title="Não foi possível apurar o imposto"
          description="A apuração do ano não respondeu. Tente de novo em instantes."
        />
      ) : (
        <>
          <TaxPendencies pendencies={assessment.pendencies} />

          <AppTabs items={TABS} value={tab} onChange={setTab} label="Seções da declaração" />

          {tab === 'darf' && (
            <DarfTable
              fiscalYear={fiscalYear}
              obligations={assessment.obligations}
              darfMinimum={assessment.darf_minimum}
            />
          )}
          {regime && (
            <RegimeTable regime={regime} sales={assessment.sales} fiscalYear={fiscalYear} />
          )}
          {tab === 'assets' && selectedPortfolio?.id && (
            <AssetsAndRights fiscalYear={fiscalYear} portfolioId={selectedPortfolio.id} />
          )}
        </>
      )}
    </AppStack>
  )
}
