import { ESLint } from 'eslint'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/* A guarda que mantém a espera das telas em esqueleto.
 *
 * Vale o mesmo que vale para o cabeçalho: regra confiada que para de casar é
 * pior do que regra nenhuma — o `npm run lint` segue verde e a tela nova
 * volta a girar um disco no meio do vazio. Os casos abaixo provam que ela
 * dispara na página, que não alcança a espera em linha fora dela, e que
 * continua barrando o `PageTitle` na tela do produto — este último porque as
 * duas regras dividem o mesmo `no-restricted-syntax`, e acrescentar uma
 * apagaria a outra sem aviso. */

const projectRoot = process.cwd()

const eslint = new ESLint({
  cwd: projectRoot,
  overrideConfigFile: path.join(projectRoot, 'eslint.config.js'),
})

async function messagesFor(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.map((m) => m.message)
}

const PAGE_WITH_SPINNER = `
import { AppStack, LoadingSpinner } from '@/components/ui'

export default function Tela({ loading }: { loading: boolean }) {
  if (loading) return <LoadingSpinner />

  return <AppStack />
}
`

const PAGE_WITH_SKELETON = `
import { AppSkeleton, AppStack } from '@/components/ui'

export default function Tela({ loading }: { loading: boolean }) {
  if (loading) return <AppSkeleton height={320} />

  return <AppStack />
}
`

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

const SPINNER_RULE = /LoadingSpinner/
const HEADER_RULE = /AppPageHeader/

describe('a tela espera mostrando o que vem', () => {
  it('reprova a página que gira um spinner enquanto carrega', async () => {
    const messages = await messagesFor(
      'src/pages/portfolio/inventada/page.tsx',
      PAGE_WITH_SPINNER,
    )

    expect(messages.some((m) => SPINNER_RULE.test(m))).toBe(true)
  })

  it('aprova a mesma página reservando o espaço do conteúdo', async () => {
    const messages = await messagesFor(
      'src/pages/portfolio/inventada/page.tsx',
      PAGE_WITH_SKELETON,
    )

    expect(messages.some((m) => SPINNER_RULE.test(m))).toBe(false)
  })

  it('alcança também o admin, que não segue a gramática de cabeçalho', async () => {
    const messages = await messagesFor('src/pages/admin/inventada/page.tsx', PAGE_WITH_SPINNER)

    expect(messages.some((m) => SPINNER_RULE.test(m))).toBe(true)
  })

  it('não alcança a espera em linha de um componente fora das páginas', async () => {
    const messages = await messagesFor('src/components/AlgumPainel.tsx', PAGE_WITH_SPINNER)

    expect(messages.some((m) => SPINNER_RULE.test(m))).toBe(false)
  })

  it('não apagou a regra de cabeçalho, que divide o mesmo no-restricted-syntax', async () => {
    const messages = await messagesFor(
      'src/pages/portfolio/inventada/page.tsx',
      PAGE_WITH_OWN_TITLE,
    )

    expect(messages.some((m) => HEADER_RULE.test(m))).toBe(true)
  })
})
