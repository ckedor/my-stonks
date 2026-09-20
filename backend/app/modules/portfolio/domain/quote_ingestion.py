from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class QuoteIngestionAssetSelection:
    asset_ids: list[int]
    position_reference_date: date | None
    position_window_days: int | None
    description: str


@dataclass(frozen=True)
class FundPurchaseHistory:
    """One fund in one portfolio: when it was traded and when it was consolidated."""

    portfolio_id: int
    asset_id: int
    first_transaction: date
    last_transaction: date
    first_position: date | None
    last_position: date | None

    def needs_share_values(self) -> bool:
        """Whether its trades reach dates its consolidated positions do not.

        A first purchase has no position yet, because consolidation refuses a
        position it cannot price. A retrodated purchase starts before the first
        position. A purchase after a full exit is more than a day after the
        last position, which ends the day before the exit.
        """
        if self.first_position is None or self.last_position is None:
            return True
        return self.first_transaction < self.first_position or (
            (self.last_transaction - self.last_position).days > 1
        )


@dataclass(frozen=True)
class FundShareValueSelection:
    #: The funds to ingest, each with its earliest purchase in any portfolio.
    since: dict[int, date]
    #: Funds asked for by id that have no purchase anywhere.
    without_purchase: list[int]
    description: str


def select_share_value_funds(
    histories: list[FundPurchaseHistory],
    *,
    recently_held: set[int],
    full_history: bool,
) -> dict[int, date]:
    selected = {
        history.asset_id
        for history in histories
        if full_history or history.asset_id in recently_held or history.needs_share_values()
    }
    since: dict[int, date] = {}
    for history in histories:
        if history.asset_id in selected:
            current = since.get(history.asset_id)
            since[history.asset_id] = min(
                current or history.first_transaction, history.first_transaction
            )
    return since
