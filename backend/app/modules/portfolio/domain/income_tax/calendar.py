"""Vencimento do DARF: último dia útil do mês seguinte ao da apuração.

"Dia útil" aqui é dia de expediente bancário, porque é no banco que o DARF se
paga. Além dos feriados nacionais, os bancos fecham na segunda e na terça de
Carnaval, na Sexta-feira Santa e em Corpus Christi, e não atendem ao público em
31 de dezembro — é por isso que o DARF de novembro vence no dia 30.

Feriado estadual ou municipal não entra: o vencimento é nacional. A data é a
conta da aplicação; a tela manda conferir no Sicalc, que é quem a Receita
reconhece.
"""

from datetime import date, timedelta

#: Dia Nacional de Zumbi e da Consciência Negra, feriado nacional desde 2024
#: (Lei 14.759/2023).
_BLACK_CONSCIOUSNESS_DAY_SINCE = 2024


def easter(year: int) -> date:
    """Domingo de Páscoa no calendário gregoriano (algoritmo de Meeus/Jones/Butcher)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    ell = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * ell) // 451
    month, day = divmod(h + ell - 7 * m + 114, 31)
    return date(year, month, day + 1)


def bank_holidays(year: int) -> frozenset[date]:
    fixed = {
        date(year, 1, 1),
        date(year, 4, 21),
        date(year, 5, 1),
        date(year, 9, 7),
        date(year, 10, 12),
        date(year, 11, 2),
        date(year, 11, 15),
        date(year, 12, 25),
        # Sem expediente bancário ao público.
        date(year, 12, 31),
    }
    if year >= _BLACK_CONSCIOUSNESS_DAY_SINCE:
        fixed.add(date(year, 11, 20))
    sunday = easter(year)
    movable = {
        sunday - timedelta(days=48),  # segunda de Carnaval
        sunday - timedelta(days=47),  # terça de Carnaval
        sunday - timedelta(days=2),  # Sexta-feira Santa
        sunday + timedelta(days=60),  # Corpus Christi
    }
    return frozenset(fixed | movable)


def is_business_day(day: date) -> bool:
    return day.weekday() < 5 and day not in bank_holidays(day.year)


def last_business_day(year: int, month: int) -> date:
    first_of_next = date(year + month // 12, month % 12 + 1, 1)
    day = first_of_next - timedelta(days=1)
    while not is_business_day(day):
        day -= timedelta(days=1)
    return day


def darf_due_date(period: date) -> date:
    """O vencimento do imposto apurado no mês de `period`."""
    return last_business_day(period.year + period.month // 12, period.month % 12 + 1)
