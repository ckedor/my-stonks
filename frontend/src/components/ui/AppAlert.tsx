import { Alert } from '@mui/material'
import type { ReactNode } from 'react'

/* Aviso fixo no fluxo da página — diferente do `AppSnackbar`, que aparece
 * e some. `error` para falha, `info` para estado vazio, `success` para a
 * confirmação de uma ação que o usuário disparou e cujo resultado fica na
 * tela (o snackbar some antes de ser lido quando a ação demora). */

export interface AppAlertProps {
  children: ReactNode
  severity: 'error' | 'info' | 'success'
}

export default function AppAlert({ children, severity }: AppAlertProps) {
  return <Alert severity={severity}>{children}</Alert>
}
