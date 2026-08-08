# Débitos técnicos — revisão arquitetural

Inventário para revisar individualmente a arquitetura das rotas e tasks do app.
Marque um item somente depois que sua revisão estiver concluída.

Estado atual: **0/110 rotas** e **0/13 tasks** revisadas.

## Autenticação e usuários

- [ ] `POST /auth/jwt/login` — `login` (FastAPI Users)
- [ ] `POST /auth/jwt/logout` — `logout` (FastAPI Users)
- [ ] `POST /auth/register` — `register` (FastAPI Users)
- [ ] `GET /users/me` — `me` (FastAPI Users)
- [ ] `PATCH /users/me` — `update_me` (FastAPI Users)
- [ ] `GET /users/{id}` — `get_user` (FastAPI Users)
- [ ] `PATCH /users/{id}` — `update_user` (FastAPI Users)
- [ ] `DELETE /users/{id}` — `delete_user` (FastAPI Users)
- [ ] `GET /users` — `app.modules.users.views.list_users`

## AI

- [ ] `GET /ai/asset_overview_and_news` — `get_asset_overview_and_news`
- [ ] `GET /ai/feature` — `list_features`
- [ ] `GET /ai/feature/{feature_id}` — `get_feature`
- [ ] `PATCH /ai/feature/{feature_id}` — `update_feature`

## Market data — índices

- [ ] `GET /market_data/index/currency` — `list_currencies`
- [ ] `GET /market_data/index/time_series` — `get_indexes_time_series`
- [ ] `GET /market_data/index/usd_brl` — `get_usd_brl_history`
- [ ] `POST /market_data/index/consolidate_history` — `consolidate_market_indexes_history`
- [ ] `GET /market_data/index` — `list_indexes`

## Market data — cotações e importações

- [ ] `GET /market_data/quotes/persisted` — `get_persisted_quotes`
- [ ] `GET /market_data/quotes/on-demand` — `get_on_demand_quotes`
- [ ] `GET /market_data/quote_ingestion` — `list_quote_ingestions`
- [ ] `GET /market_data/quote_ingestion/{execution_id}` — `get_quote_ingestion`
- [ ] `POST /market_data/quote_ingestion` — `run_quote_ingestion`
- [ ] `GET /market_data/series` — `list_market_data_series`
- [ ] `POST /market_data/usd-brl/convert` — `convert_usd_brl`
- [ ] `GET /market_data/usd-brl/history` — `get_usd_brl_history`
- [ ] `GET /market_data/ingestions/quote` — `list_quote_ingestions`
- [ ] `GET /market_data/ingestions/quote/{execution_id}` — `get_quote_ingestion`
- [ ] `POST /market_data/ingestions/quote` — `run_quote_ingestion`
- [ ] `GET /market_data/ingestions/market_data_series` — `list_market_data_series_ingestions`
- [ ] `GET /market_data/ingestions/market_data_series/{execution_id}` — `get_market_data_series_ingestion`
- [ ] `POST /market_data/ingestions/market_data_series` — `run_market_data_series_ingestion`
- [ ] `GET /market_data/ingestions/usd_brl` — `list_usd_brl_ingestions`
- [ ] `GET /market_data/ingestions/usd_brl/{execution_id}` — `get_usd_brl_ingestion`
- [ ] `POST /market_data/ingestions/usd_brl` — `run_usd_brl_ingestion`

## Market data — ativos

- [ ] `GET /market_data/asset/type` — `list_asset_types`
- [ ] `POST /market_data/asset/fixed_income` — `create_fixed_income`
- [ ] `GET /market_data/asset/fixed_income/type` — `list_fixed_income_types`
- [ ] `GET /market_data/asset/fii/segment` — `list_fii_segments`
- [ ] `GET /market_data/asset/etf/segment` — `list_etf_segments`
- [ ] `GET /market_data/asset/treasury_bond/type` — `list_treasury_bond_types`
- [ ] `GET /market_data/asset/exchange` — `list_exchanges`
- [ ] `GET /market_data/asset/index` — `list_indexes`
- [ ] `GET /market_data/asset/event` — `list_events`
- [ ] `POST /market_data/asset/event` — `create_event`
- [ ] `PUT /market_data/asset/event/{event_id}` — `update_event`
- [ ] `DELETE /market_data/asset/event/{event_id}` — `delete_event`
- [ ] `GET /market_data/asset` — `list_assets`
- [ ] `POST /market_data/asset` — `create_asset`
- [ ] `GET /market_data/asset/{asset_id}` — `get_asset`
- [ ] `PUT /market_data/asset/{asset_id}` — `update_asset`
- [ ] `DELETE /market_data/asset/{asset_id}` — `delete_asset`

