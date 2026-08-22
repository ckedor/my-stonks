import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { InputAdornment, TextField } from '@mui/material'
import { useState } from 'react'
import AppIconButton from './AppIconButton'

/* Campo de senha, com o olho que revela o que foi digitado.
 *
 * Revelar é do campo, e não de quem chama: toda tela que pede senha precisa
 * disso, e a que esquecer deixa quem digitou errado sem saber onde. */

export interface AppPasswordFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Disparado no Enter, para o formulário que se envia pelo teclado. */
  onSubmit?: () => void
}

export default function AppPasswordField({
  value,
  onChange,
  placeholder,
  onSubmit,
}: AppPasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      fullWidth
      type={visible ? 'text' : 'password'}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSubmit?.()
      }}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <AppIconButton
                label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                size="sm"
                edge="end"
                onClick={() => setVisible((on) => !on)}
              >
                {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </AppIconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
