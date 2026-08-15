import { styled } from '@mui/material/styles'
import { space, type SpaceToken } from '@/theme/tokens'

/* ──────────────────────────────────────────────
   AppStack — empilhamento em flexbox
   ──────────────────────────────────────────────

   Substitui os 142 `<Box display="flex">` e os `<Stack>` do MUI. É uma
   `div` com flex por baixo, sem nenhum componente do MUI envolvido —
   trocar o MUI um dia não encosta neste arquivo.

   As props cobrem só o que o app usa hoje. Se uma tela precisar de algo
   que não está aqui, a prop nova entra neste componente — não vira `sx`
   na página. */

type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
type Justify = 'start' | 'center' | 'end' | 'between'

const CSS_ALIGN: Record<Align, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}

const CSS_JUSTIFY: Record<Justify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
}

export interface AppStackProps {
  /** Eixo principal. Padrão: `column`. */
  direction?: 'row' | 'column'
  /** Espaço entre os filhos. Padrão: `none`, igual ao Stack do MUI. */
  gap?: SpaceToken
  /** Alinhamento no eixo cruzado. */
  align?: Align
  /** Distribuição no eixo principal. */
  justify?: Justify
  /** Permite quebrar em várias linhas. */
  wrap?: boolean
  /** Faz o stack ocupar o espaço livre do pai. */
  grow?: boolean
}

const STYLE_PROPS = new Set(['direction', 'gap', 'align', 'justify', 'wrap', 'grow'])

const AppStack = styled('div', {
  shouldForwardProp: (prop) => !STYLE_PROPS.has(prop as string),
})<AppStackProps>(({ theme, direction = 'column', gap = 'none', align, justify, wrap, grow }) => ({
  display: 'flex',
  flexDirection: direction,
  gap: theme.spacing(space[gap]),
  ...(align ? { alignItems: CSS_ALIGN[align] } : null),
  ...(justify ? { justifyContent: CSS_JUSTIFY[justify] } : null),
  ...(wrap ? { flexWrap: 'wrap' } : null),
  ...(grow ? { flex: 1, minWidth: 0 } : null),
}))

export default AppStack
