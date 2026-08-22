import ExpandMore from '@mui/icons-material/ExpandMore'
import { Button } from '@mui/material'
import type { MouseEvent } from 'react'

/* Gatilho de menu que mostra o valor escolhido — a carteira ativa, na barra
 * superior.
 *
 * Não é `AppButton`: aquele desenha uma ação, com peso de ação. Este é a
 * leitura de um estado que por acaso se pode trocar, e por isso vive na cor
 * da barra, sem preenchimento, com a seta indicando que há uma lista atrás.
 *
 * Recebe o evento no clique porque o menu precisa ancorar no elemento. */

export interface AppMenuButtonProps {
  children: string
  open: boolean
  onClick: (event: MouseEvent<HTMLElement>) => void
}

export default function AppMenuButton({ children, open, onClick }: AppMenuButtonProps) {
  return (
    <Button
      onClick={onClick}
      endIcon={
        <ExpandMore
          sx={{ transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      }
      disableRipple
      sx={{
        /* A barra tem paleta própria: `inherit` resolve para a cor de texto
           da página e some contra uma barra escura. */
        color: 'topbar.text',
        textTransform: 'none',
        fontSize: 15,
        fontWeight: 600,
        px: 1,
        py: 0.25,
        minWidth: 0,
        borderRadius: 1.5,
        '& .MuiButton-endIcon': { ml: 0.5, opacity: 0.7 },
        '&:hover': { bgcolor: 'topbar.activeBg' },
      }}
    >
      {children}
    </Button>
  )
}
