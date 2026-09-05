"""O consenso das carteiras recomendadas: quem é recomendado por quanta gente.

Uma recomendação isolada é a opinião de uma casa; várias casas apontando o
mesmo ativo é outra coisa, e é essa outra coisa que a tela de mercado mostra.
O consenso não é uma nova recomendação — é a contagem das que existem, e por
isso não se persiste: ele muda sozinho quando uma edição nova chega.
"""

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True, kw_only=True)
class RecommendationConsensusEntry:
    """Um ativo, e o que as carteiras vigentes dizem dele.

    São dois números e não um: `houses` é quanta gente recomenda, `conviction`
    é o tamanho que dão à posição. Cinco casas com peso pequeno e uma casa
    apaixonada são recomendações diferentes, e um score único as esconderia.

    `conviction` é o peso da linha dividido pelo peso médio da carteira em que
    ela está — `1,0` é uma posição média, `2,0` é o dobro da convicção. Sem
    essa normalização uma carteira de dez ativos, onde a média é 10%, pareceria
    sempre mais convicta que uma de trinta, onde a média é 3,3%.
    """

    asset_id: int
    ticker: str
    name: str
    logo_url: str | None = None
    houses: int
    portfolios: int
    average_weight: float
    conviction: float
    entered: int = 0
    increased: int = 0
    reduced: int = 0
    source_names: list[str] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class RecommendationConsensus:
    """O ranking mais o que ficou de fora dele.

    `unlinked_positions` é publicado junto de propósito: um ranking construído
    só sobre as linhas que o catálogo reconhece precisa dizer quantas ignorou,
    senão mente por omissão.
    """

    entries: list[RecommendationConsensusEntry] = field(default_factory=list)
    considered_portfolios: int = 0
    considered_sources: int = 0
    unlinked_positions: int = 0
    window_months: int
    oldest_reference_date: date | None = None
    newest_reference_date: date | None = None
