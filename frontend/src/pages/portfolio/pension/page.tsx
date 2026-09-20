import {
  AppCard,
  AppEmptyState,
  AppMetric,
  AppNumberField,
  AppPageHeader,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
} from '@/components/ui'
import { formatBRL, formatNumber } from '@/lib/utils/format'
import { useMemo, useState } from 'react'
import HowPgblWorks from './HowPgblWorks'
import { planPgbl, type PgblTranche } from './pgbl'

/* Quanto aportar em PGBL no ano para pagar menos imposto.
 *
 * A tela não guarda nada e não pergunta nada ao backend: salário e bônus são
 * dados de quem está na frente dela, não da carteira, e a conta inteira mora
 * em `pgbl.ts`. Recarregar a página limpa os campos, que é o comportamento
 * certo para um número que a pessoa não pediu para salvar em lugar nenhum. */

const PERCENT = (rate: number) => `${formatNumber(rate * 100, 1)}%`

interface ScenarioRow {
  id: string
  scenario: string
  deductions: number
  base: number
  tax: number
  /** O cenário que a tela recomenda — o único com o aporte dentro. */
  chosen?: boolean
}

const TRANCHE_COLUMNS = [
  { label: 'Faixa', render: (row: PgblTranche) => PERCENT(row.rate) },
  {
    label: 'Abatido nela',
    align: 'right' as const,
    render: (row: PgblTranche) => formatBRL(row.amount),
  },
  {
    label: 'Imposto economizado',
    align: 'right' as const,
    render: (row: PgblTranche) => (
      <AppText variant="bodySmall" tone="success" weight="strong" noWrap>
        {formatBRL(row.saving)}
      </AppText>
    ),
  },
]

const SCENARIO_COLUMNS = [
  {
    label: 'Cenário',
    render: (row: ScenarioRow) => (
      <AppText variant="bodySmall" weight={row.chosen ? 'strong' : 'regular'}>
        {row.scenario}
      </AppText>
    ),
  },
  {
    label: 'Deduções',
    align: 'right' as const,
    render: (row: ScenarioRow) => formatBRL(row.deductions),
  },
  {
    label: 'Base de cálculo',
    align: 'right' as const,
    render: (row: ScenarioRow) => formatBRL(row.base),
  },
  {
    label: 'Imposto no ano',
    align: 'right' as const,
    render: (row: ScenarioRow) => (
      <AppText variant="bodySmall" weight={row.chosen ? 'strong' : 'regular'} noWrap>
        {formatBRL(row.tax)}
      </AppText>
    ),
  },
]

export default function PensionPage() {
  const [monthlySalary, setMonthlySalary] = useState(0)
  const [annualBonus, setAnnualBonus] = useState(0)

  const plan = useMemo(
    () => planPgbl({ monthlySalary, annualBonus }),
    [monthlySalary, annualBonus],
  )

  const scenarios = useMemo<ScenarioRow[]>(
    () => [
      {
        id: 'simplified',
        scenario: 'Simplificada, sem PGBL',
        deductions: plan.grossIncome - plan.simplifiedBase,
        base: plan.simplifiedBase,
        tax: plan.taxSimplified,
      },
      {
        id: 'complete',
        scenario: 'Completa, só com o INSS',
        deductions: plan.inss,
        base: plan.completeBase,
        tax: plan.taxComplete,
      },
      {
        id: 'pgbl',
        scenario: 'Completa, com o aporte no teto',
        deductions: plan.inss + plan.deduction,
        base: plan.baseWithPgbl,
        tax: plan.taxWithPgbl,
        chosen: true,
      },
    ],
    [plan],
  )

  const hasIncome = plan.grossIncome > 0

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Previdência"
        breadcrumbs={[{ label: 'Carteira', href: '/portfolio/overview' }, { label: 'Previdência' }]}
        actions={
          <>
            <AppNumberField
              label="Salário bruto mensal"
              prefix="R$"
              size="md"
              step={100}
              value={monthlySalary}
              onChange={setMonthlySalary}
            />
            <AppNumberField
              label="Bônus no ano"
              prefix="R$"
              size="md"
              step={100}
              value={annualBonus}
              onChange={setAnnualBonus}
            />
          </>
        }
        metrics={
          hasIncome && (
            <AppStack direction="row" gap="lg" wrap>
              <AppMetric
                size="lg"
                label="Aporte no ano (teto de 12%)"
                value={formatBRL(plan.contributionLimit)}
              />
              <AppMetric
                size="lg"
                label="Aportando por mês"
                value={formatBRL(plan.monthlyContribution)}
              />
              <AppMetric
                size="lg"
                tone="success"
                label="Imposto que deixa de pagar"
                value={formatBRL(plan.refund)}
                suffix={
                  <AppText variant="bodySmall" tone="secondary" inline>
                    {PERCENT(plan.refundRate)} do aporte
                  </AppText>
                }
                hint="Contra o melhor cenário sem PGBL — que para um CLT sem outras deduções costuma ser a declaração simplificada."
              />
              <AppMetric
                label="Renda tributável"
                value={formatBRL(plan.grossIncome)}
                hint="Salário e bônus somados, antes do INSS. É sobre ela que incidem os 12%."
              />
              <AppMetric label="INSS no ano" value={formatBRL(plan.inss)} />
            </AppStack>
          )
        }
      />

      {!hasIncome ? (
        <AppEmptyState
          size="section"
          title="Informe o salário para ver a conta"
          description="A tela calcula a partir do salário bruto mensal e do bônus do ano, e não guarda nenhum dos dois."
        />
      ) : (
        <>
          <AppStack gap="sm">
            <SectionTitle>O imposto do ano, nos três cenários</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              {plan.simplifiedWinsWithoutPgbl
                ? 'Sem o PGBL, a simplificada é a que paga menos imposto: o INSS sozinho não chega ao desconto de 20%. Por isso a restituição acima mede contra ela — é o que o aporte de fato acrescenta.'
                : 'Sem o PGBL, a completa já paga menos imposto que a simplificada, e é contra ela que a restituição acima é medida.'}
            </AppText>
            <AppCard>
              <AppSimpleTable
                rows={scenarios}
                columns={SCENARIO_COLUMNS}
                getRowKey={(row) => row.id}
                isRowSelected={(row) => Boolean(row.chosen)}
              />
            </AppCard>
          </AppStack>

          <AppStack gap="sm">
            <SectionTitle>De onde vem a economia</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              O abatimento desce a tabela progressiva: o primeiro real deduzido
              economiza na alíquota do topo, e os últimos podem já estar numa
              faixa mais baixa. É por isso que a devolução raramente é 27,5%
              cheios do aporte.
            </AppText>
            <AppCard>
              <AppSimpleTable
                rows={plan.tranches}
                columns={TRANCHE_COLUMNS}
                getRowKey={(row) => row.rate}
                emptyMessage="Sua renda tributável está abaixo da faixa de isenção: não há imposto para o PGBL reduzir."
              />
            </AppCard>
          </AppStack>
        </>
      )}

      {/* A explicação não depende da conta: quem abre a tela sem número
          nenhum é justamente quem precisa dela. */}
      <AppStack gap="sm">
        <SectionTitle>Como funciona o PGBL</SectionTitle>
        <AppCard>
          <HowPgblWorks />
        </AppCard>
      </AppStack>
    </AppStack>
  )
}
