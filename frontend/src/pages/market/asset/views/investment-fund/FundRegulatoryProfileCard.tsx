import type { InvestmentFundRegulatoryProfile } from '@/api/market'
import {
  AppCard,
  AppGrid,
  AppMetric,
  AppPieChart,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import { useMemo } from 'react'
import { EMPTY, formatCompactCount, formatDate, formatFiledPercent } from '../format'

const PIE_HEIGHT = 240
const MIN_LABELLED_SLICE = 4

/** Quem detém o fundo, nas categorias do informe e na ordem em que se lê: as
 *  pessoas primeiro, depois as instituições, depois o de fora.
 *
 *  Uma lista só para a pizza e para os números ao lado dela — duas listas
 *  divergiriam na primeira categoria nova, e a tela mostraria composições
 *  diferentes no mesmo card. */
const INVESTOR_GROUPS: {
  label: string
  count: (profile: InvestmentFundRegulatoryProfile) => number | null
  share: (profile: InvestmentFundRegulatoryProfile) => number | null
}[] = [
  {
    label: 'Pessoas físicas',
    count: (p) => p.investors?.individual_retail ?? null,
    share: (p) => p.investors?.individual_retail_percent ?? null,
  },
  {
    label: 'Pessoas jurídicas',
    count: (p) => p.investors?.legal_entities ?? null,
    share: (p) => p.investors?.legal_entities_percent ?? null,
  },
  {
    label: 'Fundos e clubes',
    count: (p) => p.investors?.funds_or_clubs ?? null,
    share: (p) => p.investors?.funds_or_clubs_percent ?? null,
  },
  {
    label: 'Não residentes',
    count: (p) => p.investors?.non_residents ?? null,
    share: (p) => p.investors?.non_residents_percent ?? null,
  },
  {
    label: 'Outros',
    count: (p) => p.investors?.other ?? null,
    share: (p) => p.investors?.other_percent ?? null,
  },
]

/** O informe que o administrador entrega ao regulador todo mês.
 *
 *  Duas perguntas: quem detém o fundo e quanto risco ele declara carregar. A
 *  primeira importa porque um fundo que é 100% de um único cotista pode ser
 *  liquidado por uma decisão só, e a segunda porque exposição a crédito privado
 *  é o que separa um FIDC de um fundo de título público.
 *
 *  O modelo de risco vem junto dos números de risco de propósito: um VaR de
 *  modelo não-paramétrico e um de modelo paramétrico não são a mesma grandeza,
 *  e postos sem o modelo comparam-se como se fossem.
 *
 *  Os percentuais aqui já chegam escalados — 100 são 100% —, ao contrário dos
 *  rendimentos e retornos das outras abas, que são razões.
 */
export default function FundRegulatoryProfileCard({
  profile,
}: {
  profile: InvestmentFundRegulatoryProfile
}) {
  const slices = useMemo(
    () =>
      INVESTOR_GROUPS.map((group) => ({ label: group.label, value: group.share(profile) ?? 0 }))
        .filter((slice) => slice.value > 0),
    [profile]
  )

  const risk = profile.risk

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Perfil mensal</SectionTitle>
          {profile.reference_date && (
            <AppText variant="bodySmall" tone="secondary">
              Informe de {formatDate(profile.reference_date)}
            </AppText>
          )}
        </AppStack>

        <AppStack gap="xs">
          <SectionLabel>Quem detém o fundo</SectionLabel>
          {slices.length > 0 ? (
            <AppGrid cols={{ xs: 1, md: 2 }} gap="md" align="start">
              <AppPieChart
                data={slices}
                height={PIE_HEIGHT}
                minOuterLabelPercentage={MIN_LABELLED_SLICE}
              />
              <AppGrid cols={{ xs: 2, md: 2 }} gap="md">
                {INVESTOR_GROUPS.map((group) => (
                  <AppMetric
                    key={group.label}
                    label={group.label}
                    value={formatFiledPercent(group.share(profile))}
                    tone={group.share(profile) ? 'default' : 'secondary'}
                    suffix={
                      group.count(profile) != null ? (
                        <AppText variant="caption" tone="secondary" inline noWrap>
                          {formatCompactCount(group.count(profile))} cotistas
                        </AppText>
                      ) : undefined
                    }
                  />
                ))}
              </AppGrid>
            </AppGrid>
          ) : (
            <AppText variant="bodySmall" tone="secondary">
              O informe deste mês não detalha a distribuição de cotistas.
            </AppText>
          )}
          <AppMetric
            label="Maior cotista"
            value={formatFiledPercent(profile.top_investor_percent)}
            hint="Quanto do patrimônio o maior cotista sozinho detém"
            tone={profile.top_investor_percent == null ? 'secondary' : 'default'}
          />
        </AppStack>

        <AppStack gap="xs">
          <SectionLabel>Risco declarado</SectionLabel>
          {risk ? (
            <AppStack gap="sm">
              <AppGrid cols={{ xs: 2, sm: 3, md: 4 }} gap="md">
                <AppMetric
                  label="VaR da carteira"
                  value={formatFiledPercent(risk.portfolio_var)}
                  hint="Perda que o fundo declara não ultrapassar, no horizonte e na confiança do modelo que ele usa"
                />
                <AppMetric
                  label="Variação diária da cota"
                  value={formatFiledPercent(risk.daily_quota_variation_percent)}
                />
                <AppMetric
                  label="Variação em estresse"
                  value={formatFiledPercent(risk.stressed_daily_quota_variation_percent)}
                  hint="A variação diária da cota no cenário de estresse que o administrador simulou"
                />
                <AppMetric
                  label="Crédito privado"
                  value={formatFiledPercent(
                    risk.private_credit_exposure_percent ?? profile.private_credit_exposure_percent
                  )}
                  hint="Quanto do patrimônio está em dívida de emissor privado, e não em título público"
                />
              </AppGrid>
              {/* Sem o modelo, os quatro números acima comparam-se com os de
                  qualquer outro fundo como se fossem a mesma grandeza. */}
              <AppText variant="caption" tone="secondary">
                Modelo de risco: {risk.risk_model ?? EMPTY}
              </AppText>
            </AppStack>
          ) : (
            <AppText variant="bodySmall" tone="secondary">
              O informe deste mês não traz a seção de risco.
            </AppText>
          )}
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
