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

Fonte é valor de tema, não constante global: as pilhas ficam em `fontStacks`
(`src/theme/tokens.ts`) e cada tema escolhe a do corpo e a dos títulos em
`ThemeShapeConfig`. Nenhum componente escreve nome de fonte. Toda pilha de
`fontStacks` precisa do `@fontsource-variable/*` correspondente importado em
`src/main.tsx` — sem o import ela cai no fallback em silêncio.

### Gramática de tela

Ter todo componente vindo de `@/components/ui` resolve a procedência, não a
coesão: as telas continuavam abrindo cada uma de um jeito. A abertura de uma
tela é decisão do design system, e é uma só:

```
AppPageHeader   rastro › título · (ações) · (descrição) · (métricas)
AppStack gap="lg"
  SectionTitle + conteúdo
```

- **Três níveis de texto, e só três**: `PageTitle` (o nome da tela) →
  `SectionTitle` (um bloco dentro dela) → `SectionLabel` (o assunto de um
  grupo de itens). Nada mais.
- **O título da tela é o rótulo dela em `src/layouts/navigation.ts`.** Se os
  dois discordam, é a tela que está errada.
- **Cor é identidade de série de gráfico.** A cor de uma categoria pinta a
  fatia da pizza, o anel de peso e a legenda colada ao gráfico — nunca um
  título, um cabeçalho de grupo ou uma borda decorativa. O `AppPageHeader`
  não tem prop de cor, e a falta é a regra.

  Numa **linha de tabela ela também não entra**: as colunas de número já
  usam verde e vermelho para sinal, e um ponto verde ao lado de "Bolsa BR"
  faz a linha se contradizer. Foi o que aconteceu no Rebalanceamento, e a
  saída não foi tirar a cor da tela — foi movê-la para as duas pizzas, onde
  ela identifica uma fatia.
- **Métrica é `AppMetric`.** Um rótulo pequeno com um número grande escrito
  à mão dentro de um card é a mesma coisa com outro nome.

A regra em `eslint.config.js` reprova `PageTitle` dentro de
`src/pages/portfolio/**` e `src/pages/market/**` — o caminho é o
`AppPageHeader`. `src/test/eslint-page-header.test.ts` é o que prova que ela
ainda dispara; sem esse teste a regra pode parar de casar em silêncio.

`src/pages/admin/**` ainda está fora da regra, e é dívida declarada: o admin
tem shell e navegação próprios. Quando migrar, o glob vira `src/pages/**`.

### Recorte da carteira

Uma categoria personalizada e um segmento por tipo de ativo são a mesma
tela: só muda como o pedaço é escolhido. Ela é
`src/components/portfolio-slice/PortfolioSliceScreen.tsx`, e as páginas em
`pages/portfolio/segment` e `pages/portfolio/category` só buscam os dados e
a entregam. Aba nova, métrica nova ou dimensão nova entram lá — nunca em
uma das duas páginas, senão elas voltam a divergir.

As abas dela e o grupo "Análise" de `src/layouts/navigation.ts` são a mesma
lista, nos mesmos nomes e na mesma ordem: ler a carteira e ler um pedaço
dela não podem ser dois aprendizados. `src/layouts/navigation.test.ts` é o
que prova que as duas não se separaram.

Quem decide a que segmento uma posição pertence é o backend, que devolve
`segment` junto com ela. `src/constants/portfolioSegments.ts` guarda só o
que é de tela — rótulo, rota, benchmarks, dimensões da concentração — e
nunca a regra de pertencimento.

A espera dela também é uma só: `PortfolioSliceScreenSkeleton`, ao lado da
tela, pelo mesmo motivo.

### Espera de tela

Enquanto o dado não chega, a tela mostra a reserva do que vem — nunca um
disco girando no meio do vazio. O esqueleto diz o que está sendo carregado e
ocupa o espaço final, então nada salta quando o dado chega; o spinner não diz
nem uma coisa nem outra.

- **A peça é `AppSkeleton`**, e a reserva de uma tela inteira é um
  `*Skeleton` ao lado dela (`OverviewSkeleton`, `AssetListSkeleton`,
  `CrudPageSkeleton`). Ele anda junto do que reserva: mudou o desenho da
  tela, muda a reserva no mesmo commit — senão a tela volta a saltar.
- **Três reservas são do design system**, porque a forma é a mesma em toda
  tela: `AppPageHeaderSkeleton` (o cabeçalho), `AppTableSkeleton` (a grade
  de qualquer uma das quatro tabelas) e `AppChartSkeleton` (barra de
  controles + área do gráfico).
- **`LoadingSpinner` é espera em linha de uma ação disparada por alguém** —
  a carteira trocando na barra do topo, o item de menu que recalcula enquanto
  recalcula. Ele não tem mais variante de tela cheia, e a falta é a regra.
  Num botão ele não aparece à mão: `AppButton` tem `loading`, que põe o disco
  no lugar do ícone e **mantém o rótulo** — é o rótulo que diz qual ação está
  correndo. Por isso a regra do ESLint pode reprovar `LoadingSpinner` em
  `src/pages/**` sem tirar o spinner de nenhuma ação: ele mora no controle.

A regra em `eslint.config.js` reprova `LoadingSpinner` em `src/pages/**`,
inclusive no admin. `src/test/eslint-loading-skeleton.test.ts` prova que ela
dispara — e que continua convivendo com a regra do cabeçalho, que divide com
ela o mesmo `no-restricted-syntax`: um bloco de config substitui a lista
inteira do anterior, então os seletores são compostos a partir de constantes.

### The migration ratchet

`eslint-ds-baseline.json` lists the files still allowed to break these
rules. New files are bound by the rules immediately, so the debt cannot
grow; listed files leave the list as they are migrated. `npm run lint:ds`
fails if the list grows, keeps a file that no longer violates anything, or
names a file that no longer exists. Both checks run in `pre-commit`.

A lista está vazia: nenhum arquivo viola mais. O bloco legado no fim de
`eslint.config.js` já não produz nenhuma isenção — ele some junto com o
arquivo de baseline quando o mantenedor decidir que a dívida não volta.

## Verificação

A suíte roda nos hooks do `.pre-commit-config.yaml`, e é lá que ela pertence:

```bash
npm run lint      # ESLint, incluindo a fronteira do design system
npm run lint:ds   # ratchet: a dívida do design system só encolhe
npm test          # vitest
npm run knip      # arquivos, exports e dependências sem uso
npm run build     # tsc + vite build
npm run e2e       # regressão visual (Playwright)
```

Os quatro primeiros a cada commit, `build` e `e2e` no push.

**Fora da máquina do mantenedor — sessão remota, agente — rode só
`npx tsc -b --noEmit` e `eslint` nos arquivos tocados.** O resto fica para o
push local. E `npm run e2e` não roda ali de jeito nenhum: ver o aviso sobre a
build do Chromium em **Regressão visual**, logo abaixo. Verificação completa
só quando pedida.

ESLint não reporta erros; as 9 warnings restantes são
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
