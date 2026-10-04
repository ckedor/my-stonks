import { Outlet } from 'react-router-dom'
import DevShell from './DevShell'

/* A rota-mãe do catálogo do design system. O estúdio de temas monta a
 * `DevShell` por conta própria — ver o comentário dela. */
export default function DevLayout() {
  return (
    <DevShell>
      <Outlet />
    </DevShell>
  )
}
