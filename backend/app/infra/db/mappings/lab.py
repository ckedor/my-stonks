from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.lab import (
    theoretical_portfolio_table,
    theoretical_position_table,
)
from app.modules.lab.domain.entities import TheoreticalPortfolio, TheoreticalPosition


def map_lab() -> None:
    if inspect(TheoreticalPortfolio, raiseerr=False) is not None:
        return
    Base.registry.map_imperatively(TheoreticalPosition, theoretical_position_table)
    Base.registry.map_imperatively(
        TheoreticalPortfolio,
        theoretical_portfolio_table,
        properties={
            # As linhas nascem e morrem com a carteira: uma posição teórica
            # fora dela é um peso de coisa nenhuma. Sem relação de volta a
            # partir da linha, de propósito — o repositório zera a chave
            # estrangeira cuja relação chega não-preenchida, e uma linha criada
            # dentro da lista da carteira não tem por que nomear a mãe de novo.
            'positions': relationship(
                TheoreticalPosition,
                cascade='all, delete-orphan',
            ),
        },
    )
