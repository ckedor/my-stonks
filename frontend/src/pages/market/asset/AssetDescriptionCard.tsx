import { AppCard, AppStack, AppText, SectionTitle } from '@/components/ui'

/* O texto de cadastro do ativo, como o mantenedor o escreveu.
 *
 * Isto já foi uma superfície de IA, com data de geração e botão de gerar de
 * novo. Não é mais: o texto passou a ser um campo do cadastro, e o que a IA faz
 * é propor um rascunho na tela de admin, que alguém edita e salva. O que chega
 * aqui é sempre texto de gente, então a moldura que dizia "escrito por IA"
 * estaria mentindo.
 *
 * Um ativo sem texto não mostra card nenhum. O campo nasce vazio e a maior parte
 * do cadastro vai continuar vazia — um card dizendo "sem descrição" em cada
 * ativo seria ruído em toda tela, todo dia. */
export default function AssetDescriptionCard({
  summary,
  description,
}: {
  summary?: string | null
  description?: string | null
}) {
  const heading = summary?.trim()
  const body = description?.trim()

  if (!heading && !body) return null

  return (
    <AppCard>
      <AppStack gap="sm">
        <SectionTitle>O que é este ativo</SectionTitle>
        {heading ? <AppText>{heading}</AppText> : null}
        {body ? (
          <AppText variant="bodySmall" tone="secondary">
            {body}
          </AppText>
        ) : null}
      </AppStack>
    </AppCard>
  )
}