## Market data — corretoras

- [ ] `GET /market_data/broker` — `list_brokers`
- [ ] `GET /market_data/broker/{broker_id}` — `get_broker`
- [ ] `POST /market_data/broker` — `create_broker`
- [ ] `PUT /market_data/broker/{broker_id}` — `update_broker`
- [ ] `DELETE /market_data/broker/{broker_id}` — `delete_broker`

## Portfolio — cadastro

- [ ] `GET /portfolio` — `list_user_portfolios`
- [ ] `POST /portfolio` — `create_portfolio`
- [ ] `PUT /portfolio/{portfolio_id}` — `update_portfolio`
- [ ] `DELETE /portfolio/{portfolio_id}` — `delete_portfolio`

## Portfolio — dividendos

- [ ] `GET /portfolio/dividend` — `list_dividends`
- [ ] `POST /portfolio/dividend` — `create_dividend`
- [ ] `PUT /portfolio/dividend/{dividend_id}` — `update_dividend`
- [ ] `DELETE /portfolio/dividend/{dividend_id}` — `delete_dividend`

## Portfolio — categorias

- [ ] `POST /portfolio/category` — `save_custom_category`
- [ ] `DELETE /portfolio/category/{category_id}` — `delete_custom_category`
- [ ] `POST /portfolio/category/assignment` — `assign_category_to_assets`

## Portfolio — transações

- [ ] `GET /portfolio/transaction` — `list_transactions`
- [ ] `POST /portfolio/transaction` — `create_transaction`
- [ ] `PUT /portfolio/transaction/{transaction_id}` — `update_transaction`
- [ ] `DELETE /portfolio/transaction/{transaction_id}` — `delete_transaction`

## Portfolio — posições e análises

- [ ] `GET /portfolio/position/{portfolio_id}` — `get_portfolio_position`
- [ ] `GET /portfolio/position/{portfolio_id}/returns` — `get_portfolio_returns`
- [ ] `GET /portfolio/position/{portfolio_id}/patrimony_evolution` — `get_patrimony_evolution`
- [ ] `GET /portfolio/position/{portfolio_id}/analysis` — `get_portfolio_analysis`
- [ ] `GET /portfolio/position/{portfolio_id}/category/returns` — `get_category_returns`
- [ ] `GET /portfolio/position/{portfolio_id}/category/{category_id}/analysis` — `get_category_analysis`
- [ ] `GET /portfolio/position/{portfolio_id}/asset/{asset_id}/returns` — `get_asset_returns`
- [ ] `GET /portfolio/position/{portfolio_id}/asset/{asset_id}/details` — `get_asset_details`
- [ ] `GET /portfolio/position/{portfolio_id}/asset/{asset_id}/analysis` — `get_asset_analysis`

## Portfolio — consolidação

- [ ] `POST /portfolio/position_consolidator/{portfolio_id}/consolidate` — `consolidate_portfolio`
- [ ] `POST /portfolio/position_consolidator/{portfolio_id}/recalculate_asset_position` — `consolidate_portfolio_asset`
- [ ] `POST /portfolio/position_consolidator/{portfolio_id}/recalculate_all_position` — `recalculate_all_positions`
- [ ] `POST /portfolio/position_consolidator/{portfolio_id}/consolidate_portfolio_returns` — `consolidate_portfolio_returns`
- [ ] `POST /portfolio/position_consolidator/{portfolio_id}/consolidate_category_returns` — `consolidate_category_returns`

