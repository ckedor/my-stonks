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
  /** `danger` para exclusões, `caution` para o que é caro mas reversível,
   *  `primary` para o resto. Padrão: `danger`. */
  tone?: 'danger' | 'caution' | 'primary'
  /** Bloqueia o confirmar enquanto a ação anterior ainda está no ar — sem
   *  isso um duplo clique dispara a mesma requisição duas vezes. */
  confirmDisabled?: boolean
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
  confirmDisabled = false,
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
        <AppButton emphasis="ghost" onClick={onCancel}>
          {cancelLabel}
        </AppButton>
        <AppButton tone={tone} onClick={onConfirm} disabled={confirmDisabled}>
          {confirmLabel}
        </AppButton>
      </DialogActions>
    </Dialog>
  )
}
