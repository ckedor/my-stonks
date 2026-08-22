import { Typography } from '@mui/material'

/* Rótulo escrito acima do campo, em vez de flutuando dentro dele.
 *
 * É a outra forma de rotular um campo: o `label` do `AppTextField` encolhe
 * para cima quando há valor, este fica parado. Vale quando a linha do
 * rótulo carrega mais do que o nome — o "Esqueci minha senha" ao lado de
 * "Senha" — porque aí ela é uma linha de verdade, e não parte da moldura. */

export interface FieldLabelProps {
  children: string
}

export default function FieldLabel({ children }: FieldLabelProps) {
  return (
    <Typography variant="body1" fontWeight={500}>
      {children}
    </Typography>
  )
}
