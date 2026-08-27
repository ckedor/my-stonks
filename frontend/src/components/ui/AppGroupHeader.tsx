import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { space } from '@/theme/tokens'
import SectionLabel from './SectionLabel'

/* Cabeçalho de um grupo dentro de uma lista longa — a categoria acima dos
 * ativos dela.
 *
 * Não é `SectionTitle`: aquele nomeia um bloco que a pessoa lê como
 * conteúdo; este só diz sob qual assunto caem as linhas abaixo, e por isso
 * é o mesmo desenho do `SectionLabel`.
 *
 * Teve régua e borda na cor da categoria por um tempo, e é a única coisa no
 * app que desenhava assim — a listagem de ativos não parecia do mesmo
 * produto que o resto. Cor aqui identifica série de gráfico e nada mais; a
 * hierarquia deste cabeçalho é tipográfica, e o divisor é neutro como
 * qualquer outro do app. */

export interface AppGroupHeaderProps {
  title: string
  /** Torna o título clicável: o grupo tem uma página própria. */
  onTitleClick?: () => void
  /** Ao lado direito, o total do grupo. */
  trailing?: ReactNode
}

export default function AppGroupHeader({
  title,
  onTitleClick,
  trailing,
}: AppGroupHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        pb: space.xs,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          ...(onTitleClick
            ? { cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }
            : null),
        }}
        onClick={onTitleClick}
      >
        <SectionLabel>{title}</SectionLabel>
      </Box>
      {trailing}
    </Box>
  )
}
