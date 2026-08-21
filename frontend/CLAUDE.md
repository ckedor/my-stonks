# Frontend guidelines

These instructions extend the repository-level `CLAUDE.md` for files under
`frontend/`.

## Boundaries

- Keep API transport in `src/api/` or the existing API-client layer.
- Pages and components should consume application-facing types instead of
  provider-specific payloads.
- Do not expose Brapi or another market-data provider as a product/domain concept.
- Keep read experiences for asset quotes distinct from operational controls for
  triggering and monitoring ingestion.
- Use the same domain term in routes, API clients, types, state, and visible UI.
  Do not introduce another synonym without updating `docs/domain.md`.
- Preserve backend contract names at the API boundary; map them deliberately if
  the UI uses a different presentation label.

## Design system

The UI has three layers but only two lint regimes. What separates layer 2
from layer 3 is responsibility, not styling: a page fetches data and decides
the screen layout; a domain component receives data through props and does
not know where it came from.

| Layer | Where | Knows the domain? | May import MUI? |
| --- | --- | --- | --- |
| 1. Design system | `src/components/ui/`, `src/theme/` | No | **Yes — only it** |
| 2. Domain component | `src/components/`, or beside the page | Yes | No |
| 3. Page | `src/pages/**` | Yes, and fetches data | No |

Rules for layers 2 and 3:

- Import from `@/components/ui`, never from `@mui/material`.
- No `sx` and no `style` props. Compose layout through the primitives'
  props: `AppStack` (flex), `AppGrid` + `AppGridItem` (CSS grid).
- Read theme tokens through `useAppTheme`, not `@mui/material/styles`.
  Reading a token is not styling — a chart consuming
  `theme.palette.chart.colors` is consuming data.
- A component needing something a primitive cannot express means the
  primitive is missing a prop. Add it in `src/components/ui/`, not locally.

A domain component starts beside the page that uses it and moves to
`src/components/` when a second page needs it. That is a file move, not a
change of category — the rules are the same in both places.

Grow the design system on demand: a prop is added when a screen already
needs it, never in anticipation. Shape and spacing values come from
`src/theme/tokens.ts`.

### The migration ratchet

`eslint-ds-baseline.json` lists the files still allowed to break these
rules. New files are bound by the rules immediately, so the debt cannot
grow; listed files leave the list as they are migrated. `npm run lint:ds`
fails if the list grows, keeps a file that no longer violates anything, or
names a file that no longer exists. Both checks run in `pre-commit`.

## Verification

From `frontend/`, run:

```bash
npm run lint      # ESLint, incluindo a fronteira do design system
npm run lint:ds   # ratchet: a dívida do design system só encolhe
npm test          # vitest
npm run knip      # arquivos, exports e dependências sem uso
npm run build     # tsc + vite build
npm run e2e       # regressão visual (Playwright)
```

Todos rodam no `pre-commit` — os quatro primeiros a cada commit, `build` e
`e2e` no push. ESLint não reporta erros; as 12 warnings restantes são
`react-hooks/exhaustive-deps` e ficam de propósito: mexer no array de
dependências sem ler o efeito é como se cria loop de render.

`knip` bloqueia em arquivo e dependência sem uso, que é a categoria que
importa contra o viés aditivo de um agente. Export e tipo sem uso ainda
são só reportados: tirar o `export` de um símbolo é seguro, mas apagá-lo
exige julgamento caso a caso. O critério por categoria fica em
`knip.jsonc`.

## Regressão visual

`e2e/` guarda os snapshots de referência, e eles são versionados — são a
linha de base. A API nunca é chamada: `VITE_API_URL` aponta para uma origem
inexistente e o fixture em `e2e/fixtures/app.ts` intercepta tudo, então o
teste não depende do backend nem dos dados de ontem.

Depois de uma mudança visual **intencional**, regenere e confira a imagem
antes de commitar:

```bash
npm run e2e:update
```

Duas armadilhas que já custaram caro aqui, ambas do tipo que passa verde
sem cobrir nada:

- Os layouts ocupam `100vh` e rolam por dentro, então `fullPage: true` não
  captura além da viewport. Os testes usam viewport alta e chamam
  `expectNothingClipped`, que falha quando o conteúdo cresce além dela.
- Os limites de diferença precisaram sair do padrão. Com
  `maxDiffPixelRatio: 0.01` e `threshold: 0.2`, trocar `radius.md` de 8px
  para 14px passava despercebido. Ver o comentário em
  `playwright.config.ts` antes de afrouxá-los.

O browser vem de `npx playwright install chromium`. Em ambiente onde ele é
provisionado por fora, `PLAYWRIGHT_CHROMIUM_PATH` aponta para o binário.

Precisa ser a build que o `@playwright/test` do projeto pede, e não outra
qualquer: build diferente de Chromium desenha texto com métrica diferente, e
a comparação sai com ~2% dos pixels vermelhos em toda tela que tenha letra —
sem que nada no código tenha mudado. O sintoma é característico: as caixas
casam, só os glifos aparecem duplicados e deslocados. Nesse caso os
snapshots versionados não valem nada ali, e regenerá-los quebra a
comparação na máquina de quem os gerou. O caminho é comparar antes/depois
dentro do mesmo ambiente e deixar a linha de base como está.

### Ao migrar uma tela para o design system

A ordem importa, e é fácil errar: **o snapshot vem antes da migração.**

1. Escreva o teste e gere a referência com a tela ainda no MUI.
2. Migre.
3. Rode `npm run e2e`. Passar é a prova de que a migração não mexeu no
   visual; falhar aponta exatamente onde mexeu.

Gerar o snapshot depois de migrar só congela o resultado, seja ele qual
for — o teste passa e não prova nada. Se isso acontecer, dá para recuperar:
guarde a migração (`git stash`), gere a referência, restaure e rode.
