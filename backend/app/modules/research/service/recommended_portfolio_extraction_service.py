from collections import defaultdict

from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.research.adapters.recommended_portfolio_extractor import (
    RecommendedPortfolioExtractor,
)
from app.modules.research.domain.draft import (
    DraftPosition,
    PositionMatch,
    RecommendedPortfolioDraft,
)
from app.modules.research.domain.extraction import ExtractedPosition

#: What a research report weighs. Above this the provider refuses the document
#: anyway, and the refusal reaches the reader as an integration error instead
#: of as the file being too big.
MAX_PDF_BYTES = 20 * 1024 * 1024

_PDF_MAGIC = b'%PDF-'


class RecommendedPortfolioExtractionService:
    """Reads a research PDF and lines its tickers up against the catalogue.

    It writes nothing. What comes back is a draft: the reading of the report
    plus, for each line, which registered asset that ticker is — or that the
    question has no single answer.
    """

    def __init__(self, uow: UnitOfWork, extractor: RecommendedPortfolioExtractor):
        self.uow = uow
        self.extractor = extractor

    async def extract(self, *, filename: str, content: bytes) -> RecommendedPortfolioDraft:
        self._reject_unreadable(filename=filename, content=content)
        extracted, model = await self.extractor.extract(filename=filename, content=content)

        tickers = sorted({position.ticker for position in extracted.positions})
        async with self.uow as uow:
            assets = await uow.assets.get_by_tickers(tickers)

        candidates = self._by_ticker(assets)
        positions = [self._draft_position(position, candidates) for position in extracted.positions]
        return RecommendedPortfolioDraft(
            source_name=extracted.source_name,
            title=extracted.title,
            reference_date=extracted.reference_date,
            summary=extracted.summary,
            objective=extracted.objective,
            positions=positions,
            total_weight=round(sum(position.weight for position in positions), 4),
            model=model,
        )

    @staticmethod
    def _reject_unreadable(*, filename: str, content: bytes) -> None:
        if not content:
            raise ValidationError('O arquivo enviado está vazio.')
        if len(content) > MAX_PDF_BYTES:
            raise ValidationError(
                f'O arquivo tem {len(content) // (1024 * 1024)} MB e o limite é '
                f'{MAX_PDF_BYTES // (1024 * 1024)} MB.'
            )
        # The bytes decide, not the name: a .pdf that is not one comes back
        # from the provider as an unhelpful integration failure.
        if not content.startswith(_PDF_MAGIC):
            raise ValidationError(f'O arquivo {filename} não é um PDF.')

    @staticmethod
    def _by_ticker(assets: list) -> dict[str, list]:
        candidates: dict[str, list] = defaultdict(list)
        for asset in assets:
            if asset.ticker:
                candidates[asset.ticker.upper()].append(asset)
        return candidates

    @staticmethod
    def _draft_position(
        position: ExtractedPosition,
        candidates: dict[str, list],
    ) -> DraftPosition:
        matches = candidates.get(position.ticker, [])
        if len(matches) == 1:
            asset = matches[0]
            match, asset_id, asset_name = PositionMatch.MATCHED, asset.id, asset.name
        elif matches:
            match, asset_id, asset_name = PositionMatch.AMBIGUOUS, None, None
        else:
            match, asset_id, asset_name = PositionMatch.UNKNOWN, None, None
        return DraftPosition(
            ticker=position.ticker,
            name=position.name,
            weight=position.weight,
            rationale=position.rationale,
            target_price=position.target_price,
            change=position.change,
            asset_id=asset_id,
            asset_name=asset_name,
            match=match,
        )
