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
