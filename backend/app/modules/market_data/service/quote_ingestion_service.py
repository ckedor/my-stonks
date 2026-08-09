from collections.abc import Sequence

from app.config.logger import logger
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.service.data_ingestion_service import (
    DataIngestionReadService,
    DataIngestionService,
)
from app.modules.market_data.service.quote_service import QuoteService


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
    """Ingests quotes for the assets it is given.

    Choosing *which* assets is not a market-data concern: whoever knows why an
    asset matters passes the ids in. See
    ``app.modules.portfolio.tasks.ingest_quotes_for_held_assets`` for the
    scheduled caller that selects held assets.
    """

    def __init__(
        self,
        *,
        ingestion_service: DataIngestionService,
        quote_service: QuoteService,
    ):
        self.ingestion_service = ingestion_service
        self.quote_service = quote_service

    async def run(
        self,
        *,
        asset_ids: Sequence[int] | None = None,
        execution_id: int | None = None,
        force_full_history: bool = False,
        selection_parameters: dict | None = None,
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
            # Ids stored on the execution win: a manual run picked them explicitly.
            if requested_ids:
                resolved_ids = list(requested_ids)
                resolved_selection = {'selection': 'explicit_asset_ids'}
            else:
                resolved_ids = list(asset_ids or [])
                resolved_selection = selection_parameters or {'selection': 'caller_supplied'}
            parameters = {
                'force_full_history': force_full_history,
                'item_ids': resolved_ids,
                **resolved_selection,
            }
            await self.ingestion_service.set_execution_items(
                current_execution_id,
                item_ids=resolved_ids,
                parameters=parameters,
            )
            if resolved_ids:
                await self.quote_service.ingest_quotes(
                    asset_ids=resolved_ids,
                    force_full_history=force_full_history,
                    execution_id=current_execution_id,
                )
            await self.ingestion_service.finish(current_execution_id)
            return current_execution_id
        except Exception as exc:
            logger.exception('Quote ingestion failed')
            await self.ingestion_service.fail(current_execution_id, exc)
            raise
