import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DoneIcon from '@mui/icons-material/Done'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

/* Um campo de formulário alheio, pronto para copiar.
 *
 * Existe para o que o app não preenche sozinho: uma declaração de IR se
 * digita num programa da Receita, campo a campo. O rótulo é o do campo lá, o
 * valor é o que vai nele, e o botão põe na área de transferência o que o
 * campo aceita — que nem sempre é o que se lê: "1.234,56" na tela, "1234,56"
 * colado, porque um separador de milhar num campo numérico vira erro.
 *
 * A confirmação é o ícone virando um visto por um instante, no próprio
 * botão: um aviso no rodapé a cada campo copiado seria ruído. */

const CONFIRMATION_MS = 1500

export interface AppCopyFieldProps {
  label: string
  value: string
  /** O que vai para a área de transferência. Padrão: `value`. */
  copyValue?: string
  /** Texto longo (uma discriminação) ocupa a largura e quebra linha. */
  multiline?: boolean
}

export default function AppCopyField({
  label,
  value,
  copyValue,
  multiline = false,
}: AppCopyFieldProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), CONFIRMATION_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = () => {
    void navigator.clipboard?.writeText(copyValue ?? value).then(() => setCopied(true))
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            minWidth: 0,
            pt: 0.5,
            ...(multiline
              ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
              : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
          }}
        >
          {value || '—'}
        </Typography>
        {value && (
          <Tooltip title={copied ? 'Copiado' : `Copiar ${label.toLowerCase()}`}>
            <IconButton aria-label={`Copiar ${label}`} size="small" onClick={copy}>
              {copied ? (
                <DoneIcon fontSize="inherit" color="success" />
              ) : (
                <ContentCopyOutlinedIcon fontSize="inherit" />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
