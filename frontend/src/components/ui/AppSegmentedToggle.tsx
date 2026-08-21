import { Box, Typography } from '@mui/material'

/* Duas opções curtas num trilho, com a pílula deslizando entre elas.
 *
 * É o irmão pesado do `AppInlineToggle`. Lá o que muda entre ativo e
 * inativo é só o peso da fonte, porque o assunto da tela é o gráfico ao
 * lado. Aqui a escolha vale para a tela inteira — a moeda em que a carteira
 * é lida — e as duas opções ficam visíveis ao mesmo tempo justamente para
 * que se saiba qual está valendo sem abrir nada.
 *
 * Duas opções, não N: a pílula desliza entre duas posições fixas, e com
 * três ela precisaria medir os filhos. Nenhuma tela pediu a terceira. */

const TRACK_WIDTH = 64
const TRACK_HEIGHT = 28
const PILL_WIDTH = 32
const PILL_HEIGHT = 22
const PILL_INSET = 2

export interface AppSegmentedToggleOption<T extends string> {
  label: string
  value: T
}

export interface AppSegmentedToggleProps<T extends string> {
  options: readonly [AppSegmentedToggleOption<T>, AppSegmentedToggleOption<T>]
  value: T
  onChange: (value: T) => void
  /** Descrição do que se escolhe aqui, para leitor de tela. */
  label: string
}

export default function AppSegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: AppSegmentedToggleProps<T>) {
  const [first, second] = options
  const selected = value === second.value ? second : first
  const toggle = () => onChange(selected === first ? second.value : first.value)

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${selected.label}`}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggle()
        }
      }}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        borderRadius: `${TRACK_HEIGHT / 2}px`,
        bgcolor: 'action.hover',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: PILL_INSET,
          left:
            selected === first
              ? PILL_INSET
              : `calc(100% - ${PILL_WIDTH}px - ${PILL_INSET}px)`,
          width: PILL_WIDTH,
          height: PILL_HEIGHT,
          borderRadius: `${PILL_HEIGHT / 2}px`,
          bgcolor: 'primary.main',
          transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />

      {options.map((option) => (
        <Typography
          key={option.value}
          sx={{
            position: 'relative',
            flex: 1,
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: `${TRACK_HEIGHT}px`,
            color: option === selected ? 'primary.contrastText' : 'text.secondary',
            transition: 'color 0.2s',
            zIndex: 1,
          }}
        >
          {option.label}
        </Typography>
      ))}
    </Box>
  )
}
