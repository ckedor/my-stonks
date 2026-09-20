from sqlalchemy import inspect

from app.infra.db.base import Base
from app.infra.db.tables.fund_share_value import (
    fund_share_value_coverage_table,
    ingestion_checkpoint_table,
    source_file_table,
)
from app.modules.market_data.domain.fund_share_value import (
    FundShareValueCoverage,
    IngestionCheckpoint,
    SourceFile,
)


def map_fund_share_value() -> None:
    if inspect(SourceFile, raiseerr=False) is not None:
        return

    Base.registry.map_imperatively(SourceFile, source_file_table)
    Base.registry.map_imperatively(FundShareValueCoverage, fund_share_value_coverage_table)
    Base.registry.map_imperatively(IngestionCheckpoint, ingestion_checkpoint_table)
