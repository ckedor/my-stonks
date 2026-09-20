"""O contexto determinístico e a guarda de citação.

Duas coisas que a v1 não tinha: dado da própria aplicação chegando ao prompt, e
alguma checagem sobre o que o modelo escreveu como sendo da web.
"""

from dataclasses import dataclass, field
from datetime import date

import pytest

from app.infra.ai.provider import Citation
from app.modules.ai.domain.outputs import AssetDescriptionDraft, Source
from app.modules.ai.service.handlers.asset_description_draft import (
    AssetDescriptionDraftHandler,
    AssetDescriptionDraftInput,
)
from app.modules.market_data.domain.assets import (
    FII,
    Asset,
    AssetType,
    Exchange,
    FIISegment,
    FIIType,
    Institution,
    InvestmentFund,
    Stock,
)
from app.modules.market_data.domain.fund_registry import FundRegistry, FundRegistryClass

pytestmark = pytest.mark.unit


@dataclass
class FakeAssetService:
    asset: Asset

    async def get_asset(self, asset_id: int) -> Asset:
        return self.asset


@dataclass
class FakeQuoteService:
    quotes: list = field(default_factory=list)

    async def get_quotes(self, *, asset_ids):
        return [{'quotes': self.quotes}]


def _stock_asset() -> Asset:
    asset = Asset(id=7, ticker='PETR4', name='Petrobras PN', asset_type_id=1)
    asset.asset_type = AssetType(id=1, short_name='Ação', name='Ação', asset_class_id=1)
    asset.exchange = Exchange(id=1, code='B3', name='B3')
    asset.stock = Stock(asset_id=7, country='Brasil', sector='Petróleo', industry='Exploração')
    return asset


def _fii_asset() -> Asset:
    asset = Asset(id=8, ticker='HGLG11', name='CSHG Logística', asset_type_id=2)
    asset.asset_type = AssetType(id=2, short_name='FII', name='Fundo imobiliário', asset_class_id=1)
    segment = FIISegment(id=3, name='Galpões logísticos')
    segment.type = FIIType(id=1, name='Tijolo')
    asset.fii = FII(asset_id=8, segment_id=3, segment=segment)
    return asset


def _handler(asset: Asset, quotes=None) -> AssetDescriptionDraftHandler:
    return AssetDescriptionDraftHandler(
        assets=FakeAssetService(asset), quotes=FakeQuoteService(quotes or [])
    )


async def test_the_context_carries_the_registry_of_a_stock():
    context = await _handler(_stock_asset()).build_context(AssetDescriptionDraftInput(asset_id=7))

    assert context['ticker'] == 'PETR4'
    assert context['asset_type'] == 'Ação'
    assert context['exchange'] == 'B3'
    assert 'Setor: Petróleo' in context['registry_facts']
    assert 'Indústria: Exploração' in context['registry_facts']


async def test_the_context_carries_the_segment_of_a_real_estate_fund():
    context = await _handler(_fii_asset()).build_context(AssetDescriptionDraftInput(asset_id=8))

    assert 'Segmento do FII: Galpões logísticos' in context['registry_facts']
    assert 'Tipo de FII: Tijolo' in context['registry_facts']


async def test_an_asset_with_no_quotes_says_the_numbers_were_not_measured():
    """Um número calculado sobre nada leria como medição."""
    context = await _handler(_stock_asset()).build_context(AssetDescriptionDraftInput(asset_id=7))

    assert 'não medido' in context['performance']


async def test_the_context_offers_exactly_what_a_prompt_may_name():
    context = await _handler(_stock_asset()).build_context(AssetDescriptionDraftInput(asset_id=7))

    assert set(context) == AssetDescriptionDraftHandler.context_keys


def _description(urls: list[str]) -> AssetDescriptionDraft:
    return AssetDescriptionDraft(
        summary='Uma empresa de petróleo.',
        description='Extrai petróleo e sobe.',
        sources=[Source(title='t', url=url) for url in urls],
    )


def test_a_link_the_provider_never_fetched_is_dropped():
    handler = _handler(_stock_asset())
    output = _description(['https://real.example/a', 'https://inventado.example/b'])

    refined = handler.refine(output, (Citation(url='https://real.example/a', title='A'),))

    assert [source.url for source in refined.sources] == ['https://real.example/a']


