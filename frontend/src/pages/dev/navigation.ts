import {
  DESIGN_SYSTEM_FAMILIES,
  designSystemFamilyPath,
  THEME_STUDIO_PATH,
} from './design-system/families'

/* O menu das ferramentas de desenvolvimento: as famílias do catálogo do
 * design system e o estúdio de temas. É a mesma lista que a regressão visual
 * percorre. */

export interface DevNavigationItem {
  group: string
  label: string
  path: string
}

export const devNavigationItems: DevNavigationItem[] = [
  ...DESIGN_SYSTEM_FAMILIES.map((family) => ({
    group: 'Componentes',
    label: family.label,
    path: designSystemFamilyPath(family.slug),
  })),
  { group: 'Temas', label: 'Estúdio de temas', path: THEME_STUDIO_PATH },
]
