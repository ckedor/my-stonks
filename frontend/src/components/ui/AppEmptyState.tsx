import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { space } from '@/theme/tokens'
import AppStack from './AppStack'
import AppText from './AppText'

/* A tela que ainda não tem o que mostrar, com o caminho para sair disso.
 *
 * Diferente do `emptyMessage` de uma tabela ou de um gráfico, que é uma frase
 * no lugar do desenho: aqui a tela inteira está vazia, e o assunto passa a ser
 * a ação — cadastrar a primeira compra. Por isso ocupa a altura da área de
 * conteúdo e centra: não há mais nada com que competir.
 *
 * A altura é 80vh e não 100vh de propósito: a barra do app já come o topo, e
 * uma altura cheia jogaria o bloco abaixo da dobra. */

export interface AppEmptyStateProps {
  title: string
  /** Uma linha dizendo o que fazer a seguir. */
  description?: string
  /** O botão que resolve o vazio. */
  action?: ReactNode
}

export default function AppEmptyState({ title, description, action }: AppEmptyStateProps) {
  return (
    <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AppStack align="center" gap="sm">
        <AppText variant="cardValue">{title}</AppText>
        {description && (
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        )}
        {action && <Box sx={{ mt: space.xs }}>{action}</Box>}
      </AppStack>
    </Box>
  )
}
