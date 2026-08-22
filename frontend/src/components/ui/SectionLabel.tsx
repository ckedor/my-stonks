import { Typography } from '@mui/material'

/* Rótulo de um grupo de itens — o "OSCILAÇÃO" acima das três métricas que
 * respondem a essa pergunta.
 *
 * Um degrau abaixo do `SectionTitle`: aquele nomeia um bloco que a pessoa
 * lê; este só diz sob qual assunto os itens abaixo caem, e por isso é
 * pequeno, em caixa alta e na cor de apoio. */

export interface SectionLabelProps {
  children: string
}

export default function SectionLabel({ children }: SectionLabelProps) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        display: 'block',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Typography>
  )
}
