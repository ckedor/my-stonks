import App from '@/App'
// Auto-hospedada, sem depender de CDN em tempo de execução — a variável cobre
// todos os pesos em um arquivo só. A pilha que a consome está em
// `src/theme/tokens.ts`, em `fontStacks` — as quatro pilhas de lá precisam
// estar importadas aqui, senão o tema que escolher uma cai no fallback.
import '@fontsource-variable/figtree'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/source-serif-4'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
