import {
  DESIGN_SYSTEM_FAMILIES,
  designSystemFamilyPath,
  THEME_STUDIO_PATH,
} from './design-system/families'

/* O menu das ferramentas de desenvolvimento: o painel de deploy, o estúdio
 * do jogo, as famílias do catálogo do design system e o estúdio de temas. */

export interface DevNavigationItem {
  group: string
  label: string
  path: string
}

/** O painel que roda os checks, commita e faz push. */
export const DEPLOY_PATH = '/dev/deploy'

/** O estúdio do jogo da cidade: o mapa para testar e o catálogo da loja. */
export const SANDBOX_PATH = '/dev/jogo/sandbox'
export const CATALOG_PATH = '/dev/jogo/catalogo'

export const devNavigationItems: DevNavigationItem[] = [
  { group: 'Entrega', label: 'Deploy', path: DEPLOY_PATH },
  { group: 'Jogo', label: 'Sandbox', path: SANDBOX_PATH },
  { group: 'Jogo', label: 'Catálogo', path: CATALOG_PATH },
  ...DESIGN_SYSTEM_FAMILIES.map((family) => ({
    group: 'Componentes',
    label: family.label,
    path: designSystemFamilyPath(family.slug),
  })),
  { group: 'Temas', label: 'Estúdio de temas', path: THEME_STUDIO_PATH },
]