## Portfolio — imposto de renda

- [ ] `GET /portfolio/income_tax/{portfolio_id}/assets_and_rights` — `get_assets_and_rights`
- [ ] `GET /portfolio/income_tax/{portfolio_id}/variable_income/fii_operation` — `get_fiis_operations_tax`
- [ ] `GET /portfolio/income_tax/{portfolio_id}/variable_income/common_operation` — `get_common_operations_tax`
- [ ] `GET /portfolio/income_tax/{portfolio_id}/darf` — `get_darf`

## Portfolio — configurações, relatórios e rebalanceamento

- [ ] `GET /portfolio/user_configuration/{portfolio_id}` — `get_user_configurations`
- [ ] `PUT /portfolio/user_configuration/{portfolio_id}` — `update_user_configuration`
- [ ] `GET /portfolio/report/{portfolio_id}/performance_statement.xlsx` — `get_portfolio_returns`
- [ ] `GET /portfolio/rebalancing/{portfolio_id}` — `get_rebalancing`
- [ ] `PUT /portfolio/rebalancing/{portfolio_id}` — `save_rebalancing_targets`

## Sistema e documentação

- [ ] `GET /hc` — `healthcheck`
- [ ] `GET /docs` — `complete_swagger`
- [ ] `GET /docs/modules` — `module_index`
- [ ] `GET /openapi/users.json` — `users_openapi`
- [ ] `GET /docs/users` — `users_swagger`
- [ ] `GET /openapi/ai.json` — `ai_openapi`
- [ ] `GET /docs/ai` — `ai_swagger`
- [ ] `GET /openapi/market-data.json` — `market_data_openapi`
- [ ] `GET /docs/market-data` — `market_data_swagger`
- [ ] `GET /openapi/portfolio.json` — `portfolio_openapi`
- [ ] `GET /docs/portfolio` — `portfolio_swagger`
- [ ] `GET /openapi/system.json` — `system_openapi`
- [ ] `GET /docs/system` — `system_swagger`
- [ ] `GET|HEAD /openapi.json` — OpenAPI do FastAPI
- [ ] `GET|HEAD /redoc` — ReDoc do FastAPI

## Tasks — market data

- [ ] `ingest_quotes_for_held_assets` — `app.modules.market_data.tasks.ingest_market_data`
- [ ] `ingest_market_data_series` — `app.modules.market_data.tasks.ingest_market_data`
- [ ] `ingest_usd_brl` — `app.modules.market_data.tasks.ingest_market_data`
- [ ] `maintain_data_ingestion_history` — `app.modules.market_data.tasks.ingest_market_data`
- [ ] `consolidate_indexes_history` — `app.modules.market_data.tasks.consolidate_indexes_history`
- [ ] `set_indexes_history_cache` — `app.modules.market_data.tasks.set_indexes_history_cache`

## Tasks — portfolio

- [ ] `consolidate_all_portfolios` — `app.modules.portfolio.tasks.consolidate_all_portfolios`
- [ ] `consolidate_single_portfolio` — `app.modules.portfolio.tasks.consolidate_single_portfolio`
- [ ] `recalculate_asset_position` — `app.modules.portfolio.tasks.recalculate_asset_position`
- [ ] `consolidate_portfolio_returns` — `app.modules.portfolio.tasks.consolidate_portfolio_returns`
- [ ] `consolidate_fiis_dividends` — `app.modules.portfolio.tasks.consolidate_fiis_dividends`
- [ ] `set_patrimony_evolution_cache` — `app.modules.portfolio.tasks.set_patrimony_evolution_cache`
- [ ] `set_portfolio_returns_cache` — `app.modules.portfolio.tasks.set_portfolio_returns_cache`

## Matriz de revisão por rota/task

Cada célula deve ser marcada somente após verificar o critério no item correspondente:

