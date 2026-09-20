from collections.abc import Awaitable, Callable, Iterator
from datetime import UTC, datetime

from app.config.logger import logger
from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.cvm_client import (
    PROVIDER,
    REGISTRY_PATH,
    TERMS_PATH,
    CvmClient,
    DownloadedFile,
    NotModified,
)
from app.modules.market_data.adapters.fund_filings import (
    iter_class_batches,
    iter_fund_batches,
    iter_subclass_batches,
    iter_terms_batches,
    iterate_off_loop,
)
from app.modules.market_data.domain.fund_share_value import RegistryDataset
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.service.data_ingestion_service import DataIngestionService

#: The registry is two files, and each is one item of the execution.
REGISTRY_FILE_ITEM = 1
TERMS_FILE_ITEM = 2
REGISTRY_FILE_ITEMS = [REGISTRY_FILE_ITEM, TERMS_FILE_ITEM]
#: Both files are a snapshot of now, not a period.
CURRENT_PERIOD = 'current'


class RegistryIngestionAborted(Exception):
    pass


class FundRegistryIngestionService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
        ingestion_service: DataIngestionService,
        client: CvmClient,
    ):
        self.uow_factory = uow_factory
        self.ingestion_service = ingestion_service
        self.client = client

    async def run(
        self,
        *,
        execution_id: int | None = None,
        force_full_history: bool = False,
    ) -> int | None:
        prepared = await self.ingestion_service.prepare_execution(
            ingestion_type=DataIngestionType.FUND_REGISTRY,
            execution_id=execution_id,
            force_full_history=force_full_history,
            scheduled_item_ids=REGISTRY_FILE_ITEMS,
        )
        if prepared is None:
            return execution_id
        current_execution_id, force_full_history, item_ids = prepared
        try:
            item_ids = item_ids or REGISTRY_FILE_ITEMS
            if sorted(item_ids) != REGISTRY_FILE_ITEMS:
                raise ValidationError('Fund registry ingestion reads both registry files')
            await self.ingestion_service.set_execution_items(
                current_execution_id,
                item_ids=item_ids,
                parameters={'item_ids': item_ids, 'force_full_history': force_full_history},
            )
            for item_id, dataset, path in (
                (REGISTRY_FILE_ITEM, RegistryDataset.FUND_REGISTRY, REGISTRY_PATH),
                (TERMS_FILE_ITEM, RegistryDataset.FUND_TERMS, TERMS_PATH),
            ):
                if await self.ingestion_service.is_aborted(current_execution_id):
                    return current_execution_id
                await self._ingest_file(
                    current_execution_id,
                    item_id=item_id,
                    dataset=dataset,
                    path=path,
                    force=force_full_history,
                )
            await self.ingestion_service.finish(current_execution_id)
            return current_execution_id
        except Exception as exc:
            logger.exception('Fund registry ingestion failed')
            await self.ingestion_service.fail(current_execution_id, exc)
            raise

    async def _ingest_file(
        self,
        execution_id: int,
        *,
        item_id: int,
        dataset: RegistryDataset,
        path: str,
        force: bool,
    ) -> None:
        label = path.rsplit('/', 1)[-1]
        parameters: dict = {'dataset': dataset.value, 'path': path}
        attempt_id = await self.ingestion_service.start_attempt(
            execution_id,
            item_id=item_id,
            item_label=label,
            source=PROVIDER,
            parameters=parameters,
        )
        try:
            async with self.uow_factory() as uow:
                files = await uow.source_files.get_files([
                    (dataset.value, CURRENT_PERIOD),
                    (RegistryDataset.FUND_REGISTRY.value, CURRENT_PERIOD),
                ])
            known = files.get((dataset.value, CURRENT_PERIOD))
            registry = files.get((RegistryDataset.FUND_REGISTRY.value, CURRENT_PERIOD))
            registry_version = registry.content_version if registry else None
            terms_need_application = dataset == RegistryDataset.FUND_TERMS and (
                not registry_version
                or known is None
                or known.applied_registry_version != registry_version
            )
            conditional = not force and not terms_need_application and known is not None
            async with self.client.download(
                path,
                etag=known.etag if conditional else None,
                last_modified=known.last_modified if conditional else None,
            ) as result:
                if isinstance(result, NotModified):
                    parameters['status'] = 'not_modified'
                    await self.ingestion_service.finish_attempt(
                        execution_id, attempt_id, status='success', parameters=parameters
                    )
                    return
                if not isinstance(result, DownloadedFile):
                    raise ValidationError(f'CVM file {path} is not published')
                parameters.update(status='downloaded', size_bytes=result.size_bytes)
                fetched, upserted = await self._apply(
                    execution_id, dataset, result, registry_version=registry_version
                )
            parameters.update(fetched_rows=fetched, upserted_rows=upserted)
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='success',
                parameters=parameters,
                fetched_rows=fetched,
                upserted_rows=upserted,
            )
        except RegistryIngestionAborted:
            return
        except Exception as exc:
            logger.exception('Fund registry file %s failed', path)
            parameters['status'] = 'failed'
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='failure',
                parameters=parameters,
                error=str(exc) or exc.__class__.__name__,
            )

    async def _apply(
        self,
        execution_id: int,
        dataset: RegistryDataset,
        file: DownloadedFile,
        *,
        registry_version: str | None = None,
    ) -> tuple[int, int]:
        """Write the whole file in one transaction, validators last.

        A failure or abort part way leaves nothing of this file written, so the
        stored validators never describe a file that was only half applied.
        """
        fetched = upserted = 0
        now = datetime.now(UTC)
        async with self.uow_factory() as uow:
            registry = uow.fund_registry
            if dataset == RegistryDataset.FUND_REGISTRY:
                # Funds, then classes, then subclasses: each is keyed to the
                # stored ids of the level above it.
                fetched += await self._write_batches(
                    execution_id, iter_fund_batches(file.path, now=now), registry.upsert_funds
                )
                fund_ids = await registry.get_fund_ids_by_registry_id()
                fetched += await self._write_batches(
                    execution_id,
                    iter_class_batches(file.path, fund_ids, now=now),
                    registry.upsert_classes,
                )
                class_ids = await registry.get_class_ids_by_registry_id()
                fetched += await self._write_batches(
                    execution_id,
                    iter_subclass_batches(file.path, class_ids, now=now),
                    registry.upsert_subclasses,
                )
                upserted = fetched
            else:
                batches = iter_terms_batches(file.path)
                while (batch := await iterate_off_loop(batches)) is not None:
                    if await self.ingestion_service.is_aborted(execution_id):
                        raise RegistryIngestionAborted
                    fetched += len(batch)
                    upserted += await registry.apply_terms(batch)
            await uow.source_files.save_version(
                dataset=dataset.value,
                period=CURRENT_PERIOD,
                etag=file.etag,
                last_modified=file.last_modified,
                size_bytes=file.size_bytes,
                content_version=file.content_version,
                fetched_at=now,
                applied_registry_version=(
                    registry_version if dataset == RegistryDataset.FUND_TERMS else None
                ),
            )
            await uow.commit()
        return fetched, upserted

    async def _write_batches(
        self,
        execution_id: int,
        batches: Iterator[list[dict]],
        write: Callable[[list[dict]], Awaitable[None]],
    ) -> int:
        written = 0
        while (batch := await iterate_off_loop(batches)) is not None:
            if await self.ingestion_service.is_aborted(execution_id):
                raise RegistryIngestionAborted
            await write(batch)
            written += len(batch)
        return written

    async def aclose(self) -> None:
        await self.client.close()
