import re
from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator

from app.modules.research.domain.enums import RecommendationChange

#: A report writes "5,0%", "5.0" and "5" for the same weight, and the model
#: echoes whichever it read. Everything that is not a digit, a sign or a
#: decimal separator is dropped before the number is read.
_NUMERIC_NOISE = re.compile(r'[^0-9,.\-]')


def _to_float(value: object) -> object:
    if not isinstance(value, str):
        return value
    cleaned = _NUMERIC_NOISE.sub('', value).strip()
    if not cleaned:
        return None
    # A Brazilian report writes 1.234,56; an English one writes 1,234.56. The
    # last separator in the string is the decimal one in both.
    if ',' in cleaned and '.' in cleaned:
        decimal_separator = max(cleaned.rfind(','), cleaned.rfind('.'))
        cleaned = (
            _NUMERIC_NOISE.sub('', cleaned[:decimal_separator].replace(',', '').replace('.', ''))
            + '.'
            + cleaned[decimal_separator + 1 :]
        )
    else:
        cleaned = cleaned.replace(',', '.')
    return cleaned


class ExtractedPosition(BaseModel):
    """One line as the model read it, before anything is looked up.

    Nothing here is trusted: it is the reading of a document by a model, and
    the screen that shows it exists so a person can disagree with it.
    """

    model_config = ConfigDict(extra='ignore')

    ticker: str
    name: str | None = None
    weight: float
    rationale: str | None = None
    target_price: float | None = None
    change: RecommendationChange | None = None

    @field_validator('ticker')
    @classmethod
    def _normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator('weight', 'target_price', mode='before')
    @classmethod
    def _parse_number(cls, value: object) -> object:
        return _to_float(value)

    @field_validator('change', mode='before')
    @classmethod
    def _parse_change(cls, value: object) -> object:
        """An unrecognized word is no statement, not a failed extraction.

        The change is the least reliable thing in the answer and the least
        costly to lose: rejecting the whole report because one line came back
        with a word outside the list would throw away the weights too.
        """
        if value is None:
            return None
        if isinstance(value, str):
            candidate = value.strip().lower()
            return candidate if candidate in set(RecommendationChange) else None
        return value


class ExtractedRecommendedPortfolio(BaseModel):
    """The whole report as the model read it."""

    model_config = ConfigDict(extra='ignore')

    source_name: str | None = None
    title: str | None = None
    reference_date: date | None = None
    summary: str | None = None
    objective: str | None = None
    positions: list[ExtractedPosition] = []

    @field_validator('reference_date', mode='before')
    @classmethod
    def _drop_unreadable_date(cls, value: object) -> object:
        """A date the model could not find comes back as an empty string.

        Refusing the document over it would cost the reader the whole
        extraction for the one field the upload screen can fill in by hand.
        """
        if isinstance(value, str) and not value.strip():
            return None
        return value
