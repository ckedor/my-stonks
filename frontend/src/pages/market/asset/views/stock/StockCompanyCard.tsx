import type { StockCompany } from '@/api/market'
import {
  AppCard,
  AppGrid,
  AppLink,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import { EMPTY, formatCNPJ, formatCount, formatDate } from '../format'

interface Entry {
  label: string
  value: string
}

/** O que a companhia é e o que ela faz.
 *
 *  Não é medida nenhuma, e é por isso que é uma aba e não uma linha da grade
 *  de indicadores: setor e sede não se comparam com P/L.
 *
 *  O resumo vem em parágrafos porque a companhia o escreveu em parágrafos.
 *  Emendado num bloco só, um texto de quatro parágrafos vira uma parede que
 *  ninguém lê — e a quebra é dela, não uma escolha de renderização.
 *
 *  O endereço só aparece quando existe: o provedor preenche a sede de umas
 *  companhias e de outras não, e três linhas de traço não dizem onde ninguém
 *  fica.
 */
export default function StockCompanyCard({ company }: { company: StockCompany }) {
  const place = [company.city, company.state, company.country].filter(Boolean).join(', ')

  const entries: Entry[] = [
    { label: 'Setor', value: company.sector ?? EMPTY },
    { label: 'Indústria', value: company.industry ?? EMPTY },
    { label: 'CNPJ', value: formatCNPJ(company.cnpj) },
    { label: 'Fundação', value: formatDate(company.founded_on) },
    { label: 'Funcionários', value: formatCount(company.employees) },
    ...(place ? [{ label: 'Sede', value: place }] : []),
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>{company.name ?? 'A companhia'}</SectionTitle>

        <AppGrid cols={{ xs: 2, sm: 3 }} gap="md">
          {entries.map((entry) => (
            <AppStack key={entry.label} gap="none">
              <AppText variant="caption" tone="secondary">
                {entry.label}
              </AppText>
              <AppText variant="bodySmall">{entry.value}</AppText>
            </AppStack>
          ))}
        </AppGrid>

        {company.summary_paragraphs.length > 0 && (
          <AppStack gap="sm">
            <SectionLabel>O que a companhia faz</SectionLabel>
            {company.summary_paragraphs.map((paragraph, index) => (
              <AppText key={index} variant="bodySmall" tone="secondary">
                {paragraph}
              </AppText>
            ))}
          </AppStack>
        )}

        {company.website && (
          <AppLink href={company.website}>
            Relações com investidores
          </AppLink>
        )}
      </AppStack>
    </AppCard>
  )
}
