import { Divider, MenuItem, TextField, Typography } from '@mui/material'
import type { ReactNode } from 'react'

/* Escolha de um valor entre poucos.
 *
 * Diferente do `AppAutocomplete`, que existe para lista longa e por isso
 * carrega busca: aqui a lista cabe na tela e o campo de busca só atrapalha.
 *
 * As opções chegam como dados, e não como filhos: `<MenuItem>` na página
 * seria o MUI vazando para fora do design system pela porta dos fundos. */

export interface AppSelectAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
}

export interface AppSelectOption {
  value: string
  label: string
}

export interface AppSelectProps {
  options: AppSelectOption[]
  value: string
  onChange: (value: string) => void
  /** Rótulo flutuante. Omitido, o campo aparece sem rótulo — é o que serve
   *  numa barra de gráfico, onde o contexto já está na tela. */
  label?: string
  /** `sm` = 180px, `md` = 260px, `full` = a largura do container. Padrão:
   *  `sm`. */
  size?: 'sm' | 'md' | 'full'
  /** Ações no fim da lista, separadas das opções por uma régua — criar ou
   *  editar aquilo que se está escolhendo. Sem elas o fluxo obriga a fechar
   *  a lista, ir a outra tela e voltar. */
  actions?: AppSelectAction[]
  /** `compact` é altura de barra; `comfortable` é altura de formulário,
   *  para o campo não ficar mais baixo que o vizinho na mesma linha.
   *  Padrão: `compact`. */
  density?: 'compact' | 'comfortable'
  error?: boolean
}

const WIDTH = { sm: 180, md: 260, full: '100%' } as const

export default function AppSelect({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  actions,
  density = 'compact',
  error = false,
}: AppSelectProps) {
  return (
    <TextField
      select
      size={density === 'compact' ? 'small' : 'medium'}
      label={label}
      error={error}
      value={value}
      /* Clicar numa ação também dispara o `onChange` do Select, com o
         `value` vazio do `<MenuItem>` que a desenha — e o campo ficaria em
         branco depois de abrir um formulário. Só valor que existe na lista
         de opções passa. */
      onChange={(event) => {
        const next = event.target.value
        if (options.some((option) => option.value === next)) onChange(next)
      }}
      /* Largura fixa, e não `100%` limitado por `maxWidth`: numa barra em
         flex o `100%` faz o campo reivindicar a linha inteira e empurrar o
         vizinho para a linha de baixo — que é justamente o empilhamento que
         a barra existe para não ter. `full` é a exceção, para quando o
         container é uma coluna e a largura dele é que manda. */
      sx={{ width: WIDTH[size], flexShrink: 0 }}
      /* A lista abre sem travar a rolagem da página por baixo: travar faz a
         barra de rolagem sumir e tudo saltar alguns pixels para o lado. */
      slotProps={{
        select: {
          MenuProps: { disableScrollLock: true },
          /* Uma opção de valor vazio é uma escolha — "sem benchmark" — e não
             a ausência de escolha. Sem `displayEmpty` o `Select` desenha o
             campo em branco justamente no caso em que a pessoa escolheu
             alguma coisa. */
          displayEmpty: options.some((option) => option.value === ''),
        },
      }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}

      {/* Achatado, sem `Fragment`: o `Select` percorre os próprios filhos
          para descobrir qual rótulo mostrar, e um `Fragment` no meio
          esconde o que está dentro dele — o campo aparece em branco depois
          de clicar numa ação. */}
      {actions && actions.length > 0 && <Divider key="__acoes" />}
      {actions?.map((action) => (
        <MenuItem key={action.label} onClick={action.onSelect} sx={{ gap: 1, color: 'primary.main' }}>
          {action.icon}
          <Typography sx={{ fontStyle: 'italic', color: 'primary.main' }}>
            {action.label}
          </Typography>
        </MenuItem>
      ))}
    </TextField>
  )
}
