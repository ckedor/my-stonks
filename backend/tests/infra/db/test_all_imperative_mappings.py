from dataclasses import is_dataclass

from sqlalchemy import inspect

from app.infra.db.base import Base
from app.infra.db.bootstrap import start_mappers
from app.modules.ai.domain.entities import (
    AIArtifact,
    AIFeature,
    AIPromptVersion,
    AIRun,
)
from app.modules.lab.domain.entities import TheoreticalPortfolio, TheoreticalPosition
from app.modules.market_data.domain import assets as asset_entities
from app.modules.market_data.domain import etf_registry, fund_registry, fund_share_value
from app.modules.market_data.domain.asset_visit import AssetVisit
from app.modules.market_data.domain.ingestion import (
    DataIngestionAttempt,
    DataIngestionExecution,
)
from app.modules.market_data.domain.market_data_series import (
    MarketDataSeries,
    MarketDataSeriesHistory,
)
from app.modules.market_data.domain.quote import Quote
from app.modules.market_data.domain.usd_brl import UsdBrlHistory
from app.modules.operations.domain.task_run import TaskRun
from app.modules.portfolio.domain import entities as portfolio_entities
from app.modules.portfolio.domain.income_tax.darf import DarfPayment
from app.modules.research.domain.entities import (
    RecommendedPortfolio,
    RecommendedPortfolioType,
    RecommendedPosition,
    ResearchSource,
)
from app.modules.users.domain import User

PERSISTED_ENTITIES = [
    asset_entities.Exchange,
    asset_entities.Institution,
    asset_entities.AssetClass,
    asset_entities.AssetType,
    asset_entities.Currency,
    asset_entities.Event,
    asset_entities.Asset,
    asset_entities.Stock,
    asset_entities.ETFSegment,
    asset_entities.ETF,
    asset_entities.FIIType,
    asset_entities.FIISegment,
    asset_entities.FII,
    asset_entities.FixedIncomeType,
    asset_entities.FixedIncome,
    asset_entities.InvestmentFund,
    fund_registry.FundRegistry,
    fund_registry.FundRegistryClass,
    fund_registry.FundRegistrySubclass,
    fund_registry.FundShareSeries,
    fund_registry.FundShareSeriesAlias,
    etf_registry.EtfRegistry,
    etf_registry.EtfRegistryManager,
    etf_registry.EtfRegistryClass,
    etf_registry.EtfHoldingReport,
    etf_registry.EtfHolding,
    fund_share_value.SourceFile,
    fund_share_value.FundShareValueCoverage,
    fund_share_value.IngestionCheckpoint,
    asset_entities.TreasuryBondType,
    asset_entities.TreasuryBond,
    asset_entities.Broker,
    portfolio_entities.Portfolio,
    portfolio_entities.Position,
    portfolio_entities.Transaction,
    portfolio_entities.Dividend,
    portfolio_entities.Return12M,
    portfolio_entities.CustomCategory,
    portfolio_entities.CustomCategoryAssignment,
    portfolio_entities.PortfolioUserConfiguration,
    portfolio_entities.ReturnSeries,
    portfolio_entities.PortfolioConsolidation,
    portfolio_entities.ConfigurationName,
    portfolio_entities.BrokerageNote,
    portfolio_entities.PortfolioDocument,
    DarfPayment,
    User,
    MarketDataSeries,
    MarketDataSeriesHistory,
    UsdBrlHistory,
    AssetVisit,
    Quote,
    DataIngestionExecution,
    DataIngestionAttempt,
    ResearchSource,
    RecommendedPortfolio,
    RecommendedPortfolioType,
    RecommendedPosition,
    TheoreticalPortfolio,
    TheoreticalPosition,
    AIFeature,
    AIPromptVersion,
    AIArtifact,
    AIRun,
    TaskRun,
]
EXPECTED_PERSISTED_ENTITY_COUNT = 65


def test_every_persisted_entity_is_one_mapped_domain_dataclass():
    start_mappers()

    assert len(PERSISTED_ENTITIES) == len(Base.metadata.tables) == EXPECTED_PERSISTED_ENTITY_COUNT
    for entity in PERSISTED_ENTITIES:
        assert is_dataclass(entity), entity.__name__
        assert inspect(entity).local_table in Base.metadata.tables.values()
        assert Base not in entity.__mro__


def test_mapper_registration_is_idempotent():
    start_mappers()
    start_mappers()
    assert len(Base.registry.mappers) == EXPECTED_PERSISTED_ENTITY_COUNT
