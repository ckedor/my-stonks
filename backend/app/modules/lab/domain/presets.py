"""Os modelos que já vêm prontos.

Ficam em código, como a escala de patentes: um preset novo entra por commit e
não por tela de admin, e por isso não há tabela nem CRUD atrás deles.

Todos são definidos **só sobre séries de mercado** — IBOVESPA, CDI, IFIX,
S&P 500 —, nunca sobre ativos. Um preset feito de tickers apodrece: basta um
ativo sair do catálogo para o modelo abrir quebrado, e o modelo é justamente o
ponto de partida de quem ainda não sabe o que quer. Série de mercado não sai do
catálogo.
"""

from dataclasses import dataclass

from app.modules.lab.domain.enums import Frequency
from app.modules.market_data.domain.constants import ASSET_FIXED_INCOME_TYPE, SERIES


@dataclass(frozen=True, kw_only=True)
class PresetLine:
    """Uma linha do modelo.

    Sem `fixed_income_type_id`, a série entra como nível: a linha é a exposição
    ao índice inteiro. Com ele, a série entra como taxa e a linha é renda fixa
    sintética. É a mesma distinção que a posição teórica faz.
    """

    label: str
    series_id: int
    weight: float
    fixed_income_type_id: int | None = None
    rate: float | None = None


@dataclass(frozen=True, kw_only=True)
class Preset:
    key: str
    name: str
    description: str
    contribution_frequency: Frequency = Frequency.MONTHLY
    rebalance_frequency: Frequency = Frequency.ANNUAL
    lines: tuple[PresetLine, ...]


PRESETS: tuple[Preset, ...] = (
    Preset(
        key='cdi',
        name='100% CDI',
        description='A linha de base. Não é uma carteira: é o que o dinheiro '
        'teria feito parado, e é contra isso que todo o resto se lê.',
        rebalance_frequency=Frequency.NONE,
        lines=(PresetLine(label='CDI', series_id=SERIES.CDI, weight=100.0),),
    ),
    Preset(
        key='ibov',
        name='100% Bolsa',
        description='O Ibovespa inteiro, sem renda fixa nenhuma. O outro extremo da régua.',
        rebalance_frequency=Frequency.NONE,
        lines=(PresetLine(label='Ibovespa', series_id=SERIES.IBOVESPA, weight=100.0),),
    ),
    Preset(
        key='60-40',
        name='60/40 Brasil',
        description='Sessenta por cento em bolsa brasileira e quarenta no CDI. '
        'A alocação clássica, na versão que cabe no mercado daqui.',
        lines=(
            PresetLine(label='Ibovespa', series_id=SERIES.IBOVESPA, weight=60.0),
            PresetLine(label='CDI', series_id=SERIES.CDI, weight=40.0),
        ),
    ),
    Preset(
        key='tripe-br',
        name='Tripé Brasil',
        description='Bolsa, fundos imobiliários e CDI em partes próximas — os '
        'três pés em que a maioria das carteiras brasileiras se apoia.',
        lines=(
            PresetLine(label='Ibovespa', series_id=SERIES.IBOVESPA, weight=40.0),
            PresetLine(label='IFIX', series_id=SERIES.IFIX, weight=30.0),
            PresetLine(label='CDI', series_id=SERIES.CDI, weight=30.0),
        ),
    ),
    Preset(
        key='global',
        name='Global',
        description='S&P 500 com um colchão em CDI. A bolsa americana convertida '
        'para reais, então o câmbio entra no resultado.',
        lines=(
            PresetLine(label='S&P 500', series_id=SERIES.SP500, weight=60.0),
            PresetLine(label='CDI', series_id=SERIES.CDI, weight=40.0),
        ),
    ),
    Preset(
        key='inflacao',
        name='Proteção de inflação',
        description='Metade em um título atrelado ao IPCA com juro real de 6% '
        'ao ano, metade em CDI.',
        lines=(
            PresetLine(
                label='IPCA + 6%',
                series_id=SERIES.IPCA,
                weight=50.0,
                fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.INDEX_PLUS,
                rate=0.06,
            ),
            PresetLine(label='CDI', series_id=SERIES.CDI, weight=50.0),
        ),
    ),
)
