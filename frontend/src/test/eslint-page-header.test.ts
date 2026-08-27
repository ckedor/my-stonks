import { ESLint } from 'eslint'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/* A guarda que impede a divergência de cabeçalhos de voltar.
 *
 * Uma regra de lint que para de casar é pior do que nenhuma, porque é
 * confiada: o `npm run lint` continua verde e a tela nova volta a escrever
 * o próprio título. Estes dois casos são o que prova que ela ainda dispara
 * — e, o outro lado, que ela não dispara onde não deve. */

/* O vitest roda a partir de `frontend/`, que é onde o config mora. Sob o
   jsdom, `import.meta.url` não é um caminho de arquivo. */
const projectRoot = process.cwd()

const eslint = new ESLint({
  cwd: projectRoot,
  overrideConfigFile: path.join(projectRoot, 'eslint.config.js'),
})

async function messagesFor(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.map((m) => m.message)
}

const PAGE_WITH_OWN_TITLE = `
import { AppStack, PageTitle } from '@/components/ui'

export default function Tela() {
  return (
    <AppStack>
      <PageTitle>Uma tela qualquer</PageTitle>
    </AppStack>
  )
}
`

const PAGE_WITH_HEADER = `
import { AppPageHeader, AppStack } from '@/components/ui'

export default function Tela() {
  return (
    <AppStack>
      <AppPageHeader title="Uma tela qualquer" />
    </AppStack>
  )
}
`

const HEADER_RULE = /AppPageHeader/

describe('a página não escreve o próprio cabeçalho', () => {
  it('reprova uma tela do produto que usa PageTitle direto', async () => {
    const messages = await messagesFor(
      'src/pages/portfolio/inventada/page.tsx',
      PAGE_WITH_OWN_TITLE,
    )

    expect(messages.some((m) => HEADER_RULE.test(m))).toBe(true)
  })

  it('aprova a mesma tela pelo AppPageHeader', async () => {
    const messages = await messagesFor('src/pages/portfolio/inventada/page.tsx', PAGE_WITH_HEADER)

    expect(messages.some((m) => HEADER_RULE.test(m))).toBe(false)
  })

  it('não alcança o design system, que é quem define o PageTitle', async () => {
    const messages = await messagesFor('src/components/ui/AlgumComponente.tsx', PAGE_WITH_OWN_TITLE)

    expect(messages.some((m) => HEADER_RULE.test(m))).toBe(false)
  })
})
