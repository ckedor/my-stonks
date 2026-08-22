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
  /** Ocupa a altura da viewport — para telas que se centram sozinhas. */
  fullHeight?: boolean
  /** Abaixo deste breakpoint a linha vira coluna. Só faz sentido com
   *  `direction="row"`.
   *
   *  O alinhamento no eixo cruzado volta a `stretch` junto: numa linha, um
   *  `align="center"` centra verticalmente e é o que se quer; na coluna, o
   *  mesmo valor espreme cada filho na largura do próprio conteúdo — foi
   *  por isso que as telas escreviam `alignItems={{ xs: 'stretch', md:
   *  'center' }}` à mão. As duas decisões andam juntas, então andam juntas
   *  aqui. */
  collapseBelow?: 'sm' | 'md'
}

const STYLE_PROPS = new Set([
  'direction',
  'gap',
  'align',
  'justify',
  'wrap',
  'grow',
  'fullHeight',
  'collapseBelow',
])

const AppStack = styled('div', {
  shouldForwardProp: (prop) => !STYLE_PROPS.has(prop as string),
})<AppStackProps>(({ theme, direction = 'column', gap = 'none', align, justify, wrap, grow, fullHeight, collapseBelow }) => ({
  display: 'flex',
  flexDirection: direction,
  gap: theme.spacing(space[gap]),
  ...(align ? { alignItems: CSS_ALIGN[align] } : null),
  ...(justify ? { justifyContent: CSS_JUSTIFY[justify] } : null),
  ...(wrap ? { flexWrap: 'wrap' } : null),
  ...(grow ? { flex: 1, minWidth: 0 } : null),
  ...(fullHeight ? { height: '100vh' } : null),
  ...(collapseBelow
    ? {
        [theme.breakpoints.down(collapseBelow)]: {
          flexDirection: 'column',
          alignItems: 'stretch',
        },
      }
    : null),
}))

/* Filho que ocupa uma fatia proporcional da linha.
 *
 * Existe para a linha de formulário onde os campos não têm o mesmo peso —
 * nome largo, benchmark médio, cor estreita. O `AppGridItem` não serve:
 * grade trabalha em colunas inteiras, e 2 : 1.5 não é coluna inteira. */
export interface AppStackItemProps {
  /** Fatia do espaço livre. Padrão: 1. */
  grow?: number
  /** Piso em px, para a fatia não sumir quando a linha aperta. */
  minWidth?: number
  /** Largura fixa em px: a coluna lateral que não cresce nem encolhe com o
   *  conteúdo. Abaixo de `md` ela ocupa a linha inteira — a essa altura a
   *  linha já virou coluna, e a largura fixa só apertaria o conteúdo. */
  width?: number
  /** Empurra o filho para baixo, para alinhá-lo com o conteúdo de um
   *  vizinho que reserva uma faixa no próprio topo. */
  offsetTop?: SpaceToken
}

const ITEM_STYLE_PROPS = new Set(['grow', 'minWidth', 'width', 'offsetTop'])

export const AppStackItem = styled('div', {
  shouldForwardProp: (prop) => !ITEM_STYLE_PROPS.has(prop as string),
})<AppStackItemProps>(({ theme, grow = 1, minWidth, width, offsetTop }) => ({
  ...(width
    ? { flex: '0 0 auto', width, [theme.breakpoints.down('md')]: { width: '100%' } }
    : { flex: grow }),
  minWidth: minWidth ?? 0,
  ...(offsetTop ? { marginTop: theme.spacing(space[offsetTop]) } : null),
}))

export default AppStack
