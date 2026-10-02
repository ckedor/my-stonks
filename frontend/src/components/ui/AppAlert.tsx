import { Alert } from '@mui/material'
import type { ReactNode } from 'react'
import { INTENT_COLOR, type Intent } from './intent'

/* Aviso fixo no fluxo da página — diferente do `AppSnackbar`, que aparece
 * e some. `danger` para falha, `info` para estado vazio, `success` para a
 * confirmação de uma ação que o usuário disparou e cujo resultado fica na
 * tela (o snackbar some antes de ser lido quando a ação demora).
 *
 * O tom tem os mesmos nomes do resto do design system (`Intent`): a falha é
 * `danger` aqui, no botão e no texto. */

export interface AppAlertProps {
  children: ReactNode
  tone: Extract<Intent, 'danger' | 'info' | 'success'>
}

export default function AppAlert({ children, tone }: AppAlertProps) {
  return <Alert severity={INTENT_COLOR[tone]}>{children}</Alert>
}
