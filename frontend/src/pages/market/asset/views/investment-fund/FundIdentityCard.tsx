import type { InvestmentFundIdentity, InvestmentFundIndicators } from '@/api/market'
import { AppCard, AppGrid, AppStack, AppText, SectionTitle } from '@/components/ui'
import { fundKindLabel } from '@/constants/investmentFunds'
import { EMPTY, formatCNPJ, formatDate } from '../format'

interface Entry {
  label: string
  value: string | null
}

/** Quem é o fundo: cadastro, classificação e quem o administra e o gere.
 *
 *  Nada aqui decide um aporte, e é por isso que fica na última aba — mas é o
 *  que se procura quando se desconfia de alguma coisa, e some da tela se não
 *  tiver um lugar.
 *
 *  As três classificações aparecem as três, e não a "melhor" delas: vêm de três
 *  órgãos que discordam de propósito, e escolher uma escondendo as outras
 *  apagaria justamente a discordância. Administrador e gestor também são dois:
 *  um responde pelo fundo e o outro decide o que ele compra, e num fundo
 *  estruturado raramente são a mesma casa.
 */
export default function FundIdentityCard({
  identity,
  indicators,
  portfolioDate,
}: {
  identity: InvestmentFundIdentity | null
  indicators: InvestmentFundIndicators | null
  portfolioDate: string | null
}) {
  const entries: Entry[] = [
    { label: 'Razão social', value: identity?.legal_name ?? null },
    { label: 'CNPJ', value: identity?.cnpj ? formatCNPJ(identity.cnpj) : null },
    { label: 'Tipo de fundo', value: identity?.kind ? fundKindLabel(identity.kind) : null },
    { label: 'ISIN', value: identity?.isin ?? null },
    { label: 'Situação', value: identity?.status ?? null },
    { label: 'Classe CVM', value: identity?.cvm_class_type ?? null },
    { label: 'Classificação CVM', value: identity?.cvm_classification ?? null },
    { label: 'Classificação ANBIMA', value: identity?.anbima_classification ?? null },
    { label: 'Classificação B3', value: identity?.b3_classification ?? null },
    { label: 'Administrador', value: identity?.administrator_name ?? null },
    {
      label: 'CNPJ do administrador',
      value: identity?.administrator_cnpj ? formatCNPJ(identity.administrator_cnpj) : null,
    },
    { label: 'Gestor', value: identity?.manager_name ?? null },
    {
      label: 'CNPJ do gestor',
      value: identity?.manager_cnpj ? formatCNPJ(identity.manager_cnpj) : null,
    },
    // As duas datas fecham o cartão porque explicam a idade de tudo o que as
    // outras abas mostram.
    {
      label: 'Indicadores de',
      value: indicators?.as_of_date ? formatDate(indicators.as_of_date) : null,
    },
    {
      label: 'Carteira de',
      value: portfolioDate ? formatDate(portfolioDate) : null,
    },
  ]

  const published = entries.filter((entry) => entry.value)

  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>Fundo</SectionTitle>

        {published.length > 0 ? (
          /* Grade, e não uma lista de linhas: rótulo à esquerda e valor
             empurrado para a borda direita do card abria um vão de meia tela
             entre "CNPJ" e o número. Aqui cada item é um bloco, e o cartão
             enche a largura com conteúdo em vez de espaço. */
          <AppGrid cols={{ xs: 1, sm: 2, md: 3 }} gap="md">
            {published.map((entry) => (
              <AppStack key={entry.label} gap="xs">
                <AppText variant="caption" tone="secondary">
                  {entry.label}
                </AppText>
                <AppText variant="body">{entry.value ?? EMPTY}</AppText>
              </AppStack>
            ))}
          </AppGrid>
        ) : (
          <AppText variant="bodySmall" tone="secondary">
            O provedor não publicou o cadastro deste fundo.
          </AppText>
        )}
      </AppStack>
    </AppCard>
  )
}
