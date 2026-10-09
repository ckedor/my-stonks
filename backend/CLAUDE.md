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
- A migration that writes rows, and a database restore, change data behind
  the services that invalidate. Both are followed by `python manage.py
  drop_cache` (`start_web.sh` after `alembic upgrade head`, and
  `restore_db.py`), which drops every `cache:*` key and only those.

## Consolidated portfolio reads

- Every persisted return series lives in `portfolio.return_series`, told apart
  by `scope` and `scope_key`. Do not add a table per altitude: the portfolio,
  a category, an asset type and a segment are the same arithmetic over
  different groupings.
- `scope_key` cannot be a foreign key, so a delete that removes a category or a
  portfolio removes its series explicitly.
- Consolidating a portfolio is one run that fills every scope and then stamps
  `portfolio.portfolio_consolidation`. One stamp per portfolio, not per series.
- A read of a consolidated table is a select. Do not put a cache in front of
  one — that is caching a cache, and it puts back an invalidation to keep
  honest.

## Acesso à carteira

- Toda rota que recebe o id de uma carteira, ou de uma linha dela (transação,
  provento, categoria), passa por `PortfolioBaseService.ensure_owner` antes de
  ler ou escrever. A regra mora lá; `modules/portfolio/api/access.py` só a liga
  ao request:
  - `portfolio_id: OwnedPortfolioId` no lugar de `portfolio_id: int` quando o
    id vem no path ou na query (`OwnedFormPortfolioId` num form);
  - `guard: PortfolioGuard` quando o id vem no corpo ou é de uma linha: a rota
    chama `await guard(portfolios=[...], transactions=[...])` com tudo em que
    vai mexer, antes do service.
- Uma linha é seguida até a carteira dela, nunca confiada à carteira que o
  request diz. Mandar a própria carteira com a transação de outro é o jeito de
  contornar uma checagem só da carteira.
- Ausente e alheia respondem o mesmo 404. Admin não tem passe: as rotas
  administrativas que agem sobre qualquer carteira (`position_consolidator`,
  `/portfolio/all`) são de superusuário e não passam pela checagem.
- `tests/e2e/test_portfolio_isolation.py` manda toda rota sob `/portfolio`
  como outro usuário e falha na que responder. Uma rota nova com corpo
  obrigatório precisa de um caso em `_bodies`; uma que só age sobre o que é do
  próprio usuário, por `user.id`, entra em `OWN_DATA_ROUTES`.

## IA

- Toda chamada a um provedor passa por `app/infra/ai/`, e o registro em
  `ai.ai_run` acontece lá, na fronteira — não no service da feature. Um
  chamador novo não precisa lembrar de se instrumentar, e nada gasta a chave
  sem deixar linha. O teto de gasto é checado na mesma camada, antes da
  chamada.
- **Artefato de IA não passa por Redis.** A tabela de artefatos é o cache:
  a leitura é um select por (feature, versão do prompt, entrada). Cache na
  frente seria cachear um cache, e deveria uma invalidação para manter
  honesta — a mesma razão pela qual leitura consolidada não tem cache.
- A versão do prompt faz parte da identidade do artefato. Não invalide
  artefato por job ao trocar de prompt: a chave única já faz isso.
- O schema de saída de uma feature mora em código (`domain/outputs.py`); só o
  texto do prompt mora no banco. Salvar uma versão de prompt valida os
  placeholders contra as `context_keys` do handler — um prompt que quebraria
  na geração não pode ser gravado.
- Número que uma feature afirma vem da aplicação, calculado antes da chamada e
  entregue pronto ao prompt. O modelo escreve a prosa; ele não mede.
- Uma feature nova é um handler mais uma linha no registro. Ela não pede rota,
  task nem tela de admin: a execução genérica e o formulário montado do JSON
  Schema do input já a atendem.

## Imposto de renda

- A apuração é do usuário, sobre todas as carteiras dele — nunca de uma
  carteira. O cálculo mora em `modules/portfolio/domain/income_tax/`, puro e
  em `Decimal`; o service só lê os fatos e entrega ao motor. Nenhuma aba ou
  rota refaz conta por conta própria.
- Regra fiscal é versão do catálogo em `income_tax/rules.py`, com vigência,
  fonte e data de conferência, escolhida pela data da venda. Mudança de lei é
  fechar uma versão e abrir outra no primeiro dia de um mês;
  `validate_catalogue` recusa sobreposição e mudança no meio do mês, e o teste
  do catálogo roda ela. O exterior (Lei 14.754/2023) é anual e tem o próprio
  catálogo no mesmo arquivo, `FOREIGN_RULES`, com versões que mudam só em 1º de
  janeiro; `validate_foreign_catalogue` é o equivalente.
- Falta de dado vira pendência com a premissa usada, nunca zero nem isenção em
  silêncio. Pagamento de DARF é registrado pela pessoa, nunca inferido.

## Market data

- Asset quotes and their scalar prices are central domain data. Brapi and other external sources are
  providers, not domain concepts.
- Keep quote reads separate from quote-ingestion commands. Execution status
  reads belong to the ingestion/operations capability.
- Scheduled and manual ingestion should reuse the same service operation
  whenever their business behavior is the same.
- Use the distinctions between `price`, `quote`, and related concepts defined in
  `docs/domain.md`.
- A file-based ingestion skips a file by **coverage**, never by a `304` alone:
  validators say the body did not change, not that this asset, selection and
  purchase date were applied from it. Coverage commits in the same transaction
  as the rows it vouches for, and a failure writes none
  (`tests/e2e/test_fund_share_value_ingestion.py` proves both).
- Regulator file layouts are checked against the file headers, not the
  published dictionaries: the FIDC dictionary still names a column the files
  dropped in 2023. A missing column fails the file.
- Reapplying a share-value snapshot also reconciles withdrawals, scoped to
  its source, asset and period; removals commit with replacements and coverage.
  Validate headers even for empty members before treating them as snapshots.
- Fund revision checkpoints are per asset, selection version and purchase
  boundary. A partial selection cannot satisfy another fund's weekly revision.
- Registering a fund is available to authenticated users from a purchase and
  reuses an existing priced unit. FIDCs require a confirmed series. Changes to
  existing series/aliases and ingestion operations remain admin-only.

## Documentos da carteira

- Todo PDF enviado à carteira passa por `PortfolioDocumentService.store`
  antes do modelo. Um upload novo da carteira entra pelo mesmo caminho, com o
  seu `DocumentKind` — e a check constraint `ck_document_kind` muda junto.
- Os bytes vão para o storage (`app/infra/storage/`), nunca para o banco. A
  chave sai do conteúdo; não troque por id, ou um envio que falhou entre o
  bucket e o banco passa a deixar objeto órfão.
- Sem bucket configurado, guardar devolve `None` e a leitura segue. Com
  bucket, falhar em guardar falha o envio — não engula o erro.

## Operations

- A job the worker runs belongs to a routine in
  `app/modules/operations/domain/routines.py`: a new scheduler entry or a new
  task goes there in the same change, or
  `tests/modules/operations/test_routines_and_schedule.py` fails. The routine
  is what the admin's integrations dashboard lists.
- Tasks do not record their own runs. `celery_async_task` writes
  `operations.task_run` around every task; a task that also kept a run table
  of its own would be two records to keep in agreement.
- Times live in `beat_schedule` only. The dashboard derives "toda terça às
  09:00" and the next runs from the same entry, in `WORKER_TIMEZONE`; never
  write a schedule a second time in the frontend or in a description.
- No module imports `app.modules.operations`; it watches the others.

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
