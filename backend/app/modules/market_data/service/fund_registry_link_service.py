"""Ligar um FII ou um ETF ao fundo que o regulador registrou para ele.

O cadastro desses fundos já está no banco: a ingestão semanal do registro da CVM
grava FII e ETF junto com todo o resto, sem filtrar por tipo. O que faltava era
dizer qual fundo registrado é qual ativo — e é isso que este serviço faz.

A CVM não publica código de negociação em arquivo nenhum, então o ticker não
casa com o CNPJ pela fonte oficial. Para FII o provedor resolve: o catálogo dele
devolve o CNPJ dos 539 fundos e a partir daí o fundo é achado por CNPJ. Para
ETF não resolve — o catálogo de fundos do provedor cobre Fiagro, FI-Infra, FIDC
e FIP, e não lista BOVA11 nem IVVB11 — então o ETF é ligado à mão, buscando o
fundo no registro que já está no banco.

Em nenhum dos dois casos o vínculo é gravado sozinho: a sugestão é uma proposta
que alguém confirma. Casar fundo por semelhança de nome foi recusado desde o
plano do cadastro de fundos, e continua recusado aqui.
"""

from dataclasses import dataclass

from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.assets import ETF, FII, Asset
from app.modules.market_data.domain.constants import ASSET_TYPE

#: A tabela de subtipo que guarda o vínculo, por tipo de ativo.
_LINKABLE = {int(ASSET_TYPE.FII): FII, int(ASSET_TYPE.ETF): ETF}


@dataclass(frozen=True)
class LinkSuggestion:
    """Um ativo, e o fundo do registro que o CNPJ do provedor aponta."""

    asset_id: int
    ticker: str
    cnpj: str
    fund_registry_id: int | None
    fund_registry_name: str | None


class FundRegistryLinkService:
    def __init__(self, *, uow: UnitOfWork, fii_market) -> None:
        self.uow = uow
        self.fii_market = fii_market

    async def suggest_fii_links(self) -> dict:
        """As propostas de vínculo para os FIIs que ainda não têm um.

        Só propõe. Um CNPJ que o registro não conhece, ou que aponta para mais
        de um fundo, vem sem sugestão em vez de vir com um palpite.
        """
        market = await self.fii_market.list_market()
        by_asset = {
            fund['asset_id']: fund
            for fund in market['funds']
            if fund.get('asset_id') and fund.get('cnpj')
        }

        async with self.uow as uow:
            linked = await uow.assets.get(FII)
            pending = [
                row for row in linked if row.fund_registry_id is None and row.asset_id in by_asset
            ]
            cnpjs = [by_asset[row.asset_id]['cnpj'] for row in pending]
            funds = await uow.fund_registry.find_funds_by_cnpj(cnpjs)

        by_cnpj: dict[str, list] = {}
        for registry_fund in funds:
            by_cnpj.setdefault(registry_fund.cnpj, []).append(registry_fund)

        suggestions, ambiguous, unknown = [], [], []
        for row in pending:
            fund = by_asset[row.asset_id]
            candidates = by_cnpj.get(fund['cnpj'], [])
            entry = {'asset_id': row.asset_id, 'ticker': fund['ticker'], 'cnpj': fund['cnpj']}
            if len(candidates) == 1:
                suggestions.append({
                    **entry,
                    'fund_registry_id': candidates[0].id,
                    'fund_registry_name': candidates[0].name,
                })
            elif candidates:
                ambiguous.append({
                    **entry,
                    'candidates': [
                        {'id': item.id, 'name': item.name, 'status': item.status}
                        for item in candidates
                    ],
                })
            else:
                unknown.append(entry)

        return {
            'suggestions': suggestions,
            'ambiguous': ambiguous,
            'unknown': unknown,
            'already_linked': sum(1 for row in linked if row.fund_registry_id is not None),
        }

    async def link(self, *, asset_id: int, fund_registry_id: int) -> dict:
        """Confirma o vínculo de um ativo com um fundo do registro."""
        async with self.uow as uow:
            asset = await uow.assets.get(Asset, id=asset_id)
            if asset is None:
                raise ValidationError('Asset not found', context={'asset_id': asset_id})

            model = _LINKABLE.get(asset.asset_type_id)
            if model is None:
                raise ValidationError(
                    'Only a FII or an ETF is linked to the fund registry',
                    context={'asset_id': asset_id, 'asset_type_id': asset.asset_type_id},
                )

            registry_fund = await uow.fund_registry.get_fund(fund_registry_id)
            if registry_fund is None:
                raise ValidationError(
                    'Fund not found in the registry',
                    context={'fund_registry_id': fund_registry_id},
                )

            row = await uow.assets.get(model, by={'asset_id': asset_id}, first=True)
            if row is None:
                # O ETF pode não ter linha de subtipo: o sync de catálogo cria
                # uma vazia, mas um ativo cadastrado à mão pode não ter passado
                # por lá. O FII sempre tem, porque o segmento é obrigatório.
                await uow.assets.create(
                    model,
                    {'asset_id': asset_id, 'fund_registry_id': fund_registry_id},
                )
            else:
                row.fund_registry_id = fund_registry_id
            await uow.commit()

        return {
            'asset_id': asset_id,
            'fund_registry_id': fund_registry_id,
            'cnpj': registry_fund.cnpj,
            'name': registry_fund.name,
        }

    async def apply_suggestions(self, suggestions: list[dict]) -> int:
        """Grava um lote de vínculos já confirmados por quem leu a proposta."""
        applied = 0
        async with self.uow as uow:
            for item in suggestions:
                asset = await uow.assets.get(Asset, id=item['asset_id'])
                model = _LINKABLE.get(asset.asset_type_id) if asset else None
                if model is None:
                    continue
                row = await uow.assets.get(model, by={'asset_id': item['asset_id']}, first=True)
                if row is None:
                    continue
                row.fund_registry_id = item['fund_registry_id']
                applied += 1
            await uow.commit()
        return applied
