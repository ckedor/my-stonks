import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppTooltip from './AppTooltip'
import { space } from '@/theme/tokens'

/* Escolha exclusiva entre poucos modos, em botões colados.
 *
 * O terceiro dos três seletores de uma opção só, e cada um existe por um
 * peso diferente: `AppInlineToggle` é texto puro, para o período no canto
 * de um gráfico; `AppSegmentedToggle` é o trilho de duas opções, para a
 * escolha que vale para a tela inteira; este é o grupo com moldura, para
 * quando as opções mudam *o que* o gráfico desenha e precisam se ler como
 * controle, não como legenda.
 *
 * Nunca fica sem seleção: clicar no que já está ativo não desliga nada.
 * Um gráfico sem modo não tem o que mostrar. */

export interface AppToggleGroupOption<T extends string> {
  /** Vira o nome acessível mesmo quando só o ícone aparece. */
  label: string
  value: T
  /** No lugar do rótulo. O rótulo continua sendo o nome acessível. */
  icon?: ReactNode
  /** O que a opção faz, em uma frase, para o rótulo que é abreviação. */
  hint?: string
  /** Motivo para não poder ser escolhida agora. */
  disabled?: boolean
}

export interface AppToggleGroupProps<T extends string> {
  presentation?: 'compact' | 'view'
  options: AppToggleGroupOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Rótulo acessível do grupo. */
  label: string
}

export default function AppToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  presentation = 'compact',
}: AppToggleGroupProps<T>) {
  return (
    <ToggleButtonGroup
      sx={presentation === 'view' ? (theme) => ({
        p: space.xs,
        gap: space.xs,
        bgcolor: 'action.hover',
        borderRadius: `${theme.radius.md}px`,
        '& .MuiToggleButtonGroup-grouped': {
          border: 0,
          margin: 0,
          borderRadius: `${theme.radius.sm}px !important`,
        },
      }) : undefined}
      size="small"
      exclusive
      aria-label={label}
      value={value}
      onChange={(_, next: T | null) => next && onChange(next)}
    >
      {options.map((option) => {
        const content = option.icon ?? (
          <Typography variant="body2" sx={{ lineHeight: 1.4, fontSize: 12 }}>
            {option.label}
          </Typography>
        )

        return (
          <ToggleButton
            key={option.value}
            value={option.value}
            aria-label={option.label}
            disabled={option.disabled}
            sx={presentation === 'view' ? {
              height: 32,
              flex: 1,
              px: space.sm,
              gap: space.xs,
              textTransform: 'none',
              color: 'text.secondary',
              '&.Mui-selected': {
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: 1,
                '&:hover': { bgcolor: 'background.paper' },
              },
            } : { px: 1, py: 0.25 }}
          >
            {option.hint ? <AppTooltip title={option.hint}>{content}</AppTooltip> : content}
            {presentation === 'view' && option.icon && (
              <Typography variant="body2" component="span">{option.label}</Typography>
            )}
          </ToggleButton>
        )
      })}
    </ToggleButtonGroup>
  )
}
