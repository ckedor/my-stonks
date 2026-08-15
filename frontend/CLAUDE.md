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
npm run lint
npm run lint:ds
npm run build
```

`npm run lint` currently reports 6 pre-existing errors and 27 warnings that
predate the design system work. They are not blocking: `pre-commit` runs
ESLint only on staged files, so each one is cleaned when someone touches
that file.
