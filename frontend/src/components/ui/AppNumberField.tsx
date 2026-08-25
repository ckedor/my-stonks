import { CircularProgress, TextField } from '@mui/material'

/* Campo numérico de barra de controle.
 *
 * `onChange` entrega número, não string: era a página que ficava chamando
 * `Number(e.target.value)` e engolindo o `NaN` de um campo vazio. Aqui o
 * vazio vira o mínimo declarado, então o valor que sai daqui sempre serve
 * para conta.
 *
 * As larguras são nomeadas porque um campo de "Anos" e um de "Aporte" não
 * têm o mesmo tamanho — mas os dois tamanhos são decisão daqui, não os
 * 60/80/120px avulsos que estavam espalhados nas telas. */

interface AppNumberFieldBase {
  /** Some da tela com `hideLabel`, mas continua sendo o nome acessível. */
  label: string
  min?: number
  step?: number
  /** Texto curto colado antes do número — um símbolo de moeda, um sinal. */
  prefix?: string
  /** Texto curto colado depois do número — uma unidade, um `%`. Fica no
   *  campo e não no rótulo porque rótulo cortado não diz unidade nenhuma. */
  suffix?: string
  /** `xs` cabe 3 dígitos, `sm` cabe 5, `md` cabe um valor com milhar,
   *  `full` ocupa a largura do container. A largura precisa caber o rótulo
   *  também: `xs` só serve para rótulo de uma palavra curta. Padrão: `sm`. */
  size?: 'xs' | 'sm' | 'md' | 'full'
  /** `compact` é altura de barra; `comfortable` é altura de formulário.
   *  Padrão: `compact`. */
  density?: 'compact' | 'comfortable'
  error?: boolean
  /** Mensagem sob o campo. Com `error`, é o motivo da recusa. */
  helperText?: string
  /** Spinner no canto do campo: o valor está sendo buscado, e o que está
   *  escrito ainda vai mudar. */
  busy?: boolean
  /** Esconde o rótulo flutuante: dentro de uma célula de tabela o cabeçalho
   *  da coluna já diz o que o número é, e o rótulo repetiria a palavra em
   *  cada linha. */
  hideLabel?: boolean
  /** Alinha o número à direita, para a coluna de valores em que ele mora. */
  align?: 'left' | 'right'
}

/* Vazio é um valor em alguns campos e não é em outros: no aporte simulado
 * "nada" e "zero" são a mesma coisa, mas num alvo de rebalanceamento "sem
 * alvo" e "alvo de 0%" são decisões diferentes. `allowEmpty` separa os dois
 * casos no tipo, para a página não precisar adivinhar o que vem no callback. */
export type AppNumberFieldProps =
  | (AppNumberFieldBase & {
      allowEmpty?: false
      value: number
      onChange: (value: number) => void
    })
  | (AppNumberFieldBase & {
      allowEmpty: true
      value: number | null
      onChange: (value: number | null) => void
    })

const WIDTH = { xs: 72, sm: 104, md: 148, full: '100%' } as const

export default function AppNumberField({
  label,
  value,
  onChange,
  allowEmpty = false,
  hideLabel = false,
  align = 'left',
  min = 0,
  step = 1,
  prefix,
  suffix,
  size = 'sm',
  density = 'compact',
  error = false,
  helperText,
  busy = false,
}: AppNumberFieldProps) {
  return (
    <TextField
      label={hideLabel ? undefined : label}
      aria-label={hideLabel ? label : undefined}
      type="number"
      size={density === 'compact' ? 'small' : 'medium'}
      error={error}
      helperText={helperText}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        if (raw === '') {
          ;(onChange as (value: number | null) => void)(allowEmpty ? null : min)
          return
        }
        const next = Number(raw)
        if (Number.isFinite(next)) onChange(next)
      }}
      slotProps={{
        htmlInput: { min, step },
        input: {
          startAdornment: prefix ? <span>{prefix}&nbsp;</span> : undefined,
          endAdornment: busy ? (
            <CircularProgress size={18} />
          ) : suffix ? (
            <span>&nbsp;{suffix}</span>
          ) : undefined,
        },
      }}
      sx={{
        width: WIDTH[size],
        ...(align === 'right' ? { '& input': { textAlign: 'right' } } : null),
        /* As setinhas do `type=number` roubam largura da célula e ninguém as
           usa para digitar um percentual. */
        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
        '& input[type=number]': { MozAppearance: 'textfield' },
      }}
    />
  )
}
