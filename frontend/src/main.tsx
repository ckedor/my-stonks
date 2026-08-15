import App from '@/App'
// O tema pede Inter desde sempre, mas ninguém a carregava: o app inteiro caía
// no Arial do sistema. Auto-hospedada, sem depender de CDN em tempo de
// execução — a variável cobre todos os pesos em um arquivo só.
import '@fontsource-variable/inter'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