def test_without_any_citation_nothing_is_presented_as_coming_from_the_web():
    handler = _handler(_stock_asset())
    output = _description(['https://inventado.example/b'])

    refined = handler.refine(output, ())

    assert refined.sources == []
    # O que não veio da web sobrevive: o texto não depende de citação.
    assert refined.summary == 'Uma empresa de petróleo.'


def _fund_asset(*, anbima_category=None, registry_classification=None, linked=True) -> Asset:
    asset = Asset(id=9, ticker=None, name='Icatu Previdência', asset_type_id=6)
    asset.asset_type = AssetType(id=6, short_name='PREV', name='Previdência', asset_class_id=1)
    asset.fund = InvestmentFund(
        asset_id=9,
        legal_id='40679129000192',
        anbima_category=anbima_category,
        fund_registry_class_id=5 if linked else None,
    )
    if linked:
        asset.fund.registry_class = FundRegistryClass(
            registry_id=5,
            fund_registry_id=1,
            cnpj='40679129000192',
            name='Classe',
            anbima_classification=registry_classification,
        )
    return asset


@pytest.mark.parametrize(
    ('asset', 'expected'),
    [
        # A fund typed by hand keeps its typed classification.
        (_fund_asset(anbima_category='Previdência', linked=False), 'Previdência'),
        # The registry left the classification empty: the typed one still stands.
        (_fund_asset(anbima_category='Previdência', registry_classification=None), 'Previdência'),
        # The registry classifies it: that wins over what was typed.
        (
            _fund_asset(
                anbima_category='Previdência',
                registry_classification='Previdência RF Duração Livre Soberano',
            ),
            'Previdência RF Duração Livre Soberano',
        ),
        (_fund_asset(linked=False), 'não informado'),
    ],
)
async def test_a_fund_is_described_with_the_registry_classification_first(asset, expected):
    context = await _handler(asset).build_context(AssetDescriptionDraftInput(asset_id=9))

    assert f'Categoria ANBIMA: {expected}' in context['registry_facts']


def _stock_with_issuer() -> Asset:
    """Uma ação depois que o emissor e o formulário cadastral entraram."""
    asset = _stock_asset()
    asset.institution = Institution(
        id=1,
        cnpj='33000167000101',
        name='Petrobras',
        legal_name='PETRÓLEO BRASILEIRO S.A. - PETROBRAS',
        cvm_code='9512',
    )
    asset.stock.share_class = 'PN'
    asset.stock.listing_segment = 'Nível 2 de Governança Corporativa'
    return asset


async def test_the_context_carries_the_company_behind_a_stock():
    context = await _handler(_stock_with_issuer()).build_context(
        AssetDescriptionDraftInput(asset_id=7)
    )

    facts = context['registry_facts']
    assert 'PETRÓLEO BRASILEIRO S.A. - PETROBRAS' in facts
    assert 'CNPJ do emissor: 33000167000101' in facts
    assert 'Espécie do papel: PN' in facts


async def test_a_linked_fund_carries_its_administrator_and_start_date():
    asset = _fii_asset()
    asset.fii.fund_registry_id = 12
    asset.fii.registry_fund = FundRegistry(
        id=12,
        registry_id=99,
        cnpj='11728688000147',
        name='CSHG LOGÍSTICA FII',
        kind='FII',
        status='Em Funcionamento Normal',
        started_at=date(2010, 5, 6),
        administrator_name='BANCO GENIAL S.A.',
        manager_name='CSHG GESTORA',
    )

    context = await _handler(asset).build_context(AssetDescriptionDraftInput(asset_id=8))

    facts = context['registry_facts']
    assert 'CNPJ do fundo: 11728688000147' in facts
    assert 'Administrador: BANCO GENIAL S.A.' in facts
    assert 'Em funcionamento desde: 2010-05-06' in facts


async def test_a_fund_with_no_registry_link_says_nothing_about_one():
    """Sem vínculo não se inventa administrador: o fato simplesmente não está lá."""
    context = await _handler(_fii_asset()).build_context(AssetDescriptionDraftInput(asset_id=8))

    assert 'Administrador' not in context['registry_facts']
    assert 'CNPJ do fundo' not in context['registry_facts']
