import type { RealizedSale, RegimeAssessment } from '@/api/incomeTax'
import {
  AppCard,
  AppCopyField,
  AppGrid,
  AppSelect,
  AppStack,
  AppText,
  SectionTitle,
} from '@/components/ui'
import dayjs from 'dayjs'
import { useState } from 'react'
import FormAmount from './FormAmount'
import RegimeTable from './RegimeTable'
import { money } from './format'

/* A ficha Renda Variável: um formulário por mês, como o programa.
 *
 * Operações comuns e FII/Fiagro são duas fichas com os mesmos campos, menos a
 * linha do mercado à vista, que só as operações comuns têm. O mês que abre é o
 * primeiro com algo a declarar — um mês só de ganho isento não tem nada aqui;
 * os campos seguem a ordem do programa. Abaixo, o
 * quadro do ano inteiro e as vendas, para conferir. */

interface Props {
  regime: RegimeAssessment
  sales: RealizedSale[]
  fiscalYear: number
  title: string
}

const hasMovement = (month: RegimeAssessment['months'][number]) =>
  money(month.net_result) !== 0 || money(month.loss_carried_out) !== 0 || money(month.tax_due) !== 0

export default function VariableIncomeTab({ regime, sales, fiscalYear, title }: Props) {
  const firstActive = regime.months.findIndex(hasMovement)
  const [index, setIndex] = useState(firstActive === -1 ? 0 : firstActive)
  const month = regime.months[index]
  const rate = regime.rate === null ? '' : (Number(regime.rate) * 100).toFixed(2).replace('.', ',')

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack gap="md">
          <AppStack direction="row" align="center" justify="between" gap="md" wrap>
            <SectionTitle>{title}</SectionTitle>
            <AppSelect
              label="Mês"
              size="sm"
              options={regime.months.map((candidate, position) => ({
                value: String(position),
                label: dayjs(candidate.month).format('MMMM'),
              }))}
              value={String(index)}
              onChange={(value) => setIndex(Number(value))}
            />
          </AppStack>
          <AppText variant="bodySmall" tone="secondary">
            {regime.regime === 'common'
              ? 'O ganho de ações em mês de vendas até R$ 20 mil não entra aqui: vai para Rendimentos Isentos (código 20). ETF e BDR entram na linha de ações do mercado à vista.'
              : 'Resultado das vendas de cotas de FII e Fiagro, com prejuízo separado do das operações comuns.'}
          </AppText>
          {month && (
            <AppGrid cols={{ xs: 1, sm: 2, md: 3 }} gap="md">
              {regime.regime === 'common' && (
                <FormAmount
                  label="Mercado à vista – ações (operações comuns)"
                  value={month.net_result}
                />
              )}
              <FormAmount label="Resultado líquido do mês" value={month.net_result} />
              <FormAmount
                label="Resultado negativo até o mês anterior"
                value={month.loss_carried_in}
              />
              <FormAmount label="Base de cálculo do imposto" value={month.taxable_base} />
              <FormAmount label="Prejuízo a compensar" value={month.loss_carried_out} />
              <AppCopyField label="Alíquota do imposto (%)" value={rate} />
              <FormAmount label="Imposto devido" value={month.tax_due} />
              <FormAmount
                label="IR fonte (Lei 11.033/2004) no mês"
                value={month.withheld_in_month}
              />
              <FormAmount
                label="IR fonte (Lei 11.033/2004) de meses anteriores"
                value={month.withheld_carried_in}
              />
              <FormAmount label="IR fonte a compensar" value={month.withheld_carried_out} />
              <FormAmount label="Imposto a pagar" value={month.tax_payable} />
              <FormAmount label="Imposto pago" value={month.tax_paid} />
            </AppGrid>
          )}
          <AppText variant="caption" tone="secondary">
            Imposto pago é o que você registrou na aba DARF; um DARF que juntou operações comuns e
            FII é repartido entre as duas fichas na proporção do imposto de cada uma.
          </AppText>
        </AppStack>
      </AppCard>

      <RegimeTable regime={regime} sales={sales} fiscalYear={fiscalYear} />
    </AppStack>
  )
}
