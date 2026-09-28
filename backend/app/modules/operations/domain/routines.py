"""Every routine that moves data in or keeps it consistent, in one list.

A routine is what a person thinks of as one job — "the quotes", "the fund
registry" — which is not always one task: the quotes are a selection task that
chains into an ingestion task, and the consolidation fans out into a task per
portfolio. So a routine names its tasks, the scheduler entries that start it,
and how it is started by hand.

Two guards keep this list whole, and both are tests: every scheduler entry
belongs to exactly one routine, and so does every task the worker registers.
A job added without a line here fails the build instead of running unseen.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class RoutineKey(StrEnum):
    QUOTES = 'quotes'
    MARKET_SERIES = 'market_series'
    USD_BRL = 'usd_brl'
    FUND_SHARE_VALUES = 'fund_share_values'
    ETF_HOLDINGS = 'etf_holdings'
    FUND_REGISTRY = 'fund_registry'
    ETF_REGISTRY = 'etf_registry'
    ASSET_CATALOGUE = 'asset_catalogue'
    COMPANY_REGISTRY = 'company_registry'
    FUND_LINKS = 'fund_links'
    PORTFOLIO_CONSOLIDATION = 'portfolio_consolidation'
    FII_DIVIDENDS = 'fii_dividends'
    AI_FEATURES = 'ai_features'
    EXECUTION_HISTORY = 'execution_history'


class RoutineGroup(StrEnum):
    MARKET_DATA = 'market_data'
    REFERENCE_DATA = 'reference_data'
    PORTFOLIOS = 'portfolios'
    AI = 'ai'
    MAINTENANCE = 'maintenance'


class ManualStart(StrEnum):
    """How a person starts the routine."""

    #: The operations screen sends its task.
    TASK = 'task'
    #: Through its data-ingestion route, which opens an execution first.
    INGESTION = 'ingestion'
    #: On its own screen, which shows what would change before writing it.
    SCREEN = 'screen'


@dataclass(frozen=True)
class Routine:
    key: RoutineKey
    name: str
    group: RoutineGroup
    description: str
    manual: ManualStart
    #: The worker tasks that are this routine; the first is the one a schedule
    #: or a person starts, the rest are what it chains into.
    tasks: tuple[str, ...] = ()
    schedule_entries: tuple[str, ...] = ()
    #: Its data-ingestion type, when it keeps executions with items.
    ingestion_type: str | None = None

    @property
    def entry_task(self) -> str | None:
        return self.tasks[0] if self.tasks else None


ROUTINES: tuple[Routine, ...] = (
    Routine(
        key=RoutineKey.QUOTES,
        name='Cotações',
        group=RoutineGroup.MARKET_DATA,
        description=(
            'Preços diários dos ativos em carteira e dos ETFs de referência, '
            'do provedor de mercado.'
        ),
        manual=ManualStart.INGESTION,
        tasks=(
            'ingest_quotes_for_held_assets',
            'ingest_quotes_for_reference_etfs',
            'ingest_quotes',
        ),
        schedule_entries=('ingest-quotes-for-held-assets', 'ingest-quotes-for-reference-etfs'),
        ingestion_type='quote',
    ),
    Routine(
        key=RoutineKey.MARKET_SERIES,
        name='Séries de mercado',
        group=RoutineGroup.MARKET_DATA,
        description='Os índices e as taxas de referência cadastrados como séries de mercado.',
        manual=ManualStart.INGESTION,
        tasks=('ingest_market_data_series',),
        schedule_entries=('ingest-market-data-series',),
        ingestion_type='market_data_series',
    ),
    Routine(
        key=RoutineKey.USD_BRL,
        name='Dólar (USD/BRL)',
        group=RoutineGroup.MARKET_DATA,
        description='A cotação do dólar que converte posições, proventos e retornos.',
        manual=ManualStart.INGESTION,
        tasks=('ingest_usd_brl',),
        schedule_entries=('ingest-usd-brl',),
        ingestion_type='usd_brl',
    ),
    Routine(
        key=RoutineKey.FUND_SHARE_VALUES,
        name='Valores de cota (CVM)',
        group=RoutineGroup.MARKET_DATA,
        description=(
            'O valor da cota dos fundos em carteira que não negociam em bolsa, '
            'lido dos informes da CVM.'
        ),
        manual=ManualStart.INGESTION,
        tasks=('ingest_fund_share_values_for_held_funds', 'ingest_fund_share_values'),
        schedule_entries=('ingest-fund-share-values-for-held-funds',),
        ingestion_type='fund_share_value',
    ),
    Routine(
        key=RoutineKey.ETF_HOLDINGS,
        name='Carteira dos ETFs',
        group=RoutineGroup.MARKET_DATA,
        description=(
            'O que cada ETF americano em carteira possui, posição por posição, '
            'do último N-PORT publicado na SEC.'
        ),
        manual=ManualStart.INGESTION,
        tasks=('ingest_etf_holdings_for_held_etfs', 'ingest_etf_holdings'),
        schedule_entries=('ingest-etf-holdings-for-held-etfs',),
        ingestion_type='etf_holdings',
    ),
    Routine(
        key=RoutineKey.FUND_REGISTRY,
        name='Cadastro de fundos (CVM)',
        group=RoutineGroup.REFERENCE_DATA,
        description='Fundos, classes, subclasses e condições registrados na CVM.',
        manual=ManualStart.INGESTION,
        tasks=('ingest_fund_registry',),
        schedule_entries=('ingest-fund-registry',),
        ingestion_type='fund_registry',
    ),
    Routine(
        key=RoutineKey.ETF_REGISTRY,
        name='Cadastro de ETFs estrangeiros',
        group=RoutineGroup.REFERENCE_DATA,
        description=(
            'ETFs americanos (SEC) e UCITS (ESMA, GLEIF) com gestora e classes, '
            'e o vínculo de cada ETF do cadastro de ativos à sua classe.'
        ),
        manual=ManualStart.INGESTION,
        tasks=('ingest_etf_registry',),
        schedule_entries=('ingest-etf-registry',),
        ingestion_type='etf_registry',
    ),
    Routine(
        key=RoutineKey.ASSET_CATALOGUE,
        name='Catálogo de ativos',
        group=RoutineGroup.REFERENCE_DATA,
        description=(
            'Cadastra o universo negociável do provedor e corrige nomes e logos. '
            'Mostra o que mudaria antes de aplicar.'
        ),
        manual=ManualStart.SCREEN,
    ),
    Routine(
        key=RoutineKey.COMPANY_REGISTRY,
        name='Companhias e emissores (CVM)',
        group=RoutineGroup.REFERENCE_DATA,
        description=(
            'Liga cada ação à companhia que a emitiu, com CNPJ, bolsa e espécie. '
            'Mostra o que mudaria antes de aplicar.'
        ),
        manual=ManualStart.SCREEN,
    ),
    Routine(
        key=RoutineKey.FUND_LINKS,
        name='Vínculo de FIIs e ETFs brasileiros',
        group=RoutineGroup.REFERENCE_DATA,
        description='Liga cada FII e ETF brasileiro ao fundo que o regulador registrou.',
        manual=ManualStart.SCREEN,
    ),
    Routine(
        key=RoutineKey.PORTFOLIO_CONSOLIDATION,
        name='Consolidação das carteiras',
        group=RoutineGroup.PORTFOLIOS,
        description=(
            'Recalcula posições e retornos de cada carteira a partir das cotações '
            'guardadas; uma tarefa por carteira.'
        ),
        manual=ManualStart.TASK,
        tasks=(
            'consolidate_all_portfolios',
            'consolidate_portfolio',
            'consolidate_portfolio_returns',
            'recalculate_asset_position',
            'recalculate_positions_for_assets',
        ),
        schedule_entries=('consolidate-portfolios',),
    ),
    Routine(
        key=RoutineKey.FII_DIVIDENDS,
        name='Proventos de FII',
        group=RoutineGroup.PORTFOLIOS,
        description='Registra os proventos que os FIIs em carteira pagaram.',
        manual=ManualStart.TASK,
        tasks=('consolidate_fiis_dividends',),
        schedule_entries=('consolidate-fiis-dividends',),
    ),
    Routine(
        key=RoutineKey.AI_FEATURES,
        name='Funcionalidades de IA',
        group=RoutineGroup.AI,
        description='Gerações de IA disparadas pela tela de cada funcionalidade.',
        manual=ManualStart.SCREEN,
        tasks=('run_ai_feature',),
    ),
    Routine(
        key=RoutineKey.EXECUTION_HISTORY,
        name='Limpeza do histórico de execuções',
        group=RoutineGroup.MAINTENANCE,
        description=(
            'Encerra execuções que travaram e apaga as antigas: as de ingestão '
            'depois de 2 dias, o registro de tarefas depois de 45.'
        ),
        manual=ManualStart.TASK,
        tasks=('maintain_data_ingestion_history', 'maintain_task_run_history'),
        schedule_entries=('maintain-data-ingestion-history', 'maintain-task-run-history'),
    ),
)

ROUTINES_BY_KEY = {routine.key: routine for routine in ROUTINES}
ROUTINE_BY_TASK = {task: routine for routine in ROUTINES for task in routine.tasks}
