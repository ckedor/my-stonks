import { Stack, Switch, Typography } from '@mui/material'

/** Rótulo antes do controle, como na barra do `CandleChart`: a barra se lê da
 *  esquerda para a direita, e o `FormControlLabel` invertia essa ordem e ainda
 *  trazia margens próprias que desalinhavam a linha. */
export default function ToolbarSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Switch size="small" checked={checked} onChange={(_, value) => onChange(value)} />
    </Stack>
  )
}
