import type { EtfProfile } from '@/api/etf'
import {
  AppCard,
  AppChip,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'

import { EMPTY, formatCNPJ, formatCompactUSD, formatCount, formatDate } from '@/components/asset/format'
import { countryName, DISTRIBUTION_LABEL, REGISTRY_LABEL } from '@/components/etf/labels'

interface Fact {
  label: string
  value: string | null
  /** Identificador: vai em fonte menor, porque é para copiar e não para ler. */
  code?: boolean
}

function Facts({ facts }: { facts: Fact[] }) {
  const shown = facts.filter((fact) => fact.value)
  return (
    <AppStack gap="sm">
      {shown.map((fact) => (
        <AppStack key={fact.label} gap="none">
          <AppText variant="caption" tone="secondary">
            {fact.label}
          </AppText>
          <AppText variant={fact.code ? 'bodySmall' : 'body'}>{fact.value ?? EMPTY}</AppText>
        </AppStack>
      ))}
    </AppStack>
  )
}

/** Quem é o ETF, como o regulador o registra.
 *
 *  As características que mudam a leitura do fundo vêm primeiro, como
 *  etiquetas: onde ele é domiciliado (é o que decide imposto sobre provento e
 *  sobre herança), se segue índice, se é alavancado, se acumula. Depois quem
 *  o gere, e por último os identificadores — para conferir, não para ler.
 */
export default function EtfFundCard({ profile }: { profile: EtfProfile }) {
  const { fund, share_class: shareClass, cvm_fund: cvmFund, holdings, registry } = profile

  if (cvmFund) {
    return (
      <AppCard height="100%">
        <AppStack gap="md">
          <SectionTitle>O fundo</SectionTitle>
          <AppStack direction="row" gap="xs" wrap>
            <AppChip label="Domicílio: Brasil" emphasis="outline" />
            <AppChip label={cvmFund.status} emphasis="outline" />
          </AppStack>
          <Facts
            facts={[
              { label: 'Razão social', value: cvmFund.name },
              { label: 'Administrador', value: cvmFund.administrator_name },
              { label: 'Gestor', value: cvmFund.manager_name },
              { label: 'Início', value: cvmFund.started_at ? formatDate(cvmFund.started_at) : null },
              { label: 'CNPJ', value: formatCNPJ(cvmFund.cnpj), code: true },
              { label: 'Cadastro', value: REGISTRY_LABEL.cvm },
            ]}
          />
        </AppStack>
      </AppCard>
    )
  }

  if (!fund || !shareClass) {
    return (
      <AppCard height="100%">
        <AppStack gap="sm">
          <SectionTitle>O fundo</SectionTitle>
          <AppText variant="bodySmall" tone="secondary">
            Este ETF ainda não está ligado a um cadastro de regulador. Um trust de
            commodity ou de cripto, como o de ouro ou o de bitcoin, não é fundo de
            investimento e não entra em nenhum.
          </AppText>
        </AppStack>
      </AppCard>
    )
  }

  const traits = [
    `Domicílio: ${countryName(fund.domicile) ?? fund.domicile}`,
    fund.tracks_index ? 'Segue um índice' : fund.tracks_index === false ? 'Gestão ativa' : null,
    fund.leveraged_or_inverse ? 'Alavancado ou inverso' : null,
    fund.fund_of_funds ? 'Fundo de fundos' : null,
    shareClass.distribution_policy ? DISTRIBUTION_LABEL[shareClass.distribution_policy] : null,
    fund.status === 'inactive' ? 'Fora da lista atual do regulador' : null,
  ].filter((trait): trait is string => Boolean(trait))

  const managers = fund.managers.map((manager) => manager.name).join(', ')

  return (
    <AppCard height="100%">
      <AppStack gap="md">
        <SectionTitle>O fundo</SectionTitle>
        <AppText variant="bodySmall" weight="strong">
          {fund.name}
        </AppText>
        <AppStack direction="row" gap="xs" wrap>
          {traits.map((trait) => (
            <AppChip key={trait} label={trait} emphasis="outline" />
          ))}
        </AppStack>

        <Facts
          facts={[
            { label: fund.managers.length > 1 ? 'Gestoras' : 'Gestora', value: managers || null },
            {
              label: registry === 'sec' ? 'Trust' : 'Guarda-chuva',
              value: fund.umbrella?.name ?? null,
            },
            {
              label: 'Patrimônio líquido',
              value: holdings?.net_assets
                ? `${formatCompactUSD(holdings.net_assets)} em ${formatDate(holdings.report_date)}`
                : null,
            },
            {
              label: 'Posições',
              value: holdings ? formatCount(holdings.holdings_count) : null,
            },
            { label: 'Moeda da classe', value: shareClass.currency },
          ]}
        />

        <AppStack gap="sm">
          <SectionLabel>Identificação</SectionLabel>
          <Facts
            facts={[
              { label: 'Cadastro', value: registry ? REGISTRY_LABEL[registry] : null },
              { label: 'Série na SEC', value: fund.sec_series_id, code: true },
              { label: 'Classe na SEC', value: shareClass.sec_class_id, code: true },
              { label: 'ISIN', value: shareClass.isin, code: true },
              { label: 'LEI do fundo', value: fund.lei, code: true },
              { label: 'Código CFI', value: shareClass.cfi_code, code: true },
            ]}
          />
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
