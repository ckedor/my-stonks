import { test as base, expect, type Page } from '@playwright/test'

/* Origem falsa configurada em `playwright.config.ts`. Nada aqui sai para a
   rede: se um endpoint não estiver mockado, o catch-all responde 404 e a
   tela mostra o próprio estado de erro — visível no snapshot, em vez de
   silenciosamente vazio. */
export const API_ORIGIN = 'http://api.test'

/** Resposta de `GET /users/me`. Admin, para abrir as telas sob `/admin`. */
const ME = { email: 'e2e@my-stonks.test', is_admin: true }

export interface AppFixtures {
  /** Registra a resposta de um endpoint. Caminho sem a origem: `/users`. */
  mockApi: (path: string, body: unknown) => Promise<void>
}

async function json(page: Page, path: string, body: unknown) {
  await page.route(`${API_ORIGIN}${path}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  )
}

export const test = base.extend<AppFixtures>({
  page: async ({ page, baseURL }, use) => {
    /* Sem tema fixo o snapshot depende da preferência de cor do sistema
       operacional de quem roda o teste. */
    await page.addInitScript(() => {
      localStorage.setItem('theme-mode', 'light')
      localStorage.setItem('theme-light-id', 'principal-light')
    })

    /* `initAuth()` só chama `/users/me` se o cookie existir. */
    await page.context().addCookies([
      { name: 'token', value: 'e2e-token', url: baseURL as string },
    ])

    /* O Playwright resolve a rota registrada por último primeiro, então o
       catch-all entra antes de tudo e qualquer mock posterior tem
       precedência sobre ele. */
    await page.route(`${API_ORIGIN}/**`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'endpoint não mockado no teste' }),
      }),
    )
    await json(page, '/users/me', ME)

    await use(page)
  },

  mockApi: async ({ page }, use) => {
    await use((path, body) => json(page, path, body))
  },
})

export { expect } from '@playwright/test'

/* Os layouts do app ocupam `100vh` e rolam por dentro, então o documento
   nunca cresce e `fullPage: true` não captura nada além da viewport — o
   snapshot sai cortado sem avisar. A saída é dar uma viewport alta ao teste,
   e esta asserção é o que garante que ela continua alta o bastante: se o
   conteúdo crescer, o teste falha dizendo isso, em vez de passar a validar
   silenciosamente só o topo da tela. */
export async function expectNothingClipped(page: Page) {
  const clipped = await page.evaluate(() => {
    const out: string[] = []
    document.querySelectorAll('*').forEach((el) => {
      const e = el as HTMLElement
      if (e.clientHeight > 200 && e.scrollHeight > e.clientHeight + 8) {
        out.push(`<${e.tagName.toLowerCase()}> visível=${e.clientHeight}px conteúdo=${e.scrollHeight}px`)
      }
    })
    return out
  })

  expect(clipped, 'conteúdo além da viewport: aumente a altura em test.use({ viewport })').toEqual([])
}
