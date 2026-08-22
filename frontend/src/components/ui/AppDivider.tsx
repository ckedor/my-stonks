import { Divider } from '@mui/material'

/* Linha que separa dois blocos dentro da mesma superfície.
 *
 * Sem props de espaçamento de propósito: a distância até os vizinhos é do
 * `AppStack gap` do container, como em qualquer outro filho. Foi o `sx={{
 * my: 3 }}` repetido em cada `<Divider>` que produziu as margens diferentes
 * que existiam antes. */

export interface AppDividerProps {
  /** `vertical` separa colunas de uma linha. Padrão: `horizontal`. */
  orientation?: 'horizontal' | 'vertical'
  /** Some abaixo deste breakpoint. Anda junto com o `collapseBelow` do
   *  `AppStack`: quando a linha vira coluna, a régua vertical deixa de
   *  separar coisa nenhuma e vira um risco solto no meio do conteúdo. */
  hideBelow?: 'sm' | 'md'
}

export default function AppDivider({ orientation = 'horizontal', hideBelow }: AppDividerProps) {
  return (
    <Divider
      orientation={orientation}
      flexItem={orientation === 'vertical'}
      sx={hideBelow ? { display: { xs: 'none', [hideBelow]: 'block' } } : undefined}
    />
  )
}
