from enum import StrEnum


class RecommendationChange(StrEnum):
    """What an edition did with a line, compared to the previous one.

    `UNCHANGED` and an absent change are different statements: the first is the
    report saying it kept the position, the second is the report not saying
    anything, which is what most of them do for most lines.
    """

    ENTERED = 'entered'
    INCREASED = 'increased'
    REDUCED = 'reduced'
    UNCHANGED = 'unchanged'
    EXITED = 'exited'
