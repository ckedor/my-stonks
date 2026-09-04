from enum import StrEnum


class Frequency(StrEnum):
    """Com que passo uma coisa se repete ao longo da simulação.

    Aporte e rebalanceamento andam no mesmo calendário — de mês em mês, de
    trimestre em trimestre —, então são a mesma enumeração e não duas iguais.
    `NONE` é a ausência do regime, e significa coisas diferentes em cada um:
    sem aporte, só o valor inicial trabalha; sem rebalanceamento, quem corrige
    a carteira são os aportes.
    """

    NONE = 'none'
    MONTHLY = 'monthly'
    QUARTERLY = 'quarterly'
    SEMIANNUAL = 'semiannual'
    ANNUAL = 'annual'

    @property
    def months(self) -> int | None:
        """De quantos em quantos meses ela cai. `None` quando não cai nunca."""
        return _MONTHS[self]


_MONTHS: dict[Frequency, int | None] = {
    Frequency.NONE: None,
    Frequency.MONTHLY: 1,
    Frequency.QUARTERLY: 3,
    Frequency.SEMIANNUAL: 6,
    Frequency.ANNUAL: 12,
}
