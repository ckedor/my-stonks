from dataclasses import dataclass
from datetime import datetime


@dataclass(eq=False, kw_only=True)
class AssetVisit:
    """How often a user has opened an asset, used to surface their favourites.

    Interest is inferred from visits rather than an explicit star: the ranking
    stays useful without asking the user to curate anything.
    """

    user_id: int
    asset_id: int
    visit_count: int = 0
    last_visited_at: datetime | None = None
    id: int | None = None
