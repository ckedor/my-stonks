import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/* O vídeo da tela de login, gravado do app de verdade contra dado fictício.
 *
 * Reaproveita servidor e browser da regressão visual, mas não é teste: não
 * compara nada, só filma. Fica fora de `e2e/` para `npm run e2e` não
 * gravar um vídeo a cada push. Regenerar depois de uma mudança visual:
 *
 *     npm run reel
 *
 * A viewport segue a proporção do painel do login: 60% da largura por toda
 * a altura, ~0,96 numa tela de 1440×900. Gravada mais larga, o `cover`
 * corta os cards pela metade. */
export default defineConfig({
  ...base,
  testDir: './reel',
  outputDir: './reel/.output',
  timeout: 120_000,
  use: {
    ...base.use,
    viewport: { width: 1080, height: 1120 },
    colorScheme: 'dark',
    video: { mode: 'on', size: { width: 1080, height: 1120 } },
  },
})
