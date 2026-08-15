import { expect, expectNothingClipped, test } from './fixtures/app'

/* A página de design system renderiza todos os componentes num lugar só, o
   que a torna o snapshot de maior cobertura do projeto: qualquer mudança de
   token, de paleta ou de componente aparece aqui antes de aparecer numa
   tela de verdade. */

/* A aba General tem ~2900px de conteúdo e o layout do admin rola por
   dentro, então a viewport precisa comportar a página inteira.
   `expectNothingClipped` avisa quando esta altura deixar de bastar. */
test.use({ viewport: { width: 1440, height: 3000 } })

test('design system — componentes e paleta', async ({ page }) => {
  await page.goto('/admin/design-system')

  await expect(page.getByRole('heading', { name: 'Design System' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('design-system-general.png', { fullPage: true })
})
