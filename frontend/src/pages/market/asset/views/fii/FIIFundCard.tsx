import type { FIIIndicators, FIIManagement } from '@/api/market'
import { AppCard, AppGrid, AppLink, AppStack, AppText, SectionTitle } from '@/components/ui'
import { EMPTY, formatCNPJ, formatDate } from './format'

interface Entry {
  label: string
  value: string | null
  /** Endereço externo, quando o valor é um lugar e não um dado. */
  href?: string
}

/** O endereço do administrador, escrito como link.
 *
 *  O provedor publica o site sem esquema ("www.btgpactual.com"), e um href
 *  assim vira caminho relativo dentro do app. */
const websiteHref = (website: string) => `https://${website.replace(/^https?:\/\//, '')}`

/** Quem é o fundo: cadastro, mandato e quem o administra.
 *
 *  Nada aqui decide um aporte, e é por isso que fica na última aba — mas é o
 *  que se procura quando se desconfia de alguma coisa, e some da tela se não
 *  tiver um lugar. As duas datas fecham o cartão porque explicam a idade de
 *  tudo o que as outras abas mostram.
 */
export default function FIIFundCard({
  management,
  indicators,
  compositionDate,
}: {
  management: FIIManagement | null
  indicators: FIIIndicators | null
  compositionDate: string | null
}) {
  const entries: Entry[] = [
    { label: 'CNPJ', value: management?.cnpj ? formatCNPJ(management.cnpj) : null },
    { label: 'Mandato', value: management?.mandate ?? null },
    { label: 'Tipo de gestão', value: management?.management_type ?? null },
    { label: 'Tipo de fundo', value: indicators?.segment_type ?? null },
    { label: 'Segmento', value: indicators?.segment ?? null },
    {
      label: 'Administrador',
      value: management?.administrator_name ?? null,
      href: management?.administrator_website
        ? websiteHref(management.administrator_website)
        : undefined,
    },
    {
      label: 'Indicadores de',
      value: indicators?.as_of_date ? formatDate(indicators.as_of_date) : null,
    },
    {
      label: 'Informe trimestral de',
      value: compositionDate ? formatDate(compositionDate) : null,
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
                {entry.href ? (
                  <AppLink href={entry.href}>{entry.value ?? EMPTY}</AppLink>
                ) : (
                  <AppText variant="body">{entry.value ?? EMPTY}</AppText>
                )}
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
