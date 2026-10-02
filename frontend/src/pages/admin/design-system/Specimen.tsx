import { AppCard, AppGrid, AppStack, AppText, SectionLabel, SectionTitle } from '@/components/ui'
import type { ReactNode } from 'react'

/* As peças com que o catálogo se escreve. São feitas só de primitivos de
 * `@/components/ui`, sem estilo próprio: a página do design system é também
 * o exemplo de como uma tela se escreve. */

/** Um componente do catálogo: o nome, quando usar, e os estados dele. */
export function Entry({
  name,
  role,
  children,
}: {
  /** O nome exportado por `@/components/ui`. */
  name: string
  /** Quando usar, numa frase — e, se houver um vizinho parecido, por que
   *  não ele. */
  role: string
  children: ReactNode
}) {
  return (
    <AppCard padding="lg">
      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionTitle>{name}</SectionTitle>
          <AppText variant="bodySmall" tone="secondary">
            {role}
          </AppText>
        </AppStack>
        {children}
      </AppStack>
    </AppCard>
  )
}

/** Um eixo de estados do mesmo componente, com o nome do eixo em cima.
 *
 *  Em linha, cada estado tem a largura do próprio conteúdo. Um campo que
 *  ocupa a largura do pai encolhe ali até o valor virar reticências, e é
 *  para ele que existe `columns`: a grade dá a cada estado uma largura de
 *  verdade, como a de uma tela. */
export function States({
  label,
  columns,
  children,
}: {
  label?: string
  columns?: number
  children: ReactNode
}) {
  return (
    <AppStack gap="sm">
      {label && <SectionLabel>{label}</SectionLabel>}
      {columns ? (
        <AppGrid cols={{ xs: 1, md: columns }} gap="lg" align="start">
          {children}
        </AppGrid>
      ) : (
        <AppStack direction="row" gap="lg" wrap align="end">
          {children}
        </AppStack>
      )}
    </AppStack>
  )
}

/** Um estado: o componente e, embaixo, o nome do estado. */
export function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <AppStack gap="xs">
      {children}
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </AppStack>
  )
}

/** Dois eixos cruzados — `tone × emphasis` de um botão —, uma célula por
 *  combinação. É onde uma combinação que ninguém usa aparece de relance. */
export function Matrix<R extends string, C extends string>({
  label,
  rows,
  cols,
  render,
}: {
  label?: string
  rows: readonly R[]
  cols: readonly C[]
  render: (row: R, col: C) => ReactNode
}) {
  return (
    <AppStack gap="sm">
      {label && <SectionLabel>{label}</SectionLabel>}
      <AppGrid cols={cols.length + 1} gap="sm" align="center">
        <AppStack />
        {cols.map((col) => (
          <AppText key={col} variant="caption" tone="secondary">
            {col}
          </AppText>
        ))}
        {rows.map((row) => (
          <MatrixRow key={row} row={row} cols={cols} render={render} />
        ))}
      </AppGrid>
    </AppStack>
  )
}

function MatrixRow<R extends string, C extends string>({
  row,
  cols,
  render,
}: {
  row: R
  cols: readonly C[]
  render: (row: R, col: C) => ReactNode
}) {
  return (
    <>
      <AppText variant="caption" tone="secondary">
        {row}
      </AppText>
      {cols.map((col) => (
        <AppStack key={col} align="start">
          {render(row, col)}
        </AppStack>
      ))}
    </>
  )
}
