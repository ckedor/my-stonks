import re
import unicodedata

_NON_ALPHANUMERIC = re.compile(r'[^a-z0-9]+')


def slugify(value: str) -> str:
    """The stable identity of a research house typed by hand.

    "BTG Pactual", "btg pactual" and "BTG  Pactual" are the same house, and
    without this they would be three rows carrying a third of the history each.
    """
    normalized = unicodedata.normalize('NFKD', value)
    ascii_only = normalized.encode('ascii', 'ignore').decode('ascii').lower()
    return _NON_ALPHANUMERIC.sub('-', ascii_only).strip('-')
