import type { IncomeTaxAssessment, TaxRegime } from '@/api/incomeTax'
import {
  AppEmptyState,
  AppMetric,
  AppPageHeader,
  AppSelect,
  AppStack,
  AppTabs,
} from '@/components/ui'
import { useIncomeTaxAssessment } from '@/queries/incomeTax'
import dayjs from 'dayjs'
import { useState } from 'react'
import AssetsAndRightsTab from './AssetsAndRightsTab'
import CapitalGainsTab from './CapitalGainsTab'
import DarfTable from './DarfTable'
import IncomeTab from './IncomeTab'
import TaxIncomeSkeleton from './TaxIncomeSkeleton'
import TaxPendencies from './TaxPendencies'
import TaxesPaidTab from './TaxesPaidTab'
import VariableIncomeTab from './VariableIncomeTab'
import { formatTaxValue, money } from './format'

/* Imposto de renda sobre investimentos.
 *
 * Cada aba depois do DARF é uma ficha do programa do IRPF, com os campos na
 * ordem em que ele os pede e um botão de copiar em cada um: a declaração se
 * preenche copiando daqui. O programa não importa arquivo de terceiros, então
 * é o caminho que existe.
 *
 * A apuração é do contribuinte: soma todas as carteiras, porque o limite de
 * isenção, o custo médio e o prejuízo a compensar são do CPF. Tudo sai de uma
 * resposta só, calculada no backend — nenhuma aba refaz conta. */

type TaxTab =
  | 'darf'
  | 'assets'
  | 'exempt'
  | 'exclusive'
  | 'common'
  | 'real_estate_fund'
  | 'capital_gains'
  | 'taxes_paid'

const TABS = [
  { id: 'darf' as const, label: 'DARF' },
  { id: 'assets' as const, label: 'Bens e Direitos' },
  { id: 'exempt' as const, label: 'Rendimentos Isentos' },
  { id: 'exclusive' as const, label: 'Tributação Exclusiva' },
  { id: 'common' as const, label: 'Renda Variável' },
  { id: 'real_estate_fund' as const, label: 'FII e Fiagro' },
  { id: 'capital_gains' as const, label: 'Ganhos de Capital' },
  { id: 'taxes_paid' as const, label: 'Imposto Pago/Retido' },
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

function TabContent({
  tab,
  assessment,
  fiscalYear,
}: {
  tab: TaxTab
  assessment: IncomeTaxAssessment
  fiscalYear: number
}) {
  const regime = (id: TaxRegime) => assessment.regimes.find((candidate) => candidate.regime === id)

  switch (tab) {
    case 'darf':
      return (
        <DarfTable
          fiscalYear={fiscalYear}
          obligations={assessment.obligations}
          darfMinimum={assessment.darf_minimum}
        />
      )
    case 'assets':
      return <AssetsAndRightsTab items={assessment.assets_and_rights} fiscalYear={fiscalYear} />
    case 'exempt':
      return (
        <IncomeTab
          title="Rendimentos Isentos e Não Tributáveis"
          description="Dividendos por empresa, rendimentos de FII e Fiagro por fundo, e os ganhos isentos do ano: ações com vendas até R$ 20 mil no mês (código 20) e criptoativos até R$ 35 mil (código 05)."
          lines={assessment.exempt_income}
          emptyMessage="Nenhum rendimento isento no ano"
        />
      )
    case 'exclusive':
      return (
        <IncomeTab
          title="Rendimentos Sujeitos à Tributação Exclusiva/Definitiva"
          description="JCP por empresa (código 10), pelo valor líquido. Marque um provento como JCP no cadastro de proventos para ele aparecer aqui."
          lines={assessment.exclusive_income}
          emptyMessage="Nenhum rendimento de tributação exclusiva no ano"
        />
      )
    case 'common':
    case 'real_estate_fund': {
      const selected = regime(tab)
      return selected ? (
        <VariableIncomeTab
          key={`${tab}-${fiscalYear}`}
          regime={selected}
          sales={assessment.sales}
          fiscalYear={fiscalYear}
          title={
            tab === 'common'
              ? 'Renda Variável – Operações Comuns'
              : 'Renda Variável – Fundo de Investimento Imobiliário ou Fiagro'
          }
        />
      ) : null
    }
    case 'capital_gains': {
      const crypto = regime('crypto')
      return crypto ? (
        <CapitalGainsTab
          operations={assessment.capital_gains}
          regime={crypto}
          sales={assessment.sales}
          fiscalYear={fiscalYear}
        />
      ) : null
    }
    case 'taxes_paid':
      return <TaxesPaidTab regimes={assessment.regimes} />
  }
}

export default function TaxIncomePage() {
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
          <AppTabs items={TABS} value={tab} onChange={setTab} label="Fichas da declaração" />
          <TabContent tab={tab} assessment={assessment} fiscalYear={fiscalYear} />
        </>
      )}
    </AppStack>
  )
}
