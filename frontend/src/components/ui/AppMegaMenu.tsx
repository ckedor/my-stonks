import { Box, Popover, Typography } from '@mui/material'

/* Painel de navegação em colunas, ancorado a um botão da barra superior.
 *
 * Genérico sobre o conteúdo, como a barra lateral: recebe as colunas
 * prontas e devolve o `id` do que foi escolhido. Quais rotas existem é
 * conhecimento de quem usa.
 *
 * `aside` existe porque a coluna de atalhos não é navegação: ela lista o
 * que a pessoa costuma abrir, muda sozinha e nenhum item dela fica ativo.
 * Fica colada à direita das colunas de navegação, com o respiro próprio. */

const COLUMN_MIN_WIDTH = 120
const ASIDE_MIN_WIDTH = 190
const PANEL_MIN_WIDTH = 480

export interface AppMegaMenuItem {
  /** Identifica o item e é o que volta em `onSelect`. */
  id: string
  label: string
  active?: boolean
}

export interface AppMegaMenuColumn {
  title: string
  items: AppMegaMenuItem[]
}

export interface AppMegaMenuProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  columns: AppMegaMenuColumn[]
  /** Coluna acessória à direita — atalhos, não navegação. */
  aside?: AppMegaMenuColumn
  onSelect: (id: string) => void
}

function ColumnTitle({ children }: { children: string }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{ fontWeight: 700, mb: 2, color: 'text.primary', letterSpacing: 0.3 }}
    >
      {children}
    </Typography>
  )
}

function ColumnItems({
  items,
  onSelect,
}: {
  items: AppMegaMenuItem[]
  onSelect: (id: string) => void
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {items.map((item) => (
        <Typography
          key={item.id}
          onClick={() => onSelect(item.id)}
          sx={{
            py: 1,
            px: 1.5,
            mx: -1.5,
            cursor: 'pointer',
            borderRadius: 1,
            color: item.active ? 'primary.main' : 'text.secondary',
            fontWeight: item.active ? 600 : 400,
            fontSize: '0.9rem',
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
          }}
        >
          {item.label}
        </Typography>
      ))}
    </Box>
  )
}

export default function AppMegaMenu({
  anchorEl,
  open,
  onClose,
  columns,
  aside,
  onSelect,
}: AppMegaMenuProps) {
  const select = (id: string) => {
    onSelect(id)
    onClose()
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      /* Sem isto o MUI trava a rolagem do body enquanto o painel está
         aberto, e a barra de rolagem some — a página inteira salta alguns
         pixels para o lado a cada abertura. */
      disableScrollLock
      slotProps={{
        paper: { sx: { mt: 1, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } },
      }}
    >
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ display: 'flex', gap: 8, p: 4, minWidth: PANEL_MIN_WIDTH }}>
          {columns.map((column) => (
            <Box key={column.title} sx={{ minWidth: COLUMN_MIN_WIDTH }}>
              <ColumnTitle>{column.title}</ColumnTitle>
              <ColumnItems items={column.items} onSelect={select} />
            </Box>
          ))}
        </Box>

        {aside && aside.items.length > 0 && (
          <Box sx={{ py: 4, pr: 4, minWidth: ASIDE_MIN_WIDTH }}>
            <ColumnTitle>{aside.title}</ColumnTitle>
            <ColumnItems items={aside.items} onSelect={select} />
          </Box>
        )}
      </Box>
    </Popover>
  )
}
