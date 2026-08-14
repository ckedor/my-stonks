from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class NewCategory:
    """A category asked for but not yet created.

    Distinct from ``CustomCategory``: that one is persisted and requires the
    ``portfolio_id`` it belongs to, which only exists after the portfolio row is
    inserted. This carries what the caller can state up front.
    """

    name: str
    color: str
    benchmark_id: int
