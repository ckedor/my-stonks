import { useTheme } from '@mui/material/styles'

/* ──────────────────────────────────────────────
   useAppTheme — leitura de token fora do design system
   ──────────────────────────────────────────────

   Ler token é diferente de escrever estilo. Um gráfico que consome
   `theme.palette.chart.colors` está lendo *dado* de tema, não driblando o
   design system — e por isso continua permitido em qualquer camada.

   Existe para que `@mui/material` possa ficar 100% banido fora de
   `components/ui/`: as camadas de domínio e de página chegam ao tema por
   aqui. No dia de trocar o MUI, troca-se a implementação deste hook em vez
   de caçar as dezenas de chamadas espalhadas. */

export const useAppTheme = useTheme

export type { Theme as AppTheme } from '@mui/material/styles'
