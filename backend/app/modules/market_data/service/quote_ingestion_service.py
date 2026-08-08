from app.config.logger import logger
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.service.data_ingestion_service import (
    DataIngestionReadService,
    DataIngestionService,
)
from app.modules.market_data.service.quote_service import QuoteService
from app.modules.portfolio.service.portfolio_quote_ingestion_service import (
    PortfolioQuoteIngestionService,
)

SUPPORTED_QUOTE_TYPES = (
    ASSET_TYPE.STOCK,
    ASSET_TYPE.BDR,
    ASSET_TYPE.ETF,
    ASSET_TYPE.REIT,
    ASSET_TYPE.FII,
    ASSET_TYPE.CRIPTO,
)


class QuoteIngestionReadService:
    def __init__(self, service: DataIngestionReadService):
        self.service = service

    async def list_executions(self, *, limit: int):
        return await self.service.list_executions(
            ingestion_type=DataIngestionType.QUOTE,
            limit=limit,
        )

    async def get_execution(self, execution_id: int, *, include_attempts: bool = False):
        return await self.service.get_execution(
            execution_id,
            ingestion_type=DataIngestionType.QUOTE,
            include_attempts=include_attempts,
        )


class QuoteIngestionService:
    def __init__(
        self,
        *,
        ingestion_service: DataIngestionService,
        quote_service: QuoteService,
        portfolio_service: PortfolioQuoteIngestionService,
    ):
        self.ingestion_service = ingestion_service
        self.quote_service = quote_service
        self.portfolio_service = portfolio_service

    async def run(
        self,
        *,
        execution_id: int | None = None,
        force_full_history: bool = False,
    ) -> int | None:
        prepared = await self.ingestion_service.prepare_execution(
            ingestion_type=DataIngestionType.QUOTE,
            execution_id=execution_id,
            force_full_history=force_full_history,
        )
        if prepared is None:
            return execution_id
        current_execution_id, force_full_history, requested_ids = prepared
        try:
            if requested_ids:
                asset_ids = requested_ids
                selection_parameters = {'selection': 'explicit_asset_ids'}
            else:
                selection = await self.portfolio_service.get_assets_requiring_quote_ingestion(
                    full_history=force_full_history,
                    asset_type_ids=[int(value) for value in SUPPORTED_QUOTE_TYPES],
                )
                asset_ids = selection.asset_ids
                selection_parameters = {
                    'position_window_days': selection.position_window_days,
                    'position_reference_date': (
                        selection.position_reference_date.isoformat()
                        if selection.position_reference_date is not None
                        else None
                    ),
                    'selection': selection.description,
                }
            parameters = {
                'force_full_history': force_full_history,
                'item_ids': asset_ids,
                **selection_parameters,
            }
            await self.ingestion_service.set_execution_items(
                current_execution_id,
                item_ids=asset_ids,
                parameters=parameters,
            )
            if asset_ids:
                await self.quote_service.ingest_quotes(
                    asset_ids=asset_ids,
                    force_full_history=force_full_history,
                    execution_id=current_execution_id,
                )
            await self.ingestion_service.finish(current_execution_id)
            return current_execution_id
        except Exception as exc:
            logger.exception('Quote ingestion failed')
            await self.ingestion_service.fail(current_execution_id, exc)
            raise
