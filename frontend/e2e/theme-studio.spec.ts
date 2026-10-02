import { THEME_PRESETS } from '../src/theme/presets'
import { expect, expectNothingClipped, test } from './fixtures/app'

/* O estúdio de temas desenha o dashboard da carteira com uma carteira de
   mentira sob o tema escolhido. Um snapshot por preset é a regressão visual
   dos temas: mudar um token, um componente ou o dashboard aparece aqui em
   todos os dez de uma vez — inclusive no escuro, que o resto da suíte, presa
   ao Tinta claro, não fotografa.

   A lista vem de `presets.ts`, então preset novo entra aqui sozinho. A
   carteira é determinística (semente e data final fixas); o relógio fica
   parado no último dia dela, para a média de proventos dos 12 meses não
   andar com o calendário. */

const LAST_DAY = new Date('2026-09-30T12:00:00-03:00')

/* A casca de `/dev` rola por dentro, e o estúdio é uma tela longa: editor,
   contraste e o dashboard inteiro. `expectNothingClipped` avisa quando a
   altura deixar de bastar. */
test.use({ viewport: { width: 1440, height: 2700 } })

for (const preset of THEME_PRESETS) {
  test(`estúdio de temas — ${preset.id}`, async ({ page }) => {
    await page.clock.setFixedTime(LAST_DAY)
    await page.goto(`/dev/design-system/temas?preset=${preset.id}`)

    await expect(page.getByRole('heading', { name: 'Estúdio de temas' })).toBeVisible()
    await expect(page.getByText('Rentabilidade').first()).toBeVisible()
    await expectNothingClipped(page)

    await expect(page).toHaveScreenshot(`theme-studio-${preset.id}.png`, { fullPage: true })
  })
}
