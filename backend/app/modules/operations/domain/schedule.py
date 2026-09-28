"""When a routine runs, read from the scheduler's own entries.

The scheduler is the only place a time is written down. What the admin shows
— "toda terça às 09:00", the next three runs — is derived here from that same
entry, so the screen cannot drift from what the worker does.

Celery's `crontab` is translated into a `CronSpec` at the edge (composition),
which keeps this module free of the worker library and easy to test.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from enum import StrEnum
from zoneinfo import ZoneInfo

ALL_MINUTES = frozenset(range(60))
ALL_HOURS = frozenset(range(24))
#: Celery's numbering: 0 is Sunday.
ALL_DAYS_OF_WEEK = frozenset(range(7))
ALL_DAYS_OF_MONTH = frozenset(range(1, 32))
ALL_MONTHS = frozenset(range(1, 13))

WEEKDAY_NAMES = {
    0: 'domingo',
    1: 'segunda',
    2: 'terça',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'sábado',
}

WEEKEND = frozenset({0, 6})

#: How far ahead a next run is searched for. A crontab that matches nothing in
#: a year (the 31st of February) has no next run, rather than a slow loop.
SEARCH_DAYS = 400


class Frequency(StrEnum):
    #: More than once a day.
    INTRADAY = 'intraday'
    DAILY = 'daily'
    WEEKLY = 'weekly'
    MONTHLY = 'monthly'
    #: Anything else a crontab can say: certain months only, say.
    OTHER = 'other'


@dataclass(frozen=True)
class CronSpec:
    minutes: frozenset[int]
    hours: frozenset[int]
    days_of_week: frozenset[int]
    days_of_month: frozenset[int]
    months: frozenset[int]

    def matches_day(self, day: date) -> bool:
        # Celery counts Sunday as 0; Python counts Monday as 0.
        return (
            (day.weekday() + 1) % 7 in self.days_of_week
            and day.day in self.days_of_month
            and day.month in self.months
        )

    def times_of_day(self) -> list[time]:
        return [
            time(hour, minute) for hour in sorted(self.hours) for minute in sorted(self.minutes)
        ]

    @property
    def frequency(self) -> Frequency:
        every_day = (
            self.days_of_week == ALL_DAYS_OF_WEEK
            and self.days_of_month == ALL_DAYS_OF_MONTH
            and self.months == ALL_MONTHS
        )
        if every_day:
            return Frequency.INTRADAY if len(self.times_of_day()) > 1 else Frequency.DAILY
        if self.months != ALL_MONTHS:
            return Frequency.OTHER
        if self.days_of_month == ALL_DAYS_OF_MONTH:
            return Frequency.WEEKLY
        if self.days_of_week == ALL_DAYS_OF_WEEK:
            return Frequency.MONTHLY
        return Frequency.OTHER


def _join(parts: list[str]) -> str:
    if len(parts) <= 1:
        return ''.join(parts)
    return f'{", ".join(parts[:-1])} e {parts[-1]}'


def describe(spec: CronSpec) -> str:
    """The schedule in a sentence: "Toda terça às 09:00"."""
    times = spec.times_of_day()
    if len(times) > 6:
        # Every few minutes: listing them would be a wall of numbers.
        at = f'{len(times)} vezes por dia'
    else:
        at = 'às ' + _join([moment.strftime('%H:%M') for moment in times])

    frequency = spec.frequency
    if frequency in (Frequency.INTRADAY, Frequency.DAILY):
        return f'Todo dia {at}'
    if frequency == Frequency.WEEKLY:
        days = sorted(spec.days_of_week, key=lambda day: day or 7)
        if len(days) == 1:
            article = 'Todo' if days[0] in WEEKEND else 'Toda'
            return f'{article} {WEEKDAY_NAMES[days[0]]} {at}'
        # "Às terças e aos sábados": each day takes its own article.
        listed = _join([
            f'{"aos" if day in WEEKEND else "às"} {WEEKDAY_NAMES[day]}s' for day in days
        ])
        return f'{listed[0].upper()}{listed[1:]} {at}'
    if frequency == Frequency.MONTHLY:
        days = [str(day) for day in sorted(spec.days_of_month)]
        return f'Todo mês, no dia {_join(days)}, {at}'
    return f'Em datas específicas, {at}'


def next_runs(spec: CronSpec, *, after: datetime, zone: ZoneInfo, count: int = 3) -> list[datetime]:
    """The next ``count`` times the spec fires after ``after``, in ``zone``."""
    local = after.astimezone(zone)
    runs: list[datetime] = []
    times = spec.times_of_day()
    for offset in range(SEARCH_DAYS):
        day = local.date() + timedelta(days=offset)
        if not spec.matches_day(day):
            continue
        for moment in times:
            candidate = datetime.combine(day, moment, tzinfo=zone)
            if candidate > local:
                runs.append(candidate)
                if len(runs) == count:
                    return runs
    return runs


def previous_run(spec: CronSpec, *, before: datetime, zone: ZoneInfo) -> datetime | None:
    """The last time the spec fired at or before ``before``."""
    local = before.astimezone(zone)
    times = list(reversed(spec.times_of_day()))
    for offset in range(SEARCH_DAYS):
        day = local.date() - timedelta(days=offset)
        if not spec.matches_day(day):
            continue
        for moment in times:
            candidate = datetime.combine(day, moment, tzinfo=zone)
            if candidate <= local:
                return candidate
    return None
