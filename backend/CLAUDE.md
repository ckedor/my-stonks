# Backend guidelines

These instructions extend the repository-level `CLAUDE.md` for files under
`backend/`.

## Layer boundaries

Use this dependency direction:

`HTTP/task entrypoint -> service -> repository -> database`

Provider calls use adapters/integrations behind the service layer.

- Routers handle HTTP concerns, dependencies, request parsing, and response
  mapping. They call services.
- Routers must not instantiate repositories or call `commit`, `rollback`, or
  `flush`.
- Services coordinate business rules, repositories, providers, and transaction
  boundaries.
- Repositories contain persistence queries and do not own business workflows.
- Tasks and schedulers are entrypoints. Keep their orchestration small and
  delegate business behavior to services.
- Do not inspect workers or add task-availability preflight checks unless that
  behavior is explicitly requested and documented.

## Persistence and transactions

- Treat `AsyncSession` as an infrastructure detail. Do not pass it to routes,
  services, domain code, or Celery tasks.
- `UnitOfWork` is the only persistence entry point for application services.
  A service that touches the database takes `uow: UnitOfWork` and nothing else
  for persistence. Never inject a repository into a service.
- Every persistence access opens the scope explicitly:

      async with self.uow as uow:
          ...uow.portfolios / uow.assets / uow.quotes / ...

- Reads open the scope and leave. They do not commit.
- Writes call `await uow.commit()` before leaving the scope. Anything not
  committed is rolled back on exit, so a missing commit silently discards the
  write.
- A read that is part of a write use case uses the same scope and the same
  `uow.<repository>`.
- One scope per use case, not one per repository call. Do not nest
  `async with self.uow`: a `UnitOfWork` cannot be entered twice. Two services
  used together need two `UnitOfWork` instances (see `composition/`).
- Services needing several independent transactions (concurrent ingestion
  fan-out) take `uow_factory: Callable[[], UnitOfWork]` instead. This is the
  only exception, and it exists because one instance cannot be entered
  concurrently.
- Routers never import `UnitOfWork` or a repository. They depend on a provider
  from `composition/`, which is what the `api-boundary` import contract
  enforces.
- Keep SQLAlchemy calls inside `infra/db/`, repositories, and the UoW.
  Any exception must be explicitly justified.
- Domain entities using imperative mapping remain in their module's `domain/`.
  Their SQLAlchemy `Table` definitions and mappings belong in `infra/db/tables/`
  and `infra/db/mappings/` respectively.
- Preserve the existing names `service`, `repository`, `domain`,
  `adapter/provider`, and `infra`. Do not add `use_case`, `application`,
  command/query handler layers, or `UseCase` classes.

## Service state

- Application services are stateless after construction.
- Assign instance attributes only in `__init__`. Do not add, replace, delete,
  or increment `self.*` attributes inside business methods.
- Dependencies assigned in `__init__` are immutable service state. Do not
  dynamically reconfigure a service for the current request or transaction.
- Repositories and other resources obtained from a `UnitOfWork` remain local
  variables inside its `async with` block.
- Services created for a UoW-scoped operation remain local variables. Never
  assign them to the parent service instance.
- Application services do not construct other application services. Inject
  collaborating services through `__init__`; assemble them in `composition/`.
- Prefer local variables over convenience attributes for request, execution,
  transaction, and current-entity state.

## HTTP router style

- Instantiate services in a named `service` variable before calling
  their methods. Do not instantiate and invoke a service in the same expression.

## Cached reads and their invalidation

- The service that commits a write drops the cached reads that write makes
  stale, at the end of its own transaction. A caller that only dispatched a
  task has not waited for the write, so invalidating from there empties the
  cache before the new rows exist and the next read refills it with the old
  ones.
- A caller may drop what it awaited. Deleting an entity is the exception: there
  is no consolidation behind it, so the caller drops everything for it.
- Never write a decorator-produced cache key by hand. Invalidate by prefix,
  from the same constant the `@cached` call uses.
- Treat the cache as optional: an unreachable Redis makes a read slow, not
  failed.

## Market data

- Asset quotes and their scalar prices are central domain data. Brapi and other external sources are
  providers, not domain concepts.
- Keep quote reads separate from quote-ingestion commands. Execution status
  reads belong to the ingestion/operations capability.
- Scheduled and manual ingestion should reuse the same service operation
  whenever their business behavior is the same.
- Use the distinctions between `price`, `quote`, and related concepts defined in
  `docs/domain.md`.

## Verificação

Rode o teste mais próximo do que mudou, e `ruff check` nos arquivos tocados.
A suíte inteira é dos hooks do `.pre-commit-config.yaml`:

```bash
poetry run task lint
poetry run pytest
```

Fora da máquina do mantenedor — sessão remota, agente — pare no teste
próximo e no ruff. `pytest` inteiro e `task architecture` só quando pedidos,
ou quando a mudança mexe numa fronteira que eles cobrem: rota publicada
(o snapshot do OpenAPI), camada, ou mapeamento de persistência.
