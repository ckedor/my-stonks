"""As fichas da declaração, na forma do programa do IRPF, campo a campo.

A apuração responde "quanto de imposto". Esta camada responde "o que digitar
onde": cada ficha é uma lista de itens com os campos que o programa pede, na
ordem em que ele pede, prontos para copiar. Nada aqui recalcula imposto — os
números vêm da apuração e do livro de custo.

Onde o código de uma ficha não é certo para o ativo (fundo no exterior,
fundo sem come-cotas, debênture incentivada), o item sai com `note` dizendo o
que conferir. A tabela de códigos é a de Bens e Direitos do IRPF 2026 (grupos
03, 04, 07 e 08); as fontes e o que ficou em aberto estão na seção 13 do plano
de IR.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.market_data.domain.market_scope import is_brazilian_market
from app.modules.portfolio.domain.dividend import DividendKind
from app.modules.portfolio.domain.income_tax.assessment import MonthlyAssessment, money
from app.modules.portfolio.domain.income_tax.darf import DarfObligation
from app.modules.portfolio.domain.income_tax.ledger import (
    Holding,
    RealizedSale,
    holdings_on,
)
from app.modules.portfolio.domain.income_tax.pendency import Pendency, PendencyCode
from app.modules.portfolio.domain.income_tax.rules import TaxRegime
from app.modules.portfolio.domain.income_tax.trades import (
    FIXED_INCOME_ETF_SEGMENT_ID,
    CorporateEvent,
    TaxAssetKind,
    TaxTrade,
)

_ZERO = Decimal(0)
_CNPJ_DIGITS = 14

BRAZIL = ('105', 'Brasil')
UNITED_STATES = ('249', 'Estados Unidos')

_BITCOIN = frozenset({'BTC'})
_STABLECOINS = frozenset({'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'BRZ'})


@dataclass(frozen=True, kw_only=True)
class AssetRecord:
    """O que o cadastro diz de um ativo, para identificá-lo numa ficha."""

    asset_id: int
    asset_type_id: int
    ticker: str | None
    name: str
    exchange_code: str | None
    #: CNPJ da companhia emissora (ação).
    issuer_cnpj: str | None = None
    #: CNPJ do fundo no cadastro do regulador (FII, ETF, FI).
    fund_cnpj: str | None = None
    etf_segment_id: int | None = None
    fund_kind: str | None = None


@dataclass(frozen=True, kw_only=True)
class BrokerRecord:
    broker_id: int
    name: str
    cnpj: str | None
    currency_id: int | None


@dataclass(frozen=True, kw_only=True)
class DividendRecord:
    """Um provento recebido, em reais."""

    asset_id: int
    day: date
    amount: Decimal
    kind: str = DividendKind.DIVIDEND


def format_cnpj(value: str | None) -> str | None:
    """O CNPJ pontuado, venha só com dígitos ou já formatado."""
    if not value:
        return None
    digits = ''.join(character for character in str(value) if character.isdigit())
    if len(digits) != _CNPJ_DIGITS:
        return str(value)
    return f'{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}'


# --- Bens e Direitos ---------------------------------------------------------


@dataclass(frozen=True, kw_only=True)
class AssetsAndRightsItem:
    asset_id: int
    broker_id: int
    group: str
    group_name: str
    code: str
    code_name: str
    country_code: str
    country_name: str
    #: O CNPJ que a ficha pede neste bem, e de quem ele é.
    cnpj: str | None
    cnpj_label: str | None
    #: Só para bens negociados em bolsa.
    ticker: str | None
    traded_on_exchange: bool | None
    discrimination: str
    previous_value: Decimal
    current_value: Decimal
    #: O que conferir antes de digitar: código incerto, CNPJ faltando.
    note: str | None = None


@dataclass(frozen=True)
class _Code:
    group: str
    group_name: str
    code: str
    code_name: str
    note: str | None = None


_SHARES = ('03', 'Participações societárias')
_INVESTMENTS = ('04', 'Aplicações e investimentos')
_FUNDS = ('07', 'Fundos')
_CRYPTO = ('08', 'Criptoativos')


def _code(group: tuple[str, str], code: str, name: str, note: str | None = None) -> _Code:
    return _Code(group[0], group[1], code, name, note)


def _is_fiagro(asset: AssetRecord) -> bool:
    return bool(asset.fund_kind) and 'FIAGRO' in asset.fund_kind.upper()


def _asset_code(asset: AssetRecord, brazilian: bool) -> _Code:  # noqa: PLR0912
    kind = asset.asset_type_id
    if kind in (ASSET_TYPE.FII, ASSET_TYPE.FI) and _is_fiagro(asset):
        return _code(_FUNDS, '02', 'Fiagro')
    if kind == ASSET_TYPE.STOCK:
        return _code(_SHARES, '01', 'Ações (inclusive listadas em bolsa)')
    if kind == ASSET_TYPE.BDR:
        return _code(
            _INVESTMENTS, '04', 'Ativos negociados em bolsa no Brasil (BDRs, opções e outros)'
        )
    if kind == ASSET_TYPE.ETF:
        if not brazilian:
            return _code(
                _FUNDS,
                '99',
                'Fundos de investimento no exterior',
                'ETF no exterior: confira se não vai em Aplicação Financeira no exterior.',
            )
        if asset.etf_segment_id == FIXED_INCOME_ETF_SEGMENT_ID:
            return _code(_FUNDS, '08', 'Fundos de Índice de Renda Fixa')
        return _code(_FUNDS, '06', 'FIP, FIDC e ETF - Entidade de investimento')
    if kind == ASSET_TYPE.REIT:
        return _code(_SHARES, '01', 'Ações', 'REIT no exterior: confira grupo e código.')
    if kind == ASSET_TYPE.FII:
        return _code(_FUNDS, '03', 'Fundo de Investimento Imobiliário (FII)')
    if kind == ASSET_TYPE.FI:
        return _code(
            _FUNDS,
            '01',
            'Fundos sujeitos à tributação periódica (come-cotas)',
            'Sem come-cotas o código é outro: fundo de ações 04, FI-Infra 10, '
            'multimercado do art. 25 da Lei 14.754 13.',
        )
    if kind in (ASSET_TYPE.TREASURY, ASSET_TYPE.CDB):
        return _code(_INVESTMENTS, '02', 'Títulos públicos e privados sujeitos à tributação')
    if kind == ASSET_TYPE.DEB:
        return _code(
            _INVESTMENTS,
            '02',
            'Títulos públicos e privados sujeitos à tributação',
            'Debênture incentivada (de infraestrutura) é isenta: código 03.',
        )
    if kind in (ASSET_TYPE.CRI, ASSET_TYPE.CRA, ASSET_TYPE.LCA):
        return _code(
            _INVESTMENTS, '03', 'Títulos isentos de tributação (LCI, LCA, LCD, CRI, CRA, LIG)'
        )
    if kind == ASSET_TYPE.CRIPTO:
        ticker = (asset.ticker or '').upper()
        if ticker in _BITCOIN:
            return _code(_CRYPTO, '01', 'Criptomoeda Bitcoin (BTC)')
        if ticker in _STABLECOINS:
            return _code(_CRYPTO, '03', 'Stablecoins')
        return _code(_CRYPTO, '02', 'Outras criptomoedas (altcoins)')
    return _code(('99', 'Outros bens e direitos'), '99', 'Outros', 'Confira grupo e código.')


def _cnpj_for(asset: AssetRecord, broker: BrokerRecord) -> tuple[str | None, str | None]:
    kind = asset.asset_type_id
    if kind in (ASSET_TYPE.FII, ASSET_TYPE.ETF, ASSET_TYPE.FI):
        return format_cnpj(asset.fund_cnpj), 'CNPJ do fundo'
    if kind == ASSET_TYPE.STOCK:
        return format_cnpj(asset.issuer_cnpj), 'CNPJ da empresa'
    if kind in (
        ASSET_TYPE.CDB,
        ASSET_TYPE.DEB,
        ASSET_TYPE.CRI,
        ASSET_TYPE.CRA,
        ASSET_TYPE.LCA,
        ASSET_TYPE.TREASURY,
        ASSET_TYPE.CRIPTO,
    ):
        return format_cnpj(broker.cnpj), 'CNPJ da instituição custodiante'
    return None, None


def _quantity(value: Decimal) -> str:
    text = format(value.quantize(Decimal('0.00000001')).normalize(), 'f')
    integer, _, fraction = text.partition('.')
    grouped = f'{int(integer):,}'.replace(',', '.')
    return f'{grouped},{fraction}' if fraction else grouped


def _discrimination(
    asset: AssetRecord, broker: BrokerRecord, quantity: Decimal, brazilian: bool
) -> str:
    ticker = f' ({asset.ticker})' if asset.ticker else ''
    where = f'em custódia na {broker.name}'
    if broker.cnpj:
        where += f', CNPJ {format_cnpj(broker.cnpj)}'
    held = f'{_quantity(quantity)} ' if quantity > 0 else ''
    kind = asset.asset_type_id
    if kind == ASSET_TYPE.STOCK:
        place = 'negociadas na B3' if brazilian else 'negociadas no exterior'
        return f'{held}ações de {asset.name}{ticker}, {place}, {where}.'
    if kind in (ASSET_TYPE.FII, ASSET_TYPE.ETF, ASSET_TYPE.FI):
        return f'{held}cotas de {asset.name}{ticker}, {where}.'
    if kind == ASSET_TYPE.BDR:
        return f'{held}BDRs de {asset.name}{ticker}, negociados na B3, {where}.'
    if kind == ASSET_TYPE.CRIPTO:
        return f'{held}{asset.name}{ticker}, {where}.'
    return f'{asset.name}{ticker}, {where}.'


def assets_and_rights(  # noqa: PLR0913
    *,
    fiscal_year: int,
    trades: Iterable[TaxTrade],
    events: Iterable[CorporateEvent],
    assets: dict[int, AssetRecord],
    brokers: dict[int, BrokerRecord],
    excluded_types: frozenset[int] = frozenset({ASSET_TYPE.PREV}),
) -> tuple[list[AssetsAndRightsItem], list[Pendency]]:
    """Um item por ativo e corretora com posição em algum dos dois 31/12, a custo.

    Bem comprado e vendido dentro do ano também entra, com as duas situações
    zeradas: a declaração relaciona "os bens e direitos adquiridos e alienados
    no decorrer do ano-calendário" (Perguntas e Respostas IRPF 2026).
    """
    trades = tuple(trades)
    events = tuple(events)
    previous = {
        (h.asset_id, h.broker_id): h
        for h in holdings_on(trades, events, date(fiscal_year - 1, 12, 31))
    }
    current = {
        (h.asset_id, h.broker_id): h for h in holdings_on(trades, events, date(fiscal_year, 12, 31))
    }

    traded_in_year = {
        (trade.asset_id, trade.broker_id) for trade in trades if trade.day.year == fiscal_year
    }

    items: list[AssetsAndRightsItem] = []
    pendencies: list[Pendency] = []
    excluded: set[str] = set()
    for key in sorted(previous.keys() | current.keys() | traded_in_year):
        asset_id, broker_id = key
        asset = assets.get(asset_id)
        broker = brokers.get(broker_id)
        if asset is None or broker is None:
            continue
        if asset.asset_type_id in excluded_types:
            excluded.add(asset.ticker or asset.name)
            continue
        brazilian = is_brazilian_market(asset.exchange_code, asset.ticker)
        if asset.asset_type_id == ASSET_TYPE.CRIPTO:
            brazilian = broker.currency_id == CURRENCY.BRL
        elif asset.asset_type_id not in (
            ASSET_TYPE.STOCK,
            ASSET_TYPE.ETF,
            ASSET_TYPE.BDR,
            ASSET_TYPE.REIT,
            ASSET_TYPE.FII,
        ):
            # Renda fixa, Tesouro e fundos não têm praça; o ticker deles é
            # descritivo e não diz nada sobre o país.
            brazilian = True
        code = _asset_code(asset, brazilian)
        cnpj, cnpj_label = _cnpj_for(asset, broker)
        held_now: Holding | None = current.get(key)
        held_before: Holding | None = previous.get(key)
        notes = [code.note] if code.note else []
        if held_now is None and held_before is None:
            notes.append('Comprado e vendido no ano: declare com as duas situações zeradas.')
        if cnpj_label and cnpj is None:
            notes.append(f'{cnpj_label} não está no cadastro: preencha à mão.')
        exchange_traded = asset.asset_type_id in (
            ASSET_TYPE.STOCK,
            ASSET_TYPE.ETF,
            ASSET_TYPE.BDR,
            ASSET_TYPE.FII,
        ) or (asset.asset_type_id == ASSET_TYPE.FI and _is_fiagro(asset))
        country = BRAZIL if brazilian else UNITED_STATES
        if not brazilian and asset.asset_type_id != ASSET_TYPE.CRIPTO:
            notes.append('País pela bolsa do ativo; confira se não é outro que os EUA.')
        items.append(
            AssetsAndRightsItem(
                asset_id=asset_id,
                broker_id=broker_id,
                group=code.group,
                group_name=code.group_name,
                code=code.code,
                code_name=code.code_name,
                country_code=country[0],
                country_name=country[1],
                cnpj=cnpj,
                cnpj_label=cnpj_label,
                ticker=asset.ticker if exchange_traded and brazilian else None,
                traded_on_exchange=True if exchange_traded and brazilian else None,
                discrimination=_discrimination(
                    asset, broker, held_now.quantity if held_now else _ZERO, brazilian
                ),
                previous_value=money(held_before.cost) if held_before else _ZERO,
                current_value=money(held_now.cost) if held_now else _ZERO,
                note=' '.join(notes) or None,
            )
        )

    if excluded:
        pendencies.append(
            Pendency(
                code=PendencyCode.NOT_DECLARED_HERE,
                message=(
                    f'Previdência ({", ".join(sorted(excluded))}) não entra nesta lista: PGBL vai '
                    'em Pagamentos Efetuados e VGBL tem código próprio em Bens e Direitos.'
                ),
            )
        )
    items.sort(key=lambda item: (item.group, item.code, item.discrimination))
    return items, pendencies


# --- Rendimentos -------------------------------------------------------------


@dataclass(frozen=True, kw_only=True)
class IncomeLine:
    """Uma linha de Rendimentos Isentos ou de Tributação Exclusiva."""

    code: str
    code_name: str
    #: Fonte pagadora; nulo nas linhas que o programa não pede por fonte.
    payer_cnpj: str | None
    payer_name: str | None
    amount: Decimal
    note: str | None = None


_EXEMPT_STOCK_GAINS = ('20', 'Ganhos líquidos em ações no mercado à vista até R$ 20.000,00 no mês')
_EXEMPT_SMALL_GAINS = (
    '05',
    'Ganho de capital na alienação de bens de pequeno valor (criptoativos até R$ 35.000,00 no mês)',
)
_EXEMPT_DIVIDENDS = ('09', 'Lucros e dividendos recebidos')
_EXEMPT_FIXED_INCOME = ('12', 'Rendimentos de LCI, LCA, CRI e CRA')
_EXEMPT_OTHER = ('99', 'Outros — rendimentos de FII e Fiagro')
_EXCLUSIVE_JCP = ('10', 'Juros sobre capital próprio')
_EXCLUSIVE_INVESTMENTS = ('06', 'Rendimentos de aplicações financeiras')


def _grouped_income(
    code: tuple[str, str],
    rows: list[tuple[AssetRecord, Decimal]],
    payer: str,
    note: str | None = None,
) -> list[IncomeLine]:
    """Uma linha por fonte pagadora — a empresa, ou o fundo."""
    totals: dict[tuple[str | None, str], Decimal] = defaultdict(lambda: _ZERO)
    for asset, amount in rows:
        cnpj = format_cnpj(asset.issuer_cnpj if payer == 'issuer' else asset.fund_cnpj)
        totals[(cnpj, asset.name)] += amount
    return [
        IncomeLine(
            code=code[0],
            code_name=code[1],
            payer_cnpj=cnpj,
            payer_name=name,
            amount=money(amount),
            note=' '.join(
                part
                for part in (note, None if cnpj else 'CNPJ da fonte pagadora não está no cadastro.')
                if part
            )
            or None,
        )
        for (cnpj, name), amount in sorted(totals.items(), key=lambda item: item[0][1])
        if amount > 0
    ]


def income_lines(  # noqa: PLR0912
    *,
    fiscal_year: int,
    dividends: Iterable[DividendRecord],
    assets: dict[int, AssetRecord],
    months: dict[TaxRegime, tuple[MonthlyAssessment, ...]],
) -> tuple[list[IncomeLine], list[IncomeLine], list[Pendency]]:
    """As linhas de Rendimentos Isentos e de Tributação Exclusiva do ano."""
    exempt_dividends: list[tuple[AssetRecord, Decimal]] = []
    fund_income: list[tuple[AssetRecord, Decimal]] = []
    exempt_fixed_income: list[tuple[AssetRecord, Decimal]] = []
    jcp: list[tuple[AssetRecord, Decimal]] = []
    taxed_fixed_income: list[tuple[AssetRecord, Decimal]] = []
    unplaced: dict[str, Decimal] = defaultdict(lambda: _ZERO)

    for dividend in dividends:
        if dividend.day.year != fiscal_year:
            continue
        asset = assets.get(dividend.asset_id)
        if asset is None:
            continue
        kind = asset.asset_type_id
        brazilian = is_brazilian_market(asset.exchange_code, asset.ticker)
        is_fiagro = (
            kind == ASSET_TYPE.FI and asset.fund_kind and 'FIAGRO' in asset.fund_kind.upper()
        )
        if kind == ASSET_TYPE.STOCK and brazilian:
            if dividend.kind == DividendKind.INTEREST_ON_EQUITY:
                jcp.append((asset, dividend.amount))
            else:
                exempt_dividends.append((asset, dividend.amount))
        elif kind == ASSET_TYPE.FII or is_fiagro:
            fund_income.append((asset, dividend.amount))
        elif kind in (ASSET_TYPE.CRI, ASSET_TYPE.CRA, ASSET_TYPE.LCA):
            exempt_fixed_income.append((asset, dividend.amount))
        elif kind in (ASSET_TYPE.CDB, ASSET_TYPE.DEB, ASSET_TYPE.TREASURY):
            taxed_fixed_income.append((asset, dividend.amount))
        else:
            unplaced[asset.ticker or asset.name] += dividend.amount

    def year_sum(regime: TaxRegime, field: str) -> Decimal:
        return sum((getattr(month, field) for month in months.get(regime, ())), _ZERO)

    exempt: list[IncomeLine] = []
    stock_gains = year_sum(TaxRegime.COMMON, 'exempt_gain')
    if stock_gains > 0:
        exempt.append(
            IncomeLine(
                code=_EXEMPT_STOCK_GAINS[0],
                code_name=_EXEMPT_STOCK_GAINS[1],
                payer_cnpj=None,
                payer_name=None,
                amount=money(stock_gains),
            )
        )
    crypto_gains = year_sum(TaxRegime.CRYPTO, 'exempt_gain')
    if crypto_gains > 0:
        exempt.append(
            IncomeLine(
                code=_EXEMPT_SMALL_GAINS[0],
                code_name=_EXEMPT_SMALL_GAINS[1],
                payer_cnpj=None,
                payer_name=None,
                amount=money(crypto_gains),
            )
        )
    exempt += _grouped_income(_EXEMPT_DIVIDENDS, exempt_dividends, 'issuer')
    exempt += _grouped_income(
        _EXEMPT_FIXED_INCOME,
        exempt_fixed_income,
        'issuer',
        'Fonte pagadora é o emissor do título; confira o CNPJ.',
    )
    exempt += _grouped_income(_EXEMPT_OTHER, fund_income, 'fund')

    exclusive = _grouped_income(_EXCLUSIVE_JCP, jcp, 'issuer', 'Valor líquido, como recebido.')
    exclusive += _grouped_income(
        _EXCLUSIVE_INVESTMENTS,
        taxed_fixed_income,
        'issuer',
        'Juros e cupons lançados como provento, supostos líquidos; o resgate não entra aqui.',
    )

    pendencies = []
    if unplaced:
        listed = ', '.join(sorted(unplaced))
        pendencies.append(
            Pendency(
                code=PendencyCode.NOT_DECLARED_HERE,
                message=(
                    f'Proventos de {listed} não entraram em nenhuma ficha: BDR e ativos no '
                    'exterior são rendimentos do exterior (Lei 14.754/2023), ainda não apurados.'
                ),
            )
        )
    return exempt, exclusive, pendencies


# --- Renda Variável: imposto pago por mês ------------------------------------


def paid_by_regime_month(
    obligations: Iterable[DarfObligation],
) -> dict[tuple[TaxRegime, date], Decimal]:
    """O que foi pago de cada DARF, repartido entre os regimes que ele juntou.

    O programa pede o imposto pago em cada ficha, e um DARF 6015 paga as
    operações comuns e o FII do mesmo mês juntos. A repartição é proporcional
    ao imposto de cada um, sem passar dele.
    """
    paid: dict[tuple[TaxRegime, date], Decimal] = {}
    for obligation in obligations:
        if obligation.paid_principal <= 0:
            continue
        total = sum((amount for _, amount in obligation.by_regime), _ZERO)
        if total <= 0:
            continue
        share = min(obligation.paid_principal, obligation.amount) / obligation.amount
        for regime, amount in obligation.by_regime:
            paid[(regime, obligation.period)] = money(min(amount, amount * share))
    return paid


# --- Ganhos de Capital (cripto, pelo GCAP) -----------------------------------


@dataclass(frozen=True, kw_only=True)
class CapitalGainOperation:
    """Uma alienação de criptoativo tributada, com o que o GCAP pede dela."""

    transaction_id: int
    day: date
    ticker: str
    quantity: Decimal
    sale_value: Decimal
    acquisition_cost: Decimal
    fees: Decimal
    capital_gain: Decimal


def capital_gain_operations(
    sales: Iterable[RealizedSale], months: tuple[MonthlyAssessment, ...]
) -> list[CapitalGainOperation]:
    """As vendas de cripto dos meses que passaram do limite de isenção.

    Nos meses isentos o ganho vai para Rendimentos Isentos (código 05) e não
    para o GCAP.
    """
    taxed_months = {month.month for month in months if not month.within_exemption}
    return [
        CapitalGainOperation(
            transaction_id=sale.transaction_id,
            day=sale.day,
            ticker=sale.ticker,
            quantity=sale.quantity,
            sale_value=money(sale.gross_value),
            acquisition_cost=money(sale.cost),
            fees=money(sale.fees),
            capital_gain=money(max(sale.result, _ZERO)),
        )
        for sale in sales
        if sale.kind == TaxAssetKind.CRYPTO and sale.day.replace(day=1) in taxed_months
    ]
