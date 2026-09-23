from collections import defaultdict
from datetime import date

from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.lib.utils.files import unreadable_pdf_reason
from app.modules.market_data.domain.constants import CURRENCY_MAP
from app.modules.portfolio.adapters.position_statement_extractor import (
    PositionStatementExtractor,
)
from app.modules.portfolio.domain.brokerage_note import (
    AssetMatch,
    NoteWarning,
    line_ticker,
    match_broker,
)
from app.modules.portfolio.domain.position_statement import (
    DraftHolding,
    PositionDiff,
    PositionStatementDraft,
    StatementHolding,
    compare_positions,
    held_quantities,
)


class PositionStatementService:
    """Bate a posição de um extrato de corretora com as transações da carteira.

    Não escreve nada. O extrato é lido, a corretora e os ativos são
    procurados no cadastro, e cada ativo recebe um diagnóstico: igual,
    divergente, só no extrato ou só no app. Corrigir é editar as transações.
    """

    def __init__(self, uow: UnitOfWork, extractor: PositionStatementExtractor):
        self.uow = uow
        self.extractor = extractor

    async def extract(
        self, *, portfolio_id: int, filename: str, content: bytes
    ) -> PositionStatementDraft:
        if reason := unreadable_pdf_reason(filename=filename, content=content):
            raise ValidationError(reason)
        reading, model = await self.extractor.extract(filename=filename, content=content)

        tickers = [
            line_ticker(holding.ticker, holding.security, reading.currency)
            for holding in reading.holdings
        ]
        async with self.uow as uow:
            assets = await uow.assets.get_by_tickers(sorted({t for t in tickers if t}))
            brokers = await uow.portfolios.list_brokers()

        candidates: dict[str, list] = defaultdict(list)
        for asset in assets:
            if asset.ticker:
                candidates[asset.ticker.upper()].append(asset)
        holdings = tuple(
            self._draft_holding(index, holding, ticker, candidates.get(ticker or '', []))
            for index, (holding, ticker) in enumerate(zip(reading.holdings, tickers, strict=True))
        )

        warnings: list[NoteWarning] = []
        broker = match_broker(brokers, reading.broker_cnpj, reading.broker_name)
        broker_id = None
        if broker is None:
            warnings.append(
                NoteWarning(
                    code='broker_unknown',
                    message=f'Nenhuma corretora cadastrada casa com {reading.broker_name}. '
                    'Escolha a corretora.',
                )
            )
        elif broker.currency_id != CURRENCY_MAP[reading.currency]:
            warnings.append(
                NoteWarning(
                    code='broker_currency',
                    message=f'{broker.name} opera em outra moeda; o extrato é em '
                    f'{reading.currency}. Confira a corretora.',
                )
            )
            broker_id = broker.id
        else:
            broker_id = broker.id

        positions = (
            await self.compare(
                portfolio_id=portfolio_id,
                broker_id=broker_id,
                as_of=reading.as_of,
                holdings=[self._holding(h) for h in holdings],
            )
            if broker_id is not None
            else []
        )
        return PositionStatementDraft(
            broker_name=reading.broker_name,
            broker_cnpj=reading.broker_cnpj,
            broker_id=broker_id,
            currency=reading.currency,
            as_of=reading.as_of,
            holdings=holdings,
            positions=tuple(positions),
            warnings=tuple(warnings),
            model=model,
        )

    async def compare(
        self,
        *,
        portfolio_id: int,
        broker_id: int,
        as_of: date,
        holdings: list[StatementHolding],
    ) -> list[PositionDiff]:
        """O diagnóstico de novo, para quando a pessoa corrige o extrato ou o histórico."""
        async with self.uow as uow:
            transactions = await uow.portfolios.get_broker_transactions_until(
                portfolio_id, broker_id, as_of
            )
            asset_ids = sorted(
                {t.asset_id for t in transactions}
                | {h.asset_id for h in holdings if h.asset_id is not None}
            )
            events = await uow.portfolios.get_events_for_assets(asset_ids)
        return compare_positions(holdings, held_quantities(transactions, events, as_of))

    @staticmethod
    def _holding(holding: DraftHolding) -> StatementHolding:
        return StatementHolding(
            index=holding.index,
            security=holding.security,
            ticker=holding.ticker,
            quantity=holding.quantity,
            asset_id=holding.asset_id,
        )

    @staticmethod
    def _draft_holding(index, holding, ticker, matches) -> DraftHolding:
        if len(matches) == 1:
            match, asset_id, asset_name = AssetMatch.MATCHED, matches[0].id, matches[0].name
        elif matches:
            match, asset_id, asset_name = AssetMatch.AMBIGUOUS, None, None
        else:
            match, asset_id, asset_name = AssetMatch.UNKNOWN, None, None
        return DraftHolding(
            index=index,
            security=holding.security,
            ticker=ticker,
            quantity=abs(holding.quantity),
            asset_id=asset_id,
            asset_name=asset_name,
            match=match,
        )
