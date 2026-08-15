import { Alert } from '@mui/material'
import type { ReactNode } from 'react'

/* Aviso fixo no fluxo da página — diferente do `AppSnackbar`, que aparece
 * e some. `error` para falha, `info` para estado vazio. */

export interface AppAlertProps {
  children: ReactNode
  severity: 'error' | 'info'
}

export default function AppAlert({ children, severity }: AppAlertProps) {
  return <Alert severity={severity}>{children}</Alert>
}
