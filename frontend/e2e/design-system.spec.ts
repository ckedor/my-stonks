import {
  DESIGN_SYSTEM_FAMILIES,
  designSystemFamilyPath,
  type DesignSystemFamilySlug,
} from '../src/pages/dev/design-system/families'
import { expect, expectNothingClipped, test } from './fixtures/app'

/* O catálogo do design system renderiza todo componente, em todos os
   estados, uma família por tela. É o snapshot de maior cobertura do projeto:
   qualquer mudança de token, de paleta ou de componente aparece aqui antes
   de aparecer numa tela de verdade.

   A lista de famílias vem de `families.ts`, a mesma que monta as rotas e o
   menu, então família nova entra aqui sozinha — e o `Record` abaixo não
   compila sem a altura dela. */

/* A casca de `/dev` rola por dentro, então a viewport precisa comportar a
   família inteira. As alturas foram medidas com folga de ~300px;
   `expectNothingClipped` avisa quando uma deixar de bastar. */
const VIEWPORT_HEIGHT: Record<DesignSystemFamilySlug, number> = {
  fundamentos: 2800,
  texto: 3400,
  acoes: 2100,
  escolha: 2200,
  campos: 3900,
  feedback: 2300,
  espera: 2100,
  numeros: 1400,
  tabelas: 4100,
  superficies: 1900,
  graficos: 3000,
}

for (const family of DESIGN_SYSTEM_FAMILIES) {
  test(`design system — ${family.label}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: VIEWPORT_HEIGHT[family.slug] })
    await page.goto(designSystemFamilyPath(family.slug))

    await expect(page.getByRole('heading', { name: family.label, exact: true })).toBeVisible()
    await expectNothingClipped(page)

    await expect(page).toHaveScreenshot(`design-system-${family.slug}.png`, { fullPage: true })
  })
}

test('design system — a raiz abre a primeira família', async ({ page }) => {
  await page.goto('/dev/design-system')

  await expect(page).toHaveURL(designSystemFamilyPath(DESIGN_SYSTEM_FAMILIES[0].slug))
})
