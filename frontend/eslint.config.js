import { readFileSync } from 'node:fs'
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/* ──────────────────────────────────────────────
   Fronteira do design system
   ──────────────────────────────────────────────

   O app tem três camadas, mas só dois regimes de lint:

     1. Design system  — `src/components/ui/` e `src/theme/`
        Única camada autorizada a importar o MUI e a escrever estilo.

     2. Consumidores   — todo o resto (`src/pages/`, `src/components/`,
        `src/layouts/`). Componente de domínio e página seguem exatamente
        a mesma regra: sem MUI, sem `sx`, sem `style`. Layout se compõe
        pelas props dos primitivos (`AppStack`, `AppGrid`); token se lê
        pelo `useAppTheme`.

   A migração é incremental via ratchet: `eslint-ds-baseline.json` lista os
   arquivos legados que ainda podem violar. Arquivo novo já nasce sob a
   regra. A lista só encolhe — `npm run lint:ds` garante isso. */

const DESIGN_SYSTEM = ['src/components/ui/**', 'src/theme/**']

/* `DS_BASELINE_OFF=1` ignora as isenções e revela o conjunto real de
   violações. É como `npm run lint:ds` compara a lista com a realidade. */
const legacy = process.env.DS_BASELINE_OFF
  ? { files: [] }
  : JSON.parse(readFileSync(new URL('./eslint-ds-baseline.json', import.meta.url), 'utf8'))

const USE_DS = 'Importe de "@/components/ui". Só o design system pode depender do MUI.'

const INLINE_STYLE =
  'Estilo mora no componente, não na página. Adicione a variante em "@/components/ui".'

/* Os seletores são constantes porque `no-restricted-syntax` não soma entre
   blocos de config: o bloco mais específico substitui a lista inteira do
   anterior. Compor a partir daqui é o que impede uma regra de sumir sem
   ninguém notar ao acrescentar outra. */
const NO_INLINE_STYLE = [
  { selector: 'JSXAttribute[name.name="sx"]', message: INLINE_STYLE },
  { selector: 'JSXAttribute[name.name="style"]', message: INLINE_STYLE },
]

const NO_SPINNER = {
  selector: 'JSXOpeningElement[name.name="LoadingSpinner"]',
  message:
    'A espera de uma tela é a reserva do que vem: use "AppSkeleton" ou um "*Skeleton" da tela. O "LoadingSpinner" é para a espera em linha de uma ação disparada por alguém.',
}

const NO_PAGE_TITLE = {
  selector: 'JSXOpeningElement[name.name="PageTitle"]',
  message:
    'O cabeçalho de uma página é o "AppPageHeader": ele já traz título, breadcrumb, ações e métricas.',
}

/* As entradas do baseline são caminhos literais, mas `files` espera glob.
   Sem escapar, uma rota dinâmica como `asset/[id]/page.tsx` vira classe de
   caracteres e o arquivo nunca casa — ficando bloqueado apesar de listado. */
const escapeGlob = (p) => p.replace(/[[\]{}()!*?+@]/g, (c) => `\\${c}`)

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  /* ── Testes de ponta a ponta ──
     Não há React aqui. As fixtures do Playwright recebem um callback
     chamado `use`, que a regra de hooks confunde com o `use` do React. */
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  /* ── Regime 2: consumidores do design system ── */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: DESIGN_SYSTEM,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@mui/material', message: USE_DS },
            { name: '@mui/material/styles', message: `${USE_DS} Para ler token, use "useAppTheme".` },
          ],
          patterns: [{ group: ['@mui/material/*'], message: USE_DS }],
        },
      ],
      'no-restricted-syntax': ['error', ...NO_INLINE_STYLE],
    },
  },

  /* ── Espera de tela: esqueleto, não spinner ──

     Um disco girando no meio do vazio não diz nada sobre o que vem, e faz a
     tela saltar quando o dado chega. A reserva do conteúdo (`AppSkeleton` e
     os `*Skeleton` feitos com ele) diz as duas coisas. O `LoadingSpinner`
     continua existindo para a espera em linha de uma ação que alguém acabou
     de disparar — o botão que recalcula, a carteira trocando na barra do
     topo —, e é por isso que a regra alcança as páginas e não o app inteiro:
     é a página que espera por conteúdo. */
  {
    files: ['src/pages/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_INLINE_STYLE, NO_SPINNER],
    },
  },

  /* ── Gramática de tela: toda página abre pelo mesmo cabeçalho ──

     Antes desta regra cada tela montava o próprio: seis das vinte tinham
     breadcrumb, quatro não tinham título nenhum, e a de Rebalanceamento
     mandava o título para um store que nada renderizava. O `AppPageHeader`
     é a decisão tomada uma vez — rastro, título, ações, métricas —, e o
     que impede a divergência de voltar é a regra e não a convenção.

     Vale só para as telas do produto: um componente de domínio pode ter um
     `PageTitle` dentro (o cabeçalho de um painel), mas a página que decide
     o layout da tela não escolhe o próprio desenho de abertura.

     `src/pages/admin/**` ainda está de fora, e é dívida declarada: o admin
     tem shell e navegação próprios (`AppShell`), e migrar os dois de uma
     vez tornaria o diff visual ilegível. Quando ele migrar, o glob vira
     `src/pages/**` e este parágrafo sai junto. */
  {
    files: ['src/pages/portfolio/**/*.tsx', 'src/pages/market/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_INLINE_STYLE, NO_SPINNER, NO_PAGE_TITLE],
    },
  },

  /* ── Dívida existente: sai da lista conforme migra ──
     Some por inteiro quando o último arquivo for migrado. */
  ...(legacy.files.length
    ? [
        {
          files: legacy.files.map(escapeGlob),
          rules: {
            'no-restricted-imports': 'off',
            'no-restricted-syntax': 'off',
          },
        },
      ]
    : []),
])
