import { Tab, Tabs } from '@mui/material'

/* Abas que trocam o conteúdo abaixo delas.
 *
 * Sem borda inferior própria: quem usa põe a régua acima, separando as abas
 * do que vem antes. Duas linhas — a régua e a borda das abas — encaixotavam
 * a faixa entre elas.
 *
 * Só a barra: o conteúdo de cada aba é renderizado por quem usa, porque a
 * aba ativa costuma decidir o que buscar, e não só o que mostrar. */

export interface AppTabsItem<T extends string> {
  id: T
  label: string
}

export interface AppTabsProps<T extends string> {
  items: AppTabsItem<T>[]
  value: T
  onChange: (value: T) => void
  /** Rótulo acessível do grupo. */
  label: string
}

export default function AppTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: AppTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onChange={(_, next) => onChange(next as T)}
      aria-label={label}
      variant="scrollable"
      scrollButtons="auto"
      sx={{
        minHeight: 40,
        '& .MuiTabs-indicator': { height: 2 },
        '& .MuiTab-root': {
          textTransform: 'none',
          minHeight: 40,
          fontWeight: 600,
          fontSize: '0.9rem',
          px: 0,
          mr: 3,
          minWidth: 0,
          color: 'text.secondary',
        },
        '& .MuiTab-root.Mui-selected': { color: 'text.primary' },
      }}
    >
      {items.map((item) => (
        <Tab key={item.id} value={item.id} label={item.label} />
      ))}
    </Tabs>
  )
}
