import { QueryProvider } from '@/queries/client'
import { ThemeRegistry } from '@/theme'
import '@fontsource-variable/figtree'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/pixelify-sans'
import '@fontsource-variable/source-serif-4'
import '@/index.css'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import DeployPage from './pages/deploy/page'
import DesignSystemPage from './pages/design-system/page'
import CatalogPage from './pages/game-studio/CatalogPage'
import SandboxPage from './pages/game-studio/SandboxPage'
import DevLayout from './pages/layout'
import ThemeStudioPage from './pages/theme-studio/page'

/* As ferramentas de desenvolvimento, fora do app: o mesmo tema, as mesmas
   fontes e os mesmos componentes, por `@/`. */
dayjs.locale('pt-br')

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dev/deploy" replace /> },
  { path: '/dev', element: <Navigate to="/dev/deploy" replace /> },
  /* Fora da rota-mãe: o estúdio monta a casca sob o tema em edição. */
  { path: '/dev/design-system/temas', element: <ThemeStudioPage /> },
  {
    element: <DevLayout />,
    children: [
      { path: '/dev/design-system/:family?', element: <DesignSystemPage /> },
      { path: '/dev/deploy', element: <DeployPage /> },
      { path: '/dev/jogo', element: <Navigate to="/dev/jogo/sandbox" replace /> },
      { path: '/dev/jogo/sandbox', element: <SandboxPage /> },
      { path: '/dev/jogo/catalogo', element: <CatalogPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeRegistry>
        <RouterProvider router={router} />
      </ThemeRegistry>
    </QueryProvider>
  </StrictMode>,
)
