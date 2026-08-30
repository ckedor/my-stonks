import { Box, BoxProps } from '@mui/material'
import { space, type SpaceToken } from '@/theme/tokens'
import { useAppTheme, withOpacity } from './useAppTheme'

/* ──────────────────────────────────────────────
   AppCard — superfície padrão do app
   ──────────────────────────────────────────────

   Cobre os ~36 `<Box>` que existiam só para desenhar uma superfície
   (fundo, borda, raio).

   Sobre o `sx`: ele continua aqui porque 18 das 47 chamadas atuais passam
   `sx`, e removê-lo agora quebraria páginas que ainda não foram migradas.
   É uma saída de emergência com prazo — some quando as páginas migrarem.
   Código novo não deve usá-lo: se falta algo, a prop entra neste
   componente. O mesmo vale para `noPadding`, hoje substituído por
   `padding="none"`. */

export interface AppCardProps extends Omit<BoxProps, 'padding'> {
  children: React.ReactNode
  /** Espaçamento interno. Padrão: `md`. */
  padding?: SpaceToken
  /** @deprecated Use `padding="none"`. */
  noPadding?: boolean
  /** Altura fixa, para o card que emoldura algo que se dimensiona sozinho —
   *  um diagrama que ocupa a área e rola por dentro. Aceita `calc()`. */
  height?: number | string
  /** Piso de largura, em px — o card que não pode espremer o que mostra
   *  quando divide a linha com um vizinho elástico. */
  minWidth?: number
  /** Largura fixa, em px — a régua de uma fileira de cards que precisa ter
   *  passo constante, como uma prateleira que rola na horizontal. Cards que
   *  se dimensionam pelo conteúdo ali viram um ritmo irregular. */
  width?: number
  /** Levanta a superfície com sombra, para o que flutua sobre o conteúdo —
   *  o balão de um gráfico. */
  raised?: boolean
  /** Card que leva a algum lugar: cursor de mão e realce ao passar o mouse.
   *  O clique continua vindo do `onClick`. */
  interactive?: boolean
  /** Cor da borda no hover de um card `interactive` — a do assunto que ele
   *  mostra, como a da categoria do ativo. Sem ela o realce é só o fundo. */
  accentColor?: string
  /** Marca o card escolhido entre vários — o tema em uso na grade de temas.
   *  A borda vira a cor primária e ganha peso. */
  selected?: boolean
  /** Faixa colorida numa borda, na cor do assunto do card — a classe de
   *  ativo que ele resume, o tipo de um nó do mapa de arquitetura. */
  accentEdge?: string
  /** Em qual borda a faixa fica. Padrão: `top`. */
  accentSide?: 'top' | 'left'
  /** Fundo tingido de leve pela cor do assunto, para o bloco que se lê como
   *  um destaque dentro de um card maior. */
  tint?: string
  /** Borda tracejada: o card que ainda não é nada — o "novo tema" no fim da
   *  grade. Ele convida a criar, e a linha cheia o faria parecer um item. */
  dashed?: boolean
}

export default function AppCard({
  children,
  sx,
  padding,
  noPadding = false,
  minWidth,
  width,
  height,
  raised = false,
  interactive = false,
  accentColor,
  selected = false,
  dashed = false,
  accentEdge,
  accentSide = 'top',
  tint,
  ...props
}: AppCardProps) {
  const resolvedPadding = padding ?? (noPadding ? 'none' : 'md')
  const theme = useAppTheme()

  return (
    <Box
      sx={{
        border: selected || dashed ? '2px solid' : '1px solid',
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: `${theme.radius.md}px`,
        p: space[resolvedPadding],
        backgroundColor: tint ? withOpacity(tint, 0.07) : 'background.paper',
        ...(accentEdge
          ? accentSide === 'left'
            ? { borderLeft: '5px solid', borderLeftColor: accentEdge }
            : { borderTop: '3px solid', borderTopColor: accentEdge }
          : null),
        ...(minWidth ? { minWidth } : null),
        ...(width ? { width, flexShrink: 0 } : null),
        ...(height ? { height, overflow: 'hidden' } : null),
        ...(raised ? { boxShadow: 3 } : null),
        ...(interactive
          ? {
              cursor: 'pointer',
              transition: 'background-color 0.15s, border-color 0.15s',
              '&:hover': {
                backgroundColor: 'action.hover',
                ...(accentColor ? { borderColor: accentColor } : null),
                ...(selected ? { borderColor: 'primary.main' } : null),
              },
            }
          : null),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}
