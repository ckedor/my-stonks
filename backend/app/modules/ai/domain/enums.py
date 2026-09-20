from enum import StrEnum


class AIFeatureKey(StrEnum):
    """The stable identity of an AI capability.

    It is the key the database row carries, the key the admin runs, and the key
    the product route asks for. Renaming one is a migration, not a rename.
    """

    ASSET_DESCRIPTION_DRAFT = 'asset_description_draft'


class AIFreshness(StrEnum):
    """How an artifact stops being current.

    ``TIME`` is for answers that go stale on their own — anything that quotes
    the news. ``MANUAL`` is for answers that do not: what a fund is chartered
    to do does not change because a week passed, and regenerating it on a timer
    would pay for the same paragraph again.
    """

    TIME = 'time'
    MANUAL = 'manual'


class AIRunStatus(StrEnum):
    SUCCESS = 'success'
    FAILURE = 'failure'
