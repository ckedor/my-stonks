# My Stonks

These instructions apply to the entire repository. More specific instructions
exist in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.

## Before changing code

- Read `docs/architecture/overview.md` for domain and system context.
- Inspect the neighboring implementation before proposing a new pattern.
- Treat documented domain terms and boundaries as requirements.
- Do not invent product rules, validations, availability checks, or abstractions.
  Ask when a decision is not supported by the request, documentation, or code.
- Existing code is evidence of current behavior, not proof that the behavior is
  architecturally correct.

## Repository-wide rules

- Keep domain vocabulary consistent across backend and frontend contracts.
- Keep provider details, such as Brapi, outside the core domain vocabulary.
- Prefer small changes that preserve existing behavior unless a behavior change
  was explicitly requested.
- Update architecture documentation when a change alters a system boundary,
  domain term, or main data flow.
- Before finishing, run the relevant checks for every changed application.

## Main applications

- `backend/`: FastAPI, application services, persistence, integrations, and
  background jobs.
- `frontend/`: React application and API clients.
- `docs/domain.md`: canonical language shared by backend and frontend.
- `docs/architecture/`: system architecture and main-flow context.

## Domain language

Before introducing or renaming domain entities, read
`docs/domain.md`.

Use the canonical terms defined there in:

- class and function names;
- API routes and schemas;
- database entities;
- tests and documentation.

Do not introduce synonyms for established domain concepts.

## Keeping the documentation true

Documentation that describes something no longer there is worse than none: it is
read as current and copied. Treat these as part of the change, not follow-up.

- **`docs/architecture/overview.md`** — update in the same commit when a change
  moves a system boundary, a main data flow, a persistence rule, or the path of
  something the document names. It cites concrete routes and file paths; if you
  move or delete one, the mention moves or goes with it.
- **`docs/domain.md`** — update when a domain concept is added, renamed, split,
  or dropped. A term that lives only in code is not canonical yet.
- **`backend/CLAUDE.md` and `frontend/CLAUDE.md`** — update when a rule they
  state stops holding, or when a new rule starts being enforced.
- **`frontend/src/pages/admin/architecture/graph/architecture-map.ts`** — the
  visual map is documentation too. Same trigger as the overview.

Two things make staleness cheap to catch, and both already exist:

- `task architecture` fails when the layering the overview describes is broken;
- `tests/contract/openapi.json` fails when the published API changes, so a route
  the documentation names cannot disappear unnoticed.

When a document and the code disagree, say so instead of picking one silently.
The document may be the intended direction and the code the drift.
