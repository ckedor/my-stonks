"""Aporte médio mensal: uma conta só, para as duas telas que o mostram.

A tela de patrimônio e a jornada do herói mostram o mesmo número com o mesmo
nome, e por um tempo mostraram valores diferentes — R$ 3.909 e R$ 2.831 na
mesma carteira. Cada uma tinha a sua conta: a tela somava os aportes diários,
a jornada tirava a diferença entre as duas pontas de `acc_aported`. A segunda
só estaria certa se a primeira ponta valesse zero, e ela não vale: `acc_aported`
é uma soma acumulada que **já inclui a primeira linha**, então a subtração
jogava fora justamente o aporte que abriu a carteira.

Daí a conta viver aqui, e não nos dois serviços: é uma definição do domínio —
tudo o que entrou, dividido pelos meses que separam as duas pontas da série —
e quem responde a pergunta em qualquer tela responde a partir deste arquivo.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from datetime import date, datetime


def contribution_average(entries: Iterable[Mapping]) -> float:
    """A média mensal de aporte da série de evolução de patrimônio.

    Recebe as linhas como o serviço de posição as devolve: `date` e `aported`,
    o aporte **daquele dia** — não o acumulado. Venda entra com quantidade
    negativa, então resgate já desconta sozinho e não há caso à parte.

    A janela é a história inteira, e não os últimos meses, porque o número é
    ponto de partida de projeções que falam de anos: medido em doze meses, um
    semestre atípico vira a premissa de uma década.

    Nunca devolve negativo: uma carteira que sacou mais do que aportou tem
    ritmo zero, não ritmo para trás — projetar com aporte negativo diria que
    ela encolhe para sempre, o que a série não sustenta. E devolve zero
    também quando as duas pontas caem no mesmo mês: a primeira semana de uma
    carteira não é uma premissa de projeção.
    """
    points = [(_as_date(entry.get('date')), _as_number(entry.get('aported'))) for entry in entries]
    days = [day for day, _ in points if day is not None]
    if len(days) < 2:
        return 0.0

    first, last = min(days), max(days)
    months = (last.year - first.year) * 12 + last.month - first.month
    if months <= 0:
        return 0.0

    total = sum(value for day, value in points if day is not None and value is not None)
    return max(total / months, 0.0)


def _as_number(value) -> float | None:
    if not isinstance(value, int | float) or isinstance(value, bool):
        return None
    return float(value) if math.isfinite(float(value)) else None


def _as_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value[:10]).date()
        except ValueError:
            return None
    return None
