import { Autocomplete, CircularProgress, ListItemIcon, ListItemText, TextField } from '@mui/material'
import { useState, type ReactNode } from 'react'

/* Seletor com busca por texto.
 *
 * As larguras são as duas que as telas já usavam (420px e 520px), expostas
 * como `size` em vez de continuarem como `sx` na página — a largura de um
 * campo é decisão do design system, e nomeá-la evita o terceiro valor
 * arbitrário aparecer na próxima tela.
 *
 * `filterOptions` é tipado aqui, e não repassado do MUI: a assinatura é uma
 * função pura sobre a lista, então a página consegue limitar o que o
 * dropdown renderiza sem importar nada do MUI. */

/* A linha de ação não é uma opção: ela cria em vez de escolher. Viaja pela
   lista do `Autocomplete` como um item qualquer porque é assim que o MUI
   desenha o dropdown, e é reconhecida por esta marca — sem ela a página
   teria que inventar um id sentinela e um `renderOption` próprio, que foi
   exatamente o que o `AssetSelector` fazia. */
const ACTION_ROW = { __appAutocompleteAction: true } as const
type ActionRow = typeof ACTION_ROW

function isActionRow(option: unknown): option is ActionRow {
  return typeof option === 'object' && option !== null && '__appAutocompleteAction' in option
}

export interface AppAutocompleteAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
}

export interface AppAutocompleteProps<T> {
  options: T[]
  value: T | null
  onChange: (value: T | null) => void
  /** Texto exibido para cada opção. */
  getOptionLabel: (option: T) => string
  /** Rótulo flutuante do campo. */
  label: string
  /** Compara opção e valor, já que objetos iguais não são o mesmo objeto. */
  isOptionEqualToValue: (option: T, value: T) => boolean
  /** `sm` = 340px, `md` = 420px, `lg` = 520px, `full` = a largura do
   *  container. Padrão: `md`. */
  size?: 'sm' | 'md' | 'lg' | 'full'
  /** Filtro próprio — útil quando a lista é grande demais para renderizar. */
  filterOptions?: (options: T[], state: { inputValue: string }) => T[]
  /** Texto dentro do campo vazio, dizendo o que se espera ali. */
  placeholder?: string
  disabled?: boolean
  /** Spinner no canto: a lista ainda está sendo carregada. */
  busy?: boolean
  /** Linha fixa no fim da lista que cria em vez de escolher. */
  action?: AppAutocompleteAction
}

const WIDTH = { sm: 340, md: 420, lg: 520, full: '100%' } as const

export default function AppAutocomplete<T>({
  options,
  value,
  onChange,
  getOptionLabel,
  label,
  isOptionEqualToValue,
  size = 'md',
  filterOptions,
  placeholder,
  disabled,
  busy,
  action,
}: AppAutocompleteProps<T>) {
  /* Controlado só por causa da linha de ação: clicar nela precisa fechar o
     dropdown sem escolher nada, e o MUI não tem como saber disso. */
  const [open, setOpen] = useState(false)

  const items: (T | ActionRow)[] = action ? [...options, ACTION_ROW] : options

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={items}
      value={value}
      onChange={(_, next) => {
        if (isActionRow(next)) return
        onChange((next as T) ?? null)
      }}
      getOptionLabel={(option) => (isActionRow(option) ? '' : getOptionLabel(option as T))}
      isOptionEqualToValue={(option, current) =>
        !isActionRow(option) && !isActionRow(current) && isOptionEqualToValue(option as T, current as T)
      }
      filterOptions={
        filterOptions
          ? (list, state) => {
              const real = list.filter((item) => !isActionRow(item)) as T[]
              const kept: (T | ActionRow)[] = filterOptions(real, state)
              return action ? [...kept, ACTION_ROW] : kept
            }
          : undefined
      }
      disabled={disabled}
      renderOption={
        action
          ? (props, option) => {
              if (!isActionRow(option)) {
                return <li {...props}>{getOptionLabel(option as T)}</li>
              }
              return (
                <li
                  {...props}
                  key="__acao"
                  /* Sem o `preventDefault` o campo perde o foco antes do
                     clique chegar, e o dropdown fecha engolindo o clique. */
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    action.onSelect()
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
                  <ListItemText primary={action.label} />
                </li>
              )
            }
          : undefined
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {busy ? <CircularProgress size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
      /* `width` junto do `maxWidth` para o campo não encolher até o conteúdo
         quando o pai é uma linha em flex: numa coluna os dois dão no mesmo,
         numa linha só o `maxWidth` deixaria o campo minúsculo. */
      sx={{ width: '100%', maxWidth: WIDTH[size] }}
    />
  )
}
