import type { AssetsAndRightsItem } from '@/api/incomeTax'
import {
  AppCard,
  AppCopyField,
  AppEmptyState,
  AppGrid,
  AppGridItem,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import FormAmount from './FormAmount'

/* A ficha Bens e Direitos, um bem por cartão, os campos na ordem do programa.
 *
 * O valor é o custo, não o mercado: é o que a ficha pede. Um bem por ativo e
 * corretora, com a quantidade daquela corretora vezes o custo médio do
 * contribuinte. Um bem vendido no ano continua na lista, com 31/12 zerado —
 * ele estava na declaração anterior e sai nesta. */

function AssetCard({ item, fiscalYear }: { item: AssetsAndRightsItem; fiscalYear: number }) {
  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionLabel>{`${item.group} – ${item.group_name} · ${item.code} – ${item.code_name}`}</SectionLabel>
          {item.note && (
            <AppText variant="bodySmall" tone="caution">
              {item.note}
            </AppText>
          )}
        </AppStack>
        <AppGrid cols={{ xs: 1, sm: 2, md: 4 }} gap="md">
          <AppCopyField label="Grupo" value={item.group} />
          <AppCopyField label="Código" value={item.code} />
          <AppCopyField
            label="Localização (país)"
            value={`${item.country_code} – ${item.country_name}`}
            copyValue={item.country_code}
          />
          {item.cnpj_label && <AppCopyField label={item.cnpj_label} value={item.cnpj ?? ''} />}
          {item.traded_on_exchange !== null && (
            <AppCopyField
              label="Negociados em bolsa?"
              value={item.traded_on_exchange ? 'Sim' : 'Não'}
            />
          )}
          {item.ticker && <AppCopyField label="Código de negociação" value={item.ticker} />}
          <AppGridItem span={{ xs: 1, sm: 2, md: 4 }}>
            <AppCopyField label="Discriminação" value={item.discrimination} multiline />
          </AppGridItem>
          <FormAmount
            label={`Situação em 31/12/${fiscalYear - 1} (R$)`}
            value={item.previous_value}
          />
          <FormAmount label={`Situação em 31/12/${fiscalYear} (R$)`} value={item.current_value} />
        </AppGrid>
      </AppStack>
    </AppCard>
  )
}

export default function AssetsAndRightsTab({
  items,
  fiscalYear,
}: {
  items: AssetsAndRightsItem[]
  fiscalYear: number
}) {
  if (items.length === 0) {
    return (
      <AppEmptyState
        size="section"
        title="Nenhum bem a declarar"
        description={`Sem posição em 31/12/${fiscalYear - 1} nem em 31/12/${fiscalYear}.`}
      />
    )
  }
  return (
    <AppStack gap="md">
      <SectionTitle>{`Bens e Direitos (${items.length})`}</SectionTitle>
      <AppText variant="bodySmall" tone="secondary">
        Um bem por ativo e corretora, pelo custo de aquisição — soma todas as suas carteiras. Os
        valores são copiados sem separador de milhar, como o campo do programa aceita.
      </AppText>
      {items.map((item) => (
        <AssetCard key={`${item.asset_id}-${item.broker_id}`} item={item} fiscalYear={fiscalYear} />
      ))}
    </AppStack>
  )
}
