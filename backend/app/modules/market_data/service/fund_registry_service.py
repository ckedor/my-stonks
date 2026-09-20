"""Reads of the fund registry, and of what a FIDC class files before it is an asset."""

import asyncio
from dataclasses import dataclass, field
from datetime import date

from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.cvm_client import CvmClient, DownloadedFile
from app.modules.market_data.adapters.fund_filings import (
    list_published_files,
    scan_share_value_filings,
)
from app.modules.market_data.domain.fund_registry import (
    FundRegistryClass,
    FundRegistrySubclass,
    FundShareSeries,
    FundShareSeriesAlias,
)
from app.modules.market_data.domain.fund_share_value import (
    ShareValueDataset,
    ShareValueFiling,
    UnsupportedFundKind,
    share_value_dataset,
)

MAX_SEARCH_RESULTS = 100


@dataclass
class RegisteredUnit:
    asset_id: int
    fund_registry_subclass_id: int | None
    fund_share_series_id: int | None


@dataclass
class FundRegistryClassDetail:
    registry_class: FundRegistryClass
    subclasses: list[FundRegistrySubclass]
    series: list[tuple[FundShareSeries, list[FundShareSeriesAlias]]]
    registered_units: list[RegisteredUnit]


class FundRegistryReadService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def search(
        self,
        *,
        query: str | None,
        kind: str | None,
        status: str | None,
        limit: int,
    ) -> list[FundRegistryClass]:
        async with self.uow as uow:
            return await uow.fund_registry.search_classes(
                query=query,
                kind=kind,
                status=status,
                limit=min(limit, MAX_SEARCH_RESULTS),
            )

    async def search_funds(self, *, query: str | None, kind: str | None, limit: int):
        """Fundos registrados, por nome, CNPJ, administrador ou gestor.

        Um nível acima de ``search``: é o fundo que um FII ou um ETF aponta, e
        é assim que um ETF é achado, já que o catálogo do provedor não traz o
        CNPJ dele.
        """
        async with self.uow as uow:
            return await uow.fund_registry.search_funds(query=query, kind=kind, limit=limit)

    async def get_class(self, class_id: int) -> FundRegistryClassDetail:
        async with self.uow as uow:
            registry_class = await uow.fund_registry.get_class(class_id)
            if registry_class is None:
                raise NotFoundError('Fund registry class not found', context={'id': class_id})
            subclasses = await uow.fund_registry.list_subclasses(class_id)
            series = await uow.fund_registry.list_series(class_id)
            aliases = await uow.fund_registry.list_aliases([class_id])
            units = await uow.fund_registry.list_class_units(class_id)
        return FundRegistryClassDetail(
            registry_class=registry_class,
            subclasses=subclasses,
            series=[
                (item, [alias for alias in aliases if alias.fund_share_series_id == item.id])
                for item in series
            ],
            registered_units=[
                RegisteredUnit(
                    asset_id=unit.asset_id,
                    fund_registry_subclass_id=unit.fund_registry_subclass_id,
                    fund_share_series_id=unit.fund_share_series_id,
                )
                for unit in units
            ],
        )


@dataclass
class SeriesCandidate:
    label: str
    shares: float | None
    share_value: float | None
    has_shares: bool


@dataclass
class FundSeriesFiling:
    """The most recent FIDC filing of a class, read from the source on demand."""

    fund_registry_class_id: int
    applicable: bool
    filing_date: date | None = None
    candidates: list[SeriesCandidate] = field(default_factory=list)
    searched_from: date | None = None
    searched_to: date | None = None
    files_read: int = 0


class FundSeriesReadService:
    """What series a FIDC class files, before any asset or transaction exists.

    Reads source files into temporary disk, newest first, and stops at the
    first one where the class filed. Nothing is persisted: no quote, no
    coverage, no validators. A source failure raises; reaching the earliest
    file without a filing is an answer, not an error.
    """

    def __init__(self, *, uow: UnitOfWork, client: CvmClient):
        self.uow = uow
        self.client = client

    async def get_series_filing(self, class_id: int) -> FundSeriesFiling:
        async with self.uow as uow:
            registry_class = await uow.fund_registry.get_class(class_id)
        if registry_class is None:
            raise NotFoundError('Fund registry class not found', context={'id': class_id})
        try:
            dataset = share_value_dataset(registry_class.fund.kind if registry_class.fund else None)
        except UnsupportedFundKind:
            return FundSeriesFiling(fund_registry_class_id=class_id, applicable=False)
        if dataset != ShareValueDataset.FIDC_MONTHLY:
            return FundSeriesFiling(fund_registry_class_id=class_id, applicable=False)

        files = await list_published_files(self.client, dataset)
        answer = FundSeriesFiling(fund_registry_class_id=class_id, applicable=True)
        for file in reversed(files):
            async with self.client.download(file.path) as result:
                if not isinstance(result, DownloadedFile):
                    continue
                scan = await asyncio.to_thread(
                    scan_share_value_filings, result.path, dataset, {registry_class.cnpj}
                )
            answer.files_read += 1
            answer.searched_from = file.first_day
            answer.searched_to = answer.searched_to or file.last_day
            filings = scan.filings.get(registry_class.cnpj)
            if filings:
                latest = max(filing.date for filing in filings)
                answer.filing_date = latest
                answer.candidates = _candidates([f for f in filings if f.date == latest])
                return answer
        return answer

    async def aclose(self) -> None:
        await self.client.close()


def _candidates(filings: list[ShareValueFiling]) -> list[SeriesCandidate]:
    seen: dict[str, SeriesCandidate] = {}
    for filing in filings:
        label = filing.label or ''
        if label in seen:
            continue
        seen[label] = SeriesCandidate(
            label=label,
            shares=float(filing.shares) if filing.shares is not None else None,
            share_value=float(filing.share_value) if filing.share_value is not None else None,
            has_shares=(filing.shares is None or filing.shares > 0)
            and filing.share_value is not None
            and filing.share_value > 0,
        )
    return sorted(seen.values(), key=lambda candidate: (not candidate.has_shares, candidate.label))
