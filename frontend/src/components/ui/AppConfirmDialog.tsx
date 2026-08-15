import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import type { ReactNode } from 'react'
import AppButton from './AppButton'

/* Diálogo de confirmação para ação destrutiva.
 *
 * Oito telas montavam esse mesmo diálogo à mão, cada uma escolhendo os
 * rótulos e a ordem dos botões. Aqui a ordem — cancelar à esquerda,
 * confirmar à direita — é decisão única do design system. */

export interface AppConfirmDialogProps {
  open: boolean
  title: string
  /** Corpo da mensagem. */
  children: ReactNode
  /** Padrão: `Confirmar`. */
  confirmLabel?: string
  /** Padrão: `Cancelar`. */
  cancelLabel?: string
  /** `danger` para exclusões, `primary` para o resto. Padrão: `danger`. */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function AppConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
}: AppConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{children}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <AppButton tone="ghost" onClick={onCancel}>
          {cancelLabel}
        </AppButton>
        <AppButton tone={tone} onClick={onConfirm}>
          {confirmLabel}
        </AppButton>
      </DialogActions>
    </Dialog>
  )
}
