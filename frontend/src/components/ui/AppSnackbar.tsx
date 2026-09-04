import { Alert, Snackbar } from '@mui/material'

/* Aviso temporário no rodapé.
 *
 * O par `Snackbar` + `Alert` aparecia em 31 arquivos, cada um repetindo
 * duração e ancoragem. Posição e tempo de tela são decisão do design
 * system: um aviso não deve aparecer em canto diferente dependendo da
 * página que o disparou. */

export interface AppSnackbarProps {
  open: boolean
  message: string
  /** `info` é o aviso que não é nem sucesso nem falha: a ação deu certo, mas
   *  o resultado tem uma ressalva que a pessoa precisa saber — linhas
   *  descartadas por não terem preço, por exemplo. Sem ele, essa ressalva
   *  saía pintada de verde, dizendo que estava tudo certo. */
  severity: 'success' | 'error' | 'info'
  onClose: () => void
}

export default function AppSnackbar({ open, message, severity, onClose }: AppSnackbarProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity={severity} onClose={onClose}>
        {message}
      </Alert>
    </Snackbar>
  )
}
