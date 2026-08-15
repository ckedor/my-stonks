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
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="sx"]',
          message: 'Estilo mora no componente, não na página. Adicione a variante em "@/components/ui".',
        },
        {
          selector: 'JSXAttribute[name.name="style"]',
          message: 'Estilo mora no componente, não na página. Adicione a variante em "@/components/ui".',
        },
      ],
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
