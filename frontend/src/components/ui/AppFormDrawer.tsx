import { Delete } from '@mui/icons-material'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import Drawer from '@mui/material/Drawer'
import type { ReactNode } from 'react'
import AppIconButton from './AppIconButton'
import AppStack from './AppStack'
import { space, type SpaceToken } from '@/theme/tokens'

/* Formulário em painel lateral.
 *
 * Quatro formulários do app repetiam este mesmo esqueleto — título à
 * esquerda, exclusão à direita, campos que rolam, e um botão de largura
 * inteira preso no rodapé — cada um reescrevendo o `Box p={3}` e o
 * `startIcon` do spinner. O esqueleto é decisão daqui; o miolo continua
 * sendo de quem usa, porque campo de negociação não é campo de categoria.
 *
 * Diferente do `AppCrudForm`, que também é um painel mas monta os campos
 * sozinho a partir de uma lista. Serve para o CRUD do admin, onde o
 * formulário é a tabela virada de lado; não serve aqui, onde os campos têm
 * lógica entre si (a corretora escolhe a moeda, o ativo e a data buscam a
 * cotação). */

const WIDTH = { sm: 400, md: 500, lg: 600 } as const

export interface AppFormDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  /** `sm` = 400px, `md` = 500px, `lg` = 600px. */
  width: keyof typeof WIDTH
  /** Exclusão do registro, no cabeçalho. Só em modo edição. */
  onDelete?: () => void
  /** Descreve o que a exclusão apaga, para leitor de tela. */
  deleteLabel?: string
  /** Bloco fixo entre o título e a área que rola — o campo que precisa
   *  continuar visível enquanto a lista abaixo dele corre. */
  header?: ReactNode
  /** Espaço entre os blocos da área que rola. Padrão: `md`. */
  gap?: SpaceToken
  submitLabel: string
  onSubmit: () => void
  submitDisabled?: boolean
  /** Troca o ícone do botão por um spinner e o desabilita. */
  submitting?: boolean
  children: ReactNode
}

export default function AppFormDrawer({
  open,
  onClose,
  title,
  width,
  onDelete,
  deleteLabel = 'Excluir',
  header,
  gap = 'md',
  submitLabel,
  onSubmit,
  submitDisabled = false,
  submitting = false,
  children,
}: AppFormDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box p={3} width={WIDTH[width]} display="flex" flexDirection="column" height="100%">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={space.md}
        >
          <Typography variant="h6">{title}</Typography>
          {onDelete && (
            <AppIconButton label={deleteLabel} onClick={onDelete}>
              <Delete />
            </AppIconButton>
          )}
        </Box>

        {header && <Box mb={space.sm}>{header}</Box>}

        <Box flex={1} overflow="auto">
          <AppStack gap={gap}>{children}</AppStack>
        </Box>

        <Box mt={space.md}>
          <Button
            variant="contained"
            fullWidth
            onClick={onSubmit}
            disabled={submitDisabled || submitting}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {submitLabel}
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
