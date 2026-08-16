import { Divider } from '@mui/material'

/* Linha que separa dois blocos dentro da mesma superfície.
 *
 * Sem props de espaçamento de propósito: a distância até os vizinhos é do
 * `AppStack gap` do container, como em qualquer outro filho. Foi o `sx={{
 * my: 3 }}` repetido em cada `<Divider>` que produziu as margens diferentes
 * que existiam antes. */

export default function AppDivider() {
  return <Divider />
}
