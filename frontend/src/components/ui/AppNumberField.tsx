import { TextField } from '@mui/material'

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

export interface AppNumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
  /** Texto curto colado antes do número — um símbolo de moeda, um sinal. */
  prefix?: string
  /** Texto curto colado depois do número — uma unidade, um `%`. Fica no
   *  campo e não no rótulo porque rótulo cortado não diz unidade nenhuma. */
  suffix?: string
  /** `xs` cabe 3 dígitos, `sm` cabe 5, `md` cabe um valor com milhar.
   *  A largura precisa caber o rótulo também: `xs` só serve para rótulo de
   *  uma palavra curta. Padrão: `sm`. */
  size?: 'xs' | 'sm' | 'md'
}

const WIDTH = { xs: 72, sm: 104, md: 148 } as const

export default function AppNumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  prefix,
  suffix,
  size = 'sm',
}: AppNumberFieldProps) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={value}
      onChange={(event) => {
        const next = Number(event.target.value)
        onChange(Number.isFinite(next) ? next : min)
      }}
      slotProps={{
        htmlInput: { min, step },
        input: {
          startAdornment: prefix ? <span>{prefix}&nbsp;</span> : undefined,
          endAdornment: suffix ? <span>&nbsp;{suffix}</span> : undefined,
        },
      }}
      sx={{ width: WIDTH[size] }}
    />
  )
}