- **Route:** importa apenas schema, service e composition.
- **Session/infra:** não usa diretamente AsyncSession, repository, UoW, Redis ou provider.
- **Service:** chama um service claro, sem lógica de negócio relevante na rota/task.
- **Read/write:** leitura usa repository/cache; escrita usa UoW.
- **Domain:** cálculo ou regra financeira está no domain, não na rota/task ou service.
- **Cross-module:** outro módulo é acessado via service público.
- **ORM:** nenhuma entidade ORM de outro módulo está vazando.
- **Cache:** quando existe, usa cache-aside e invalida somente depois do write/commit.
- **Tests:** existe teste para o comportamento principal.
- **Behavior:** resposta, status e efeitos colaterais permanecem iguais após o refactor.

| Rota/task | Route | Session/infra | Service | Read/write | Domain | Cross-module | ORM | Cache | Tests | Behavior |
|---|---|---|---|---|---|---|---|---|---|---|
| `POST /auth/jwt/login` — `login` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /auth/jwt/logout` — `logout` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /auth/register` — `register` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /users/me` — `me` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PATCH /users/me` — `update_me` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /users/{id}` — `get_user` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PATCH /users/{id}` — `update_user` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /users/{id}` — `delete_user` (FastAPI Users) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /users` — `app.modules.users.views.list_users` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /ai/asset_overview_and_news` — `get_asset_overview_and_news` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /ai/feature` — `list_features` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /ai/feature/{feature_id}` — `get_feature` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PATCH /ai/feature/{feature_id}` — `update_feature` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/index/currency` — `list_currencies` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/index/time_series` — `get_indexes_time_series` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/index/usd_brl` — `get_usd_brl_history` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/index/consolidate_history` — `consolidate_market_indexes_history` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/index` — `list_indexes` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/quotes/persisted` — `get_persisted_quotes` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/quotes/on-demand` — `get_on_demand_quotes` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/quote_ingestion` — `list_quote_ingestions` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/quote_ingestion/{execution_id}` — `get_quote_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/quote_ingestion` — `run_quote_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/series` — `list_market_data_series` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/usd-brl/convert` — `convert_usd_brl` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/usd-brl/history` — `get_usd_brl_history` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/ingestions/quote` — `list_quote_ingestions` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/ingestions/quote/{execution_id}` — `get_quote_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/ingestions/quote` — `run_quote_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/ingestions/market_data_series` — `list_market_data_series_ingestions` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/ingestions/market_data_series/{execution_id}` — `get_market_data_series_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/ingestions/market_data_series` — `run_market_data_series_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/ingestions/usd_brl` — `list_usd_brl_ingestions` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/ingestions/usd_brl/{execution_id}` — `get_usd_brl_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/ingestions/usd_brl` — `run_usd_brl_ingestion` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/type` — `list_asset_types` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/asset/fixed_income` — `create_fixed_income` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/fixed_income/type` — `list_fixed_income_types` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/fii/segment` — `list_fii_segments` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/etf/segment` — `list_etf_segments` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/treasury_bond/type` — `list_treasury_bond_types` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/exchange` — `list_exchanges` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/index` — `list_indexes` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/event` — `list_events` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/asset/event` — `create_event` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /market_data/asset/event/{event_id}` — `update_event` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /market_data/asset/event/{event_id}` — `delete_event` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset` — `list_assets` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/asset` — `create_asset` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/asset/{asset_id}` — `get_asset` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /market_data/asset/{asset_id}` — `update_asset` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /market_data/asset/{asset_id}` — `delete_asset` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/broker` — `list_brokers` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /market_data/broker/{broker_id}` — `get_broker` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /market_data/broker` — `create_broker` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /market_data/broker/{broker_id}` — `update_broker` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /market_data/broker/{broker_id}` — `delete_broker` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio` — `list_user_portfolios` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio` — `create_portfolio` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /portfolio/{portfolio_id}` — `update_portfolio` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /portfolio/{portfolio_id}` — `delete_portfolio` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/dividend` — `list_dividends` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/dividend` — `create_dividend` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /portfolio/dividend/{dividend_id}` — `update_dividend` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /portfolio/dividend/{dividend_id}` — `delete_dividend` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/category` — `save_custom_category` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /portfolio/category/{category_id}` — `delete_custom_category` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/category/assignment` — `assign_category_to_assets` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/transaction` — `list_transactions` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/transaction` — `create_transaction` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /portfolio/transaction/{transaction_id}` — `update_transaction` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `DELETE /portfolio/transaction/{transaction_id}` — `delete_transaction` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}` — `get_portfolio_position` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/returns` — `get_portfolio_returns` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/patrimony_evolution` — `get_patrimony_evolution` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/analysis` — `get_portfolio_analysis` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/category/returns` — `get_category_returns` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/category/{category_id}/analysis` — `get_category_analysis` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/asset/{asset_id}/returns` — `get_asset_returns` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/asset/{asset_id}/details` — `get_asset_details` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/position/{portfolio_id}/asset/{asset_id}/analysis` — `get_asset_analysis` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/position_consolidator/{portfolio_id}/consolidate` — `consolidate_portfolio` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/position_consolidator/{portfolio_id}/recalculate_asset_position` — `consolidate_portfolio_asset` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/position_consolidator/{portfolio_id}/recalculate_all_position` — `recalculate_all_positions` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/position_consolidator/{portfolio_id}/consolidate_portfolio_returns` — `consolidate_portfolio_returns` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `POST /portfolio/position_consolidator/{portfolio_id}/consolidate_category_returns` — `consolidate_category_returns` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/income_tax/{portfolio_id}/assets_and_rights` — `get_assets_and_rights` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/income_tax/{portfolio_id}/variable_income/fii_operation` — `get_fiis_operations_tax` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/income_tax/{portfolio_id}/variable_income/common_operation` — `get_common_operations_tax` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/income_tax/{portfolio_id}/darf` — `get_darf` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/user_configuration/{portfolio_id}` — `get_user_configurations` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /portfolio/user_configuration/{portfolio_id}` — `update_user_configuration` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/report/{portfolio_id}/performance_statement.xlsx` — `get_portfolio_returns` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /portfolio/rebalancing/{portfolio_id}` — `get_rebalancing` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `PUT /portfolio/rebalancing/{portfolio_id}` — `save_rebalancing_targets` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /hc` — `healthcheck` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /docs` — `complete_swagger` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /docs/modules` — `module_index` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /openapi/users.json` — `users_openapi` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /docs/users` — `users_swagger` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /openapi/ai.json` — `ai_openapi` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /docs/ai` — `ai_swagger` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /openapi/market-data.json` — `market_data_openapi` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /docs/market-data` — `market_data_swagger` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /openapi/portfolio.json` — `portfolio_openapi` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /docs/portfolio` — `portfolio_swagger` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /openapi/system.json` — `system_openapi` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET /docs/system` — `system_swagger` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET\|HEAD /openapi.json` — OpenAPI do FastAPI | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `GET\|HEAD /redoc` — ReDoc do FastAPI | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `ingest_quotes_for_held_assets` — `app.modules.market_data.tasks.ingest_market_data` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `ingest_market_data_series` — `app.modules.market_data.tasks.ingest_market_data` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `ingest_usd_brl` — `app.modules.market_data.tasks.ingest_market_data` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `maintain_data_ingestion_history` — `app.modules.market_data.tasks.ingest_market_data` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `consolidate_indexes_history` — `app.modules.market_data.tasks.consolidate_indexes_history` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `set_indexes_history_cache` — `app.modules.market_data.tasks.set_indexes_history_cache` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `consolidate_all_portfolios` — `app.modules.portfolio.tasks.consolidate_all_portfolios` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `consolidate_single_portfolio` — `app.modules.portfolio.tasks.consolidate_single_portfolio` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `recalculate_asset_position` — `app.modules.portfolio.tasks.recalculate_asset_position` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `consolidate_portfolio_returns` — `app.modules.portfolio.tasks.consolidate_portfolio_returns` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `consolidate_fiis_dividends` — `app.modules.portfolio.tasks.consolidate_fiis_dividends` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `set_patrimony_evolution_cache` — `app.modules.portfolio.tasks.set_patrimony_evolution_cache` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `set_portfolio_returns_cache` — `app.modules.portfolio.tasks.set_portfolio_returns_cache` | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
