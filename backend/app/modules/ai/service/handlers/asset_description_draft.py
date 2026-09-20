from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.infra.ai.provider import Citation
from app.modules.ai.domain.enums import AIFeatureKey
from app.modules.ai.domain.outputs import AssetDescriptionDraft
from app.modules.ai.domain.performance import summarize_performance
from app.modules.ai.service.handlers.base import AIFeatureHandler
from app.modules.market_data.domain.assets import Asset

UNKNOWN = 'não informado'
NOT_MEASURED = 'não medido'


class AssetDescriptionDraftInput(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

    asset_id: int


class AssetDescriptionDraftHandler(AIFeatureHandler[AssetDescriptionDraftInput]):
    """O rascunho do texto de cadastro de um ativo.

    Roda quando alguém pede, na tela do ativo, e o resultado vai para o
    formulário — não para o banco. Quem grava é quem salva.

    Não tem execução agendada de propósito. Gerar para o cadastro inteiro
    pagaria por ativo que ninguém abre, e a maior parte do cadastro nunca é
    aberta. O input é o ativo e nada mais: a descrição é o mesmo fato para
    quem quer que a leia, e a posição de quem lê não entra nela.
    """

    feature_key = AIFeatureKey.ASSET_DESCRIPTION_DRAFT
    input_model = AssetDescriptionDraftInput
    output_model = AssetDescriptionDraft
    schema_version = 1
    context_keys = frozenset({
        'ticker',
        'name',
        'asset_type',
        'exchange',
        'registry_facts',
        'performance',
        'today',
    })

    def __init__(self, *, assets, quotes):
        #: Read services, injected by the composition root. The AI module never
        #: reaches another module's repositories — the import contract forbids
        #: it, and the laboratory already reads market data this way.
        self.assets = assets
        self.quotes = quotes

    async def build_context(self, input: AssetDescriptionDraftInput) -> dict[str, Any]:
        asset: Asset = await self.assets.get_asset(input.asset_id)
        entries = await self.quotes.get_quotes(asset_ids=[input.asset_id])
        quotes = entries[0]['quotes'] if entries else []

        return {
            'ticker': asset.ticker or UNKNOWN,
            'name': asset.name,
            'asset_type': asset.asset_type.short_name if asset.asset_type else UNKNOWN,
            'exchange': asset.exchange.name if asset.exchange else UNKNOWN,
            'registry_facts': self._registry_facts(asset),
            'performance': self._performance(quotes),
            'today': datetime.now(UTC).date().isoformat(),
        }

    def refine(self, output: BaseModel, citations: tuple[Citation, ...]) -> BaseModel:
        """Drop every link the provider did not actually fetch.

        Schema enforcement guarantees a `url` field exists and says nothing
        about whether the page does. The citations are the pages the web search
        really returned, so anything outside them is a URL the model wrote from
        memory — which is exactly the kind of plausible, checkable-looking
        detail that a description must not carry.
        """
        if not isinstance(output, AssetDescriptionDraft):
            return output
        fetched = {citation.url for citation in citations}
        return output.model_copy(
            update={'sources': [source for source in output.sources if source.url in fetched]}
        )

    @staticmethod
    def _registry_facts(asset: Asset) -> str:
        """O que a aplicação já sabe deste instrumento.

        Vai para o prompt como texto que o modelo é instruído a preferir ao que
        encontrar na web, para que uma página desatualizada sobre o segmento de
        um fundo não sobrescreva o cadastro.

        Desde que o emissor e o cadastro do regulador entraram, esta lista deixa
        de ser três linhas: uma ação traz a companhia com CNPJ e a espécie do
        papel, e um FII ou ETF traz administrador, gestor e data de início.
        """
        facts: list[str] = []
        if asset.institution:
            facts.append(f'Emissor: {asset.institution.legal_name}')
            facts.append(f'CNPJ do emissor: {asset.institution.cnpj}')
        if asset.stock:
            facts.append(f'País: {asset.stock.country or UNKNOWN}')
            facts.append(f'Setor: {asset.stock.sector or UNKNOWN}')
            facts.append(f'Indústria: {asset.stock.industry or UNKNOWN}')
            if asset.stock.share_class:
                facts.append(f'Espécie do papel: {asset.stock.share_class}')
            if asset.stock.listing_segment:
                facts.append(f'Segmento de listagem: {asset.stock.listing_segment}')
        if asset.fii and asset.fii.segment:
            segment = asset.fii.segment
            facts.append(f'Segmento do FII: {segment.name}')
            if segment.type:
                facts.append(f'Tipo de FII: {segment.type.name}')
        if asset.etf and asset.etf.segment:
            facts.append(f'Segmento do ETF: {asset.etf.segment.name}')
        facts.extend(AssetDescriptionDraftHandler._fund_facts(asset))
        if asset.fund:
            facts.append(f'CNPJ: {asset.fund.legal_id or UNKNOWN}')
            facts.append(f'Categoria ANBIMA: {asset.fund.anbima_classification() or UNKNOWN}')
        return '\n'.join(f'- {fact}' for fact in facts) if facts else '- (sem dados de cadastro)'

    @staticmethod
    def _fund_facts(asset: Asset) -> list[str]:
        """O cadastro do regulador, quando o FII ou o ETF está ligado a ele."""
        registry = None
        if asset.fii is not None:
            registry = asset.fii.registry_fund
        elif asset.etf is not None:
            registry = asset.etf.registry_fund
        if registry is None:
            return []
        facts = [f'CNPJ do fundo: {registry.cnpj}', f'Razão social: {registry.name}']
        if registry.administrator_name:
            facts.append(f'Administrador: {registry.administrator_name}')
        if registry.manager_name:
            facts.append(f'Gestor: {registry.manager_name}')
        if registry.started_at:
            facts.append(f'Em funcionamento desde: {registry.started_at.isoformat()}')
        if registry.status:
            facts.append(f'Situação no registro: {registry.status}')
        return facts

    @staticmethod
    def _performance(quotes: list[dict]) -> str:
        summary = summarize_performance(quotes).as_prompt_dict()
        labels = {
            'first_date': 'Primeira cotação',
            'last_date': 'Última cotação',
            'last_close': 'Último fechamento',
            'return_12m_pct': 'Retorno em 12 meses (%)',
            'cagr_pct': 'Retorno anualizado desde o início (%)',
            'volatility_pct': 'Volatilidade anualizada (%)',
            'max_drawdown_pct': 'Maior queda acumulada (%)',
        }
        lines = [
            f'- {label}: {summary[key] if summary[key] is not None else NOT_MEASURED}'
            for key, label in labels.items()
        ]
        return '\n'.join(lines)
