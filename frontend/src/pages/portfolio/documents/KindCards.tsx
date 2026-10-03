import type { DocumentKind, PortfolioDocument } from '@/api/portfolioDocument'
import { AppCard, AppGrid, AppStack, AppText } from '@/components/ui'
import { DOCUMENT_KIND, DOCUMENT_KINDS } from './kinds'
import { uploadedDate } from './format'

interface KindCardsProps {
  documents: readonly PortfolioDocument[]
  selected: DocumentKind | null
  onSelect: (kind: DocumentKind | null) => void
}

/* Um card por tipo de documento, com quantos há e quando chegou o último.
 *
 * Os cards são o filtro: clicar mostra só aquele tipo, clicar de novo volta
 * a mostrar todos. Um tipo sem nenhum arquivo continua na fileira — diz que
 * aquilo é guardado aqui, e por onde se envia. */
export default function KindCards({ documents, selected, onSelect }: KindCardsProps) {
  return (
    // Uma coluna por tipo, até três: dois cards numa grade de três deixavam
    // um buraco à direita.
    <AppGrid cols={{ xs: 1, sm: Math.min(DOCUMENT_KINDS.length, 3) }} gap="md">
      {DOCUMENT_KINDS.map((kind) => {
        const info = DOCUMENT_KIND[kind]
        const ofKind = documents.filter((document) => document.kind === kind)
        const latest = ofKind[0]
        const notes = ofKind.reduce((total, document) => total + document.notes.length, 0)
        return (
          <AppCard
            key={kind}
            padding="md"
            interactive
            selected={selected === kind}
            onClick={() => onSelect(selected === kind ? null : kind)}
            role="button"
            aria-pressed={selected === kind}
          >
            <AppStack gap="sm">
              <AppStack direction="row" gap="sm" align="center">
                <AppText variant="bodySmall" tone="secondary" inline>
                  {info.icon}
                </AppText>
                <AppText variant="bodySmall" weight="strong">
                  {info.many}
                </AppText>
              </AppStack>
              <AppText variant="cardValue">{ofKind.length}</AppText>
              <AppText variant="caption" tone="secondary">
                {latest
                  ? [
                      `Último em ${uploadedDate(latest.uploaded_at)}`,
                      notes > 0 ? `${notes} ${notes === 1 ? 'nota confirmada' : 'notas confirmadas'}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : `Enviados por ${info.source}`}
              </AppText>
            </AppStack>
          </AppCard>
        )
      })}
    </AppGrid>
  )
}
