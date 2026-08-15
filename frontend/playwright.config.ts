import { defineConfig } from '@playwright/test'

/* ──────────────────────────────────────────────
   Regressão visual
   ──────────────────────────────────────────────

   O objetivo aqui é estreito de propósito: provar que uma mudança de código
   não mexeu no que a tela mostra. Não é teste de fluxo, não substitui o
   vitest — é o único check do projeto que enxerga pixel, e é o que cobre a
   migração das telas restantes para o design system.

   A API nunca é chamada de verdade. `VITE_API_URL` aponta para uma origem
   que não existe (`http://api.test`) e o fixture intercepta tudo. Assim o
   teste não depende do backend estar de pé nem do banco ter os mesmos dados
   de ontem — snapshot que muda sozinho é snapshot que se aprende a ignorar.

   Roda contra o dev server: ele sobe em ~1s contra os ~15s do build, e a
   diferença de renderização para o bundle de produção é nula na prática
   (mesmo CSS do Emotion, mesma fonte auto-hospedada). O build de produção
   já é verificado à parte no pre-push.

   Primeira execução, ou depois de uma mudança visual intencional:

       npm run e2e:update
   ────────────────────────────────────────────── */

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    /* O app decide o tema pelo `prefers-color-scheme` quando não há escolha
       salva. Fixar aqui e no localStorage evita que o snapshot dependa da
       configuração do sistema de quem roda. */
    colorScheme: 'light',
  },

  expect: {
    toHaveScreenshot: {
      /* Os dois limites foram calibrados contra uma mudança real — trocar
         `radius.md` de 8px para 14px — e ambos precisaram sair do padrão
         para que ela fosse detectada:

         `maxDiffPixels` é absoluto, não proporcional. Um `maxDiffPixelRatio`
         de 1% parece apertado, mas numa imagem de 1440x3000 são 43 mil
         pixels de folga; a mudança de raio mexe em 384 e passava batido.

         `threshold` é a tolerância de cor por pixel, e o padrão de 0.2 é
         alto demais para esta UI: a borda dos cards é rgba(0,0,0,0.08)
         sobre branco, uma diferença que 0.2 simplesmente não conta. Com
         0.05 a mudança aparece e o run limpo continua dando zero.

         O nome do snapshot inclui a plataforma, então máquinas diferentes
         não disputam o mesmo arquivo. */
      maxDiffPixels: 100,
      threshold: 0.05,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  /* Normalmente o browser vem de `npx playwright install chromium`. Em
     ambientes onde ele é provisionado por fora — um container de CI, um
     agente — `PLAYWRIGHT_CHROMIUM_PATH` aponta para o binário existente em
     vez de tentar baixar outro. */
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { VITE_API_URL: 'http://api.test' },
  },
})
