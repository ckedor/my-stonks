import App from '@/App'
import { QueryProvider } from '@/queries/client'
// Auto-hospedada, sem depender de CDN em tempo de execução — a variável cobre
// todos os pesos em um arquivo só. A pilha que a consome está em
// `src/theme/tokens.ts`, em `fontStacks` — as pilhas de lá precisam
// estar importadas aqui, senão o tema que escolher uma cai no fallback.
import '@fontsource-variable/figtree'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/pixelify-sans'
import '@fontsource-variable/source-serif-4'
import dayjs from 'dayjs'
/* O locale do dayjs é global e nasce em inglês: sem esta linha, todo
   `format('MMM')` do app escreve "Feb" — o eixo de meses dos gráficos de
   proventos e de patrimônio, num app que fala português do começo ao fim.
   O `LocalizationProvider` do tema define o locale só dos date pickers. */
import 'dayjs/locale/pt-br'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

dayjs.locale('pt-br')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
)
