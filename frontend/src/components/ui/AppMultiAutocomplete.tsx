import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material'

/* Escolha de várias opções, agrupadas, com busca.
 *
 * Irmão do `AppAutocomplete`, e a diferença não é só o `multiple`: aqui os
 * grupos aparecem lado a lado em colunas, e não empilhados. São listas
 * curtas de naturezas diferentes, e em coluna única a mais longa empurra as
 * outras para fora da tela.
 *
 * O que foi escolhido vira etiqueta no campo, e a etiqueta pode carregar a
 * cor daquilo que representa — é o que dispensa uma legenda separada
 * embaixo de um gráfico. */

const FIELD_WIDTH = 380
const MENU_MIN_WIDTH = 480
const GROUP_MIN_WIDTH = 150
const GROUP_MAX_HEIGHT = 280
const MENU_MAX_HEIGHT = 340

export interface AppMultiAutocompleteOption {
  /** Identidade estável, para comparar escolha e opção. */
  id: string
  label: string
  /** Nome da coluna em que a opção aparece. */
  group: string
}

export interface AppMultiAutocompleteProps<T extends AppMultiAutocompleteOption> {
  options: T[]
  value: T[]
  onChange: (value: T[]) => void
  /** Texto no campo vazio. Some quando já há escolha. */
  placeholder?: string
  /** Cor do marcador da etiqueta — a da curva que ela representa. */
  tintOf?: (option: T, index: number) => string
}

export default function AppMultiAutocomplete<T extends AppMultiAutocompleteOption>({
  options,
  value,
  onChange,
  placeholder,
  tintOf,
}: AppMultiAutocompleteProps<T>) {
  return (
    <Autocomplete
      multiple
      size="small"
      disableCloseOnSelect
      options={options}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      value={value}
      onChange={(_, next) => onChange(next as T[])}
      renderTags={(chosen, getTagProps) =>
        chosen.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index })
          return (
            <Chip
              key={key}
              {...tagProps}
              size="small"
              label={option.label}
              sx={{
                fontWeight: 600,
                ...(tintOf
                  ? { borderLeft: '3px solid', borderLeftColor: tintOf(option, index) }
                  : null),
                borderRadius: 1,
              }}
            />
          )
        })
      }
      renderInput={(params) => (
        <TextField {...params} placeholder={value.length ? '' : placeholder} />
      )}
      renderGroup={(params) => (
        <Box
          component="li"
          key={params.key}
          sx={{
            flex: '1 1 0',
            minWidth: GROUP_MIN_WIDTH,
            px: 0.5,
            '&:not(:last-of-type)': { borderRight: '1px solid', borderRightColor: 'divider' },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              px: 1.5,
              py: 0.75,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {params.group}
          </Typography>
          <Box component="ul" sx={{ p: 0, m: 0, maxHeight: GROUP_MAX_HEIGHT, overflowY: 'auto' }}>
            {params.children}
          </Box>
        </Box>
      )}
      slotProps={{
        listbox: { sx: { display: 'flex', alignItems: 'flex-start', maxHeight: MENU_MAX_HEIGHT, py: 0.5 } },
        /* O menu é mais largo que o campo: são três colunas, e o campo é
           estreito de propósito. */
        popper: { style: { width: 'auto', minWidth: MENU_MIN_WIDTH }, placement: 'bottom-start' },
      }}
      sx={{ width: { xs: '100%', md: FIELD_WIDTH } }}
    />
  )
}
