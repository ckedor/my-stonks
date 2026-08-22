import { TextField } from '@mui/material'
import type { ReactNode } from 'react'

/* Campo de texto de formulário.
 *
 * Sempre ocupa a largura do container: quem decide o quanto ele é largo é a
 * linha onde ele está, não o campo. Foi o `sx={{ flex: 2 }}` e o `fullWidth`
 * alternando de tela em tela que produziu campos de larguras diferentes
 * lado a lado.
 *
 * Diferente do `AppNumberField`, que é campo de barra de controle e por
 * isso tem largura fixa e nomeada. */

export interface AppTextFieldProps {
  value: string
  onChange: (value: string) => void
  /** Rótulo flutuante. Sem ele o campo aparece sem rótulo, para linhas onde
   *  o cabeçalho da coluna já diz o que é. */
  label?: string
  /** `number` aceita só número e devolve número. */
  type?: 'text' | 'number'
  /** `compact` é altura de barra; `comfortable` é altura de formulário.
   *  Padrão: `comfortable`. */
  density?: 'compact' | 'comfortable'
  /** Mostra o valor sem deixar editar — o ativo de uma negociação já salva. */
  readOnly?: boolean
  error?: boolean
  /** Mensagem sob o campo. Com `error`, é o motivo da recusa. */
  helperText?: string
  /** Conteúdo colado à direita, dentro da moldura — um spinner, uma unidade. */
  endAdornment?: ReactNode
  /** Exemplo do que se espera, visível enquanto o campo está vazio. */
  placeholder?: string
  /** Disparado no Enter, para o formulário que se envia pelo teclado. */
  onSubmit?: () => void
}

export default function AppTextField({
  value,
  onChange,
  label,
  type = 'text',
  density = 'comfortable',
  readOnly = false,
  error = false,
  helperText,
  endAdornment,
  placeholder,
  onSubmit,
}: AppTextFieldProps) {
  return (
    <TextField
      fullWidth
      label={label}
      type={type}
      size={density === 'compact' ? 'small' : 'medium'}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSubmit?.()
      }}
      error={error}
      helperText={helperText}
      slotProps={{ input: { readOnly, endAdornment } }}
    />
  )
}
