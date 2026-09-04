from datetime import date

from pydantic import BaseModel, Field

from app.modules.lab.domain.enums import Frequency


class TheoreticalPositionRequest(BaseModel):
    weight: float = Field(ge=0)
    asset_id: int | None = None
    series_id: int | None = None
    fixed_income_type_id: int | None = None
    rate: float | None = None
    label: str | None = Field(default=None, max_length=80)


class TheoreticalPositionResponse(BaseModel):
    id: int | None
    weight: float
    asset_id: int | None
    series_id: int | None
    fixed_income_type_id: int | None
    rate: float | None
    label: str | None

    model_config = {'from_attributes': True}


class SaveTheoreticalPortfolioRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    initial_amount: float = Field(default=10000.0, gt=0)
    contribution_amount: float = Field(default=0.0, ge=0)
    contribution_frequency: Frequency = Frequency.NONE
    rebalance_frequency: Frequency = Frequency.NONE
    benchmark_id: int | None = None
    positions: list[TheoreticalPositionRequest]


class TheoreticalPortfolioResponse(BaseModel):
    id: int
    name: str
    initial_amount: float
    contribution_amount: float
    contribution_frequency: Frequency
    rebalance_frequency: Frequency
    benchmark_id: int | None
    positions: list[TheoreticalPositionResponse]

    model_config = {'from_attributes': True}


class PresetLineResponse(BaseModel):
    label: str
    series_id: int
    weight: float
    fixed_income_type_id: int | None
    rate: float | None

    model_config = {'from_attributes': True}


class PresetResponse(BaseModel):
    key: str
    name: str
    description: str
    contribution_frequency: Frequency
    rebalance_frequency: Frequency
    lines: list[PresetLineResponse]

    model_config = {'from_attributes': True}


class RunBacktestRequest(BaseModel):
    """Uma simulação pedida.

    A alocação vem inteira no corpo, e não como o id de uma carteira salva: é o
    que deixa a tela simular um rascunho que ninguém salvou, e o que faz o
    comparador e o painel de variações usarem a mesma rota.
    """

    positions: list[TheoreticalPositionRequest]
    currency: str = 'BRL'
    initial_amount: float = Field(default=10000.0, gt=0)
    contribution_amount: float = Field(default=0.0, ge=0)
    contribution_frequency: Frequency = Frequency.NONE
    rebalance_frequency: Frequency = Frequency.NONE
    #: A janela: uma data, ou um número de anos contado de hoje para trás. Com
    #: os dois preenchidos, a data manda.
    start_date: date | None = None
    years: int | None = Field(default=None, ge=1, le=50)
    end_date: date | None = None
    benchmark_ids: list[int] = Field(default_factory=list)
    label: str | None = Field(default=None, max_length=120)


class CompareBacktestsRequest(BaseModel):
    runs: list[RunBacktestRequest] = Field(min_length=1, max_length=8)


class BacktestPointResponse(BaseModel):
    date: date
    value: float
    invested: float
    acc_return: float

    model_config = {'from_attributes': True}


class BacktestLineResponse(BaseModel):
    key: str
    label: str
    target_weight: float
    final_weight: float
    final_value: float

    model_config = {'from_attributes': True}


class BacktestWindowResponse(BaseModel):
    start_date: date
    end_date: date
    #: A linha que impediu a janela de começar antes. Nula quando quem mandou
    #: foi a data pedida, e não a falta de preço.
    limited_by: str | None
    requested_start_date: date | None

    model_config = {'from_attributes': True}


class BacktestResponse(BaseModel):
    label: str | None
    window: BacktestWindowResponse
    series: list[BacktestPointResponse]
    lines: list[BacktestLineResponse]
    final_value: float
    invested: float
    profit: float
    contributions: int
    rebalances: int
    #: O mesmo payload de análise que a carteira real entrega, para a tela ler
    #: os dois com os mesmos componentes.
    analysis: dict | None

    model_config = {'from_attributes': True}
