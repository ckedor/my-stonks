import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import type { ReactNode } from 'react'
import AppButton from './AppButton'

/* Diálogo que avisa, e não pergunta: um título, o conteúdo e um botão só
 * para fechar. Para uma escolha destrutiva, `AppConfirmDialog`. */

export interface AppDialogProps {
  open: boolean
  title: string
  children: ReactNode
  /** Padrão: `Fechar`. */
  closeLabel?: string
  onClose: () => void
}

export default function AppDialog({ open, title, children, closeLabel = 'Fechar', onClose }: AppDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <AppButton tone="primary" onClick={onClose}>
          {closeLabel}
        </AppButton>
      </DialogActions>
    </Dialog>
  )
}
