"""Wealth-tier schemas."""

from pydantic import BaseModel, ConfigDict, Field

# Placement is bounded so a typo cannot push the drawing off the screen or blow
# up the band it sits in. The range is wide enough to nudge any illustration.
OFFSET_LIMIT = 400
MIN_HEIGHT = 16
MAX_HEIGHT = 600


class WealthTierCreate(BaseModel):
    rank: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=50)
    threshold: float = Field(ge=0)
    artwork: str | None = None
    artwork_offset: int = Field(default=0, ge=-OFFSET_LIMIT, le=OFFSET_LIMIT)
    artwork_height: int | None = Field(default=None, ge=MIN_HEIGHT, le=MAX_HEIGHT)


class WealthTierUpdate(BaseModel):
    rank: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=50)
    threshold: float | None = Field(default=None, ge=0)
    artwork: str | None = None
    artwork_offset: int | None = Field(default=None, ge=-OFFSET_LIMIT, le=OFFSET_LIMIT)
    artwork_height: int | None = Field(default=None, ge=MIN_HEIGHT, le=MAX_HEIGHT)


class WealthTier(BaseModel):
    id: int
    rank: int
    name: str
    threshold: float
    artwork: str | None = None
    #: Vertical nudge in px, so the character's feet land on the layout's
    #: baseline. Belongs to the drawing: no single value fits every file.
    artwork_offset: int = 0
    #: Drawn height in px. Absent means the screen's default.
    artwork_height: int | None = None

    model_config = ConfigDict(from_attributes=True)


class PortfolioWealthTier(BaseModel):
    """A portfolio's standing on the ladder, from two deliberately different numbers.

    `peak_patrimony` is the highest the portfolio has ever been worth, and it is
    what earns `current_tier`: a rung is reached once and never lost.

    `remaining` and `progress` are measured from `current_patrimony` instead,
    because how much is left to climb is a question about today. A portfolio
    that fell back keeps its title and sees the real distance ahead of it.
    """

    peak_patrimony: float
    current_patrimony: float
    current_tier: WealthTier | None = None
    next_tier: WealthTier | None = None
    remaining: float | None = None
    progress: float
