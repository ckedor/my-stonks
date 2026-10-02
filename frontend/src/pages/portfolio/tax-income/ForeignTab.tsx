import type { ForeignItem, ForeignYear } from '@/api/incomeTax'
import {
  AppCard,
  AppEmptyState,
  AppGrid,
  AppMetric,
  AppMetricRow,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import FormAmount from './FormAmount'
import { formatRate, formatTaxValue, gainTone, money } from './format'

/* Aplicações financeiras no exterior (Lei 14.754/2023).
 *
 * Não há DARF: o rendimento do ano vai para a declaração, no quadro
 * "Aplicação Financeira (R$)" de cada bem em Bens e Direitos, e o programa
 * aplica os 15%. Esta aba mostra de onde sai cada "Rendimento ou Perda" —
 * vendas e dividendos — e o resumo do ano, que é a conta que o programa refaz
 * e serve para conferir, não para digitar. */

function ItemCard({ item }: { item: ForeignItem }) {
  return (
    <AppCard>
      <AppStack gap="md">
        <SectionLabel>{item.ticker}</SectionLabel>
        <AppMetricRow>
          <AppMetric label="Vendas no ano" value={formatTaxValue(item.sales_value)} />
          <AppMetric
            label="Resultado das vendas"
            value={formatTaxValue(item.sales_result)}
            tone={gainTone(item.sales_result)}
          />
          <AppMetric
            label="Dividendos recebidos"
            hint="Como lançados: o que caiu na conta, já sem os 30% retidos nos EUA."
            value={formatTaxValue(item.dividends_received)}
          />
          <AppMetric
            label="Dividendos brutos"
            hint="O recebido dividido por 0,7: o rendimento que a declaração pede."
            value={formatTaxValue(item.dividends_gross)}
          />
        </AppMetricRow>
        <AppGrid cols={{ xs: 1, sm: 2, md: 4 }} gap="md">
          <FormAmount label="Rendimento ou Perda" value={item.income} />
          <FormAmount label="Imposto pago no Exterior" value={item.tax_paid_abroad} />
        </AppGrid>
        {money(item.tax_withheld_abroad) > money(item.tax_paid_abroad) && (
          <AppText variant="caption" tone="secondary">
            {`Retidos ${formatTaxValue(item.tax_withheld_abroad)} nos EUA; compensa-se só até os 15% do imposto brasileiro sobre o dividendo.`}
          </AppText>
        )}
      </AppStack>
    </AppCard>
  )
}

function YearSummary({ year }: { year: ForeignYear }) {
  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>Resumo do ano</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          {`Perda de um bem compensa o ganho de outro no mesmo ano, e o que sobra passa aos anos seguintes. Alíquota de ${formatRate(year.rate)} sobre a base; o imposto pago no exterior abate o devido. O programa faz esta conta a partir dos quadros — ela está aqui para conferir.`}
        </AppText>
        <AppMetricRow>
          <AppMetric label="Rendimentos" value={formatTaxValue(year.gains)} tone="success" />
          <AppMetric label="Perdas" value={formatTaxValue(year.losses)} tone="danger" />
          <AppMetric
            label="Perda de anos anteriores usada"
            value={formatTaxValue(year.loss_used)}
          />
          <AppMetric label="Base de cálculo" value={formatTaxValue(year.taxable_base)} />
        </AppMetricRow>
        <AppMetricRow>
          <AppMetric label="Imposto devido" value={formatTaxValue(year.tax_due)} />
          <AppMetric label="Imposto pago no exterior" value={formatTaxValue(year.tax_credit)} />
          <AppMetric
            label="A pagar no ajuste"
            hint="Entra no saldo da declaração: paga-se com o imposto a pagar, não por DARF mensal."
            value={formatTaxValue(year.tax_payable)}
            tone={money(year.tax_payable) > 0 ? 'danger' : 'default'}
          />
          <AppMetric
            label="Perda para o ano seguinte"
            value={formatTaxValue(year.loss_carried_out)}
          />
        </AppMetricRow>
        {year.source && (
          <AppText variant="caption" tone="secondary">
            {year.source}
          </AppText>
        )}
      </AppStack>
    </AppCard>
  )
}

export default function ForeignTab({
  year,
  fiscalYear,
}: {
  year: ForeignYear | null
  fiscalYear: number
}) {
  if (!year || !year.covered) {
    return (
      <AppEmptyState
        size="section"
        title="Sem apuração anual neste ano"
        description={`A apuração anual das aplicações no exterior vale de 2024 em diante (Lei 14.754/2023). Em ${fiscalYear}, venda no exterior era ganho de capital, no GCAP.`}
      />
    )
  }
  return (
    <AppStack gap="lg">
      <AppStack gap="md">
        <SectionTitle>{`Aplicações no exterior (${year.items.length})`}</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          Os dois campos de cada bem vão no quadro “Aplicação Financeira (R$)” do item dele em Bens
          e Direitos — a aba Bens e Direitos já os mostra no cartão do bem. Bem sem venda nem
          dividendo no ano leva o quadro zerado.
        </AppText>
        {year.items.length === 0 ? (
          <AppText variant="bodySmall">Nenhuma venda nem dividendo no exterior no ano.</AppText>
        ) : (
          year.items.map((item) => (
            <ItemCard key={`${item.asset_id}-${item.broker_id}`} item={item} />
          ))
        )}
      </AppStack>
      <YearSummary year={year} />
    </AppStack>
  )
}
