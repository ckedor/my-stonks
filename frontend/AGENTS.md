# Frontend guidelines

These instructions extend the repository-level `AGENTS.md` for files under
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

## Verification

From `frontend/`, run:

```bash
npm run lint
npm run build
```
