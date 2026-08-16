import App from '@/App'
// Auto-hospedada, sem depender de CDN em tempo de execução — a variável cobre
// todos os pesos em um arquivo só. A pilha que a consome está em
// `src/theme/tokens.ts`.
import '@fontsource-variable/hanken-grotesk'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
