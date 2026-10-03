from collections import defaultdict
from dataclasses import asdict, replace
from datetime import date

from app.core.exceptions import ConflictError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.lib.utils.files import unreadable_pdf_reason
from app.modules.market_data.domain.constants import CURRENCY_MAP
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from app.modules.portfolio.adapters.brokerage_note_extractor import BrokerageNoteExtractor
from app.modules.portfolio.domain.brokerage_note import (
    AssetMatch,
    BrokerageNoteDraft,
    DraftLine,
    DraftNote,
    GroupAction,
    GroupDecision,
    ImportResult,
    LineRef,
    NoteAmounts,
    NoteHeader,
    NoteLine,
    NoteWarning,
    ReconciliationGroup,
    allocate_costs,
    asset_from_imported_note,
    check_note,
    fund_key,
    isin_key,
    line_isin,
    line_ticker,
    match_broker,
    match_by_name,
    name_search_words,
    note_costs,
    only_digits,
    reconcile,
)
from app.modules.portfolio.domain.document import DocumentKind
from app.modules.portfolio.domain.entities import BrokerageNote, Transaction
from app.modules.portfolio.domain.outputs import BrokerageNoteReading
from app.modules.portfolio.service.portfolio_document_service import PortfolioDocumentService

STALE_MESSAGE = 'As transações da carteira mudaram desde que a nota foi lida. Leia a nota de novo.'


class BrokerageNoteImportService:
    """Lê notas de corretagem, mostra o que cada uma faria na carteira, e só então faz.

    A leitura guarda o PDF enviado e mais nada; o cruzamento não escreve. Cada
    nota se confirma sozinha:
    a escrita recebe a nota, as linhas e as decisões da pessoa, refaz o
    cruzamento contra a carteira de agora e recusa se ele não for o mesmo que
    ela viu — decidir sobre uma tela velha apagaria transação que ninguém
    conferiu. Confirmar grava a nota, liga a ela as transações que criou ou
    completou, e a liga ao documento de onde foi lida.
    """

    def __init__(
        self,
        uow: UnitOfWork,
        extractor: BrokerageNoteExtractor,
        usd_brl_service: UsdBrlReadService,
        documents: PortfolioDocumentService,
    ):
        self.uow = uow
        self.extractor = extractor
        self.usd_brl_service = usd_brl_service
        self.documents = documents

    async def extract(
        self, *, portfolio_id: int, filename: str, content: bytes
    ) -> BrokerageNoteDraft:
        if reason := unreadable_pdf_reason(filename=filename, content=content):
            raise ValidationError(reason)
        # Antes do modelo: o arquivo foi enviado, e fica guardado mesmo que a
        # leitura falhe ou que nenhuma nota dele venha a ser confirmada.
        document_id = await self.documents.store(
            portfolio_id=portfolio_id,
            kind=DocumentKind.BROKERAGE_NOTE,
            filename=filename,
            content=content,
        )
        reading, model = await self.extractor.extract(filename=filename, content=content)
        if not reading.notes:
            raise ValidationError(f'Nenhuma nota de corretagem encontrada em {filename}.')

        tickers = sorted({
            ticker
            for note in reading.notes
            for line in note.lines
            if (ticker := line_ticker(line.ticker, line.security, note.currency))
        })
        isins = sorted({
            isin for note in reading.notes for line in note.lines if (isin := line_isin(line.isin))
        })
        fund_cnpjs = sorted({
            cnpj
            for note in reading.notes
            for line in note.lines
            if (cnpj := only_digits(line.fund_cnpj))
        })
        async with self.uow as uow:
            assets = await uow.assets.get_by_tickers(tickers)
            by_isin = await uow.assets.get_by_isins(isins)
            brokers = await uow.portfolios.list_brokers()

            candidates: dict[str, list] = defaultdict(list)
            for asset in assets:
                if asset.ticker:
                    candidates[asset.ticker.upper()].append(asset)
            for asset in by_isin:
                candidates[isin_key(asset.isin)].append(asset)
            for cnpj, funds in (await self._funds_by_cnpj(uow, fund_cnpjs)).items():
                candidates[fund_key(cnpj)].extend(funds)
            notes = [
                self._draft_note(index, note, brokers, candidates)
                for index, note in enumerate(reading.notes)
            ]
            imported = [
                await uow.portfolios.find_brokerage_note(
                    portfolio_id, note.broker_id, note.note_number, note.trade_date
                )
                if note.broker_id
                else None
                for note in notes
            ]
            notes = [
                await self._match_open_lines(uow, note, previous)
                for note, previous in zip(notes, imported, strict=True)
            ]
            all_lines = [line for note in notes for line in self._note_lines(note)]
            existing = await self._existing(uow, portfolio_id, all_lines)

        return BrokerageNoteDraft(
            notes=tuple(
                self._with_reconciliation(note, existing, previous)
                for note, previous in zip(notes, imported, strict=True)
            ),
            model=model,
            document_id=document_id,
        )

    @staticmethod
    async def _match_open_lines(uow, note: DraftNote, previous) -> DraftNote:
        """As linhas que o código, o ISIN e o CNPJ não acharam.

        Primeiro a nota já importada: a mesma execução nela traz o ativo que
        alguém já escolheu. Depois o nome, para uma linha que nenhum ativo
        acha — e só como sugestão, que a pessoa confere antes de salvar.
        """
        open_lines = [line for line in note.lines if line.match != AssetMatch.MATCHED]
        if not open_lines:
            return note
        done = await uow.portfolios.list_note_transactions(previous.id) if previous else []
        from_note = {
            line.index: asset_id
            for line in open_lines
            if (asset_id := asset_from_imported_note(line, note.currency, done)) is not None
        }
        unknown = [
            line
            for line in open_lines
            if line.index not in from_note and line.match == AssetMatch.UNKNOWN
        ]
        pool = await uow.assets.find_by_name_words(
            sorted({word for line in unknown for word in name_search_words(line.security)})
        )
        by_name = {
            line.index: asset
            for line in unknown
            if (asset := match_by_name(line.security, pool)) is not None
        }
        names = {
            asset.id: asset.name
            for asset in await uow.assets.get_by_ids(sorted(set(from_note.values())))
        }

        def matched(line: DraftLine) -> DraftLine:
            if line.index in from_note:
                asset_id = from_note[line.index]
                return replace(
                    line,
                    asset_id=asset_id,
                    asset_name=names.get(asset_id),
                    match=AssetMatch.IMPORTED,
                )
            if line.index in by_name:
                asset = by_name[line.index]
                return replace(
                    line, asset_id=asset.id, asset_name=asset.name, match=AssetMatch.BY_NAME
                )
            return line

        return replace(note, lines=tuple(matched(line) for line in note.lines))

    async def reconcile(
        self, *, portfolio_id: int, lines: list[NoteLine]
    ) -> list[ReconciliationGroup]:
        """O cruzamento de novo, para quando a pessoa escolhe um ativo ou a corretora."""
        async with self.uow as uow:
            existing = await self._existing(uow, portfolio_id, lines)
        return reconcile(lines, existing)

    async def apply(
        self,
        *,
        portfolio_id: int,
        note: NoteHeader,
        lines: list[NoteLine],
        decisions: list[GroupDecision],
    ) -> ImportResult:
        if note.broker_id is None:
            raise ValidationError('Escolha a corretora da nota antes de confirmar.')
        if any(line.broker_id != note.broker_id for line in lines):
            raise ValidationError('Todas as linhas precisam ser da corretora da nota.')
        if any(line.currency != note.currency for line in lines):
            raise ValidationError('Todas as linhas precisam estar na moeda da nota.')

        by_ref = {(line.note_index, line.line_index): line for line in lines}
        async with self.uow as uow:
            broker = next(
                (b for b in await uow.portfolios.list_brokers() if b.id == note.broker_id), None
            )
            if broker is None:
                raise ValidationError('Corretora não encontrada.')
            # O preço gravado sai da moeda da nota; a da corretora é a que a
            # carteira usa para ler a transação. As duas precisam ser a mesma.
            if broker.currency_id != CURRENCY_MAP[note.currency]:
                raise ValidationError(
                    f'{broker.name} opera em outra moeda; a nota é em {note.currency}.'
                )
            if note.document_id is not None and (
                await uow.portfolios.get_document(portfolio_id, note.document_id) is None
            ):
                raise ValidationError('O documento da nota não é desta carteira.')
            existing = await self._existing(uow, portfolio_id, lines)
            groups = {group.key: group for group in reconcile(lines, existing)}
            chosen = [self._checked(decision, groups) for decision in decisions]
            to_create = [
                by_ref[(ref.note_index, ref.line_index)]
                for group, action in chosen
                if action in (GroupAction.CREATE, GroupAction.REPLACE)
                for ref in group.lines
            ]
            rates = await self._rates({line.trade_date for line in to_create})

            note_id = await self._save_note(uow, portfolio_id, note)
            updated = deleted = 0
            asset_ids: set[int] = set()
            for group, action in chosen:
                if action == GroupAction.SKIP:
                    continue
                asset_ids.add(group.asset_id)
                if action == GroupAction.UPDATE:
                    await uow.portfolios.update(
                        Transaction,
                        [
                            self._note_fields(update.transaction_id, by_ref, update.line, note_id)
                            for update in group.updates
                        ],
                    )
                    updated += len(group.updates)
                elif action == GroupAction.REPLACE:
                    for transaction_id in group.existing_ids:
                        await uow.portfolios.delete(Transaction, id=transaction_id)
                    deleted += len(group.existing_ids)
            if to_create:
                await uow.portfolios.create(
                    Transaction,
                    [self._transaction(portfolio_id, line, rates, note_id) for line in to_create],
                )
            await uow.commit()

        return ImportResult(
            note_id=note_id,
            created=len(to_create),
            updated=updated,
            deleted=deleted,
            asset_ids=tuple(sorted(asset_ids)),
        )

    async def list_notes(self, portfolio_id: int) -> list[dict]:
        async with self.uow as uow:
            return await uow.portfolios.list_brokerage_notes(portfolio_id)

    @staticmethod
    async def _save_note(uow, portfolio_id: int, note: NoteHeader) -> int:
        """Grava a nota, ou atualiza a que já tem a mesma corretora e número."""
        fields = {
            'portfolio_id': portfolio_id,
            'broker_id': note.broker_id,
            'currency': note.currency,
            'note_number': note.note_number,
            'trade_date': note.trade_date,
            'settlement_date': note.settlement_date,
            **asdict(note.amounts),
        }
        # Uma nota conferida sem documento não apaga o vínculo que já tinha.
        if note.document_id is not None:
            fields['document_id'] = note.document_id
        previous = await uow.portfolios.find_brokerage_note(
            portfolio_id, note.broker_id, note.note_number, note.trade_date
        )
        if previous is not None:
            await uow.portfolios.update(BrokerageNote, {'id': previous.id, **fields})
            return previous.id
        (note_id,) = await uow.portfolios.create(BrokerageNote, fields)
        return note_id

    @staticmethod
    def _checked(
        decision: GroupDecision, groups: dict[str, ReconciliationGroup]
    ) -> tuple[ReconciliationGroup, GroupAction]:
        group = groups.get(decision.key)
        if group is None or set(group.existing_ids) != set(decision.existing_ids):
            raise ConflictError(STALE_MESSAGE, context={'group': decision.key})
        if decision.action not in group.actions:
            raise ValidationError(
                f'A ação {decision.action} não se aplica a este grupo ({group.status}).',
                context={'group': decision.key},
            )
        return group, decision.action

    @staticmethod
    async def _existing(uow, portfolio_id: int, lines: list[NoteLine]) -> list[Transaction]:
        asset_ids = sorted({line.asset_id for line in lines if line.asset_id is not None})
        if not asset_ids:
            return []
        until = max(line.trade_date for line in lines)
        return await uow.portfolios.get_asset_transactions_until(portfolio_id, asset_ids, until)

    async def _rates(self, dates: set[date]) -> dict[date, tuple[float, float]]:
        """(usd_brl, brl_usd) em vigor em cada dia."""
        rates = {}
        for day in sorted(dates):
            rate = await self.usd_brl_service.get_rate_on_or_before(day)
            rates[day] = (float(rate.usd_brl), float(rate.brl_usd))
        return rates

    @staticmethod
    def _transaction(
        portfolio_id: int,
        line: NoteLine,
        rates: dict[date, tuple[float, float]],
        note_id: int,
    ) -> dict:
        # `price` é sempre em reais e `price_usd` em dólar, como no lançamento
        # manual: a moeda da nota diz qual dos dois ela imprime, e o outro sai
        # da taxa do dia. Custos e IRRF ficam na moeda da nota.
        usd_brl, brl_usd = rates[line.trade_date]
        if line.currency == 'USD':
            price, price_usd = line.price * usd_brl, line.price
        else:
            price, price_usd = line.price, line.price * brl_usd
        return {
            'portfolio_id': portfolio_id,
            'asset_id': line.asset_id,
            'broker_id': line.broker_id,
            'date': line.trade_date,
            'quantity': line.signed_quantity,
            'price': price,
            'price_usd': price_usd,
            'settlement_date': line.settlement_date,
            'fees': line.fees,
            'withheld_income_tax': line.withheld_income_tax,
            'brokerage_note_id': note_id,
        }

    @staticmethod
    def _note_fields(
        transaction_id: int,
        by_ref: dict[tuple[int, int], NoteLine],
        ref: LineRef,
        note_id: int,
    ) -> dict:
        line = by_ref[(ref.note_index, ref.line_index)]
        return {
            'id': transaction_id,
            'settlement_date': line.settlement_date,
            'fees': line.fees,
            'withheld_income_tax': line.withheld_income_tax,
            'brokerage_note_id': note_id,
        }

    @classmethod
    def _with_reconciliation(
        cls,
        note: DraftNote,
        existing: list[Transaction],
        previous: BrokerageNote | None,
    ) -> DraftNote:
        return replace(
            note,
            groups=tuple(reconcile(cls._note_lines(note), existing)),
            imported_note_id=previous.id if previous else None,
            imported_at=previous.imported_at if previous else None,
        )

    @staticmethod
    def _note_lines(note: DraftNote) -> list[NoteLine]:
        return [
            NoteLine(
                note_index=note.index,
                line_index=line.index,
                broker_id=note.broker_id,
                asset_id=line.asset_id,
                trade_date=note.trade_date,
                settlement_date=note.settlement_date,
                side=line.side,
                quantity=line.quantity,
                price=line.price,
                fees=line.fees,
                withheld_income_tax=line.withheld_income_tax,
                currency=note.currency,
            )
            for line in note.lines
        ]

    @classmethod
    def _draft_note(
        cls,
        index: int,
        reading: BrokerageNoteReading,
        brokers: list,
        candidates: dict[str, list],
    ) -> DraftNote:
        warnings = list(check_note(reading))
        broker = match_broker(brokers, reading.broker_cnpj, reading.broker_name)
        broker_id = None
        if broker is None:
            warnings.append(
                NoteWarning(
                    code='broker_unknown',
                    message=(
                        f'Nenhuma corretora cadastrada casa com {reading.broker_name}'
                        f'{f" (CNPJ {reading.broker_cnpj})" if reading.broker_cnpj else ""}. '
                        'Escolha a corretora.'
                    ),
                )
            )
        elif broker.currency_id != CURRENCY_MAP[reading.currency]:
            warnings.append(
                NoteWarning(
                    code='broker_currency',
                    message=(
                        f'{broker.name} opera em outra moeda; a nota é em {reading.currency}. '
                        'Escolha a corretora.'
                    ),
                )
            )
        else:
            broker_id = broker.id

        costs = allocate_costs(reading)
        lines = tuple(
            cls._draft_line(
                line_index,
                line,
                costs[line_index],
                candidates,
                line_ticker(line.ticker, line.security, reading.currency),
                line_isin(line.isin),
            )
            for line_index, line in enumerate(reading.lines)
        )
        return DraftNote(
            index=index,
            broker_name=reading.broker_name,
            broker_cnpj=reading.broker_cnpj,
            broker_id=broker_id,
            currency=reading.currency,
            note_number=reading.note_number,
            trade_date=reading.trade_date,
            settlement_date=reading.settlement_date,
            amounts=NoteAmounts.read_from(reading),
            fees=note_costs(reading),
            warnings=tuple(warnings),
            lines=lines,
            groups=(),
        )

    @staticmethod
    async def _funds_by_cnpj(uow: UnitOfWork, cnpjs: list[str]) -> dict[str, list]:
        """Os fundos cadastrados de cada CNPJ lido.

        Um fundo não tem código de negociação: o que o extrato imprime é o CNPJ.
        Ele casa com o CNPJ gravado no próprio fundo ou com o da classe a que o
        fundo está ligado — o gravado vale mesmo quando o vínculo com a classe
        falta, ou aponta para o fundo master de um FIC.
        """
        if not cnpjs:
            return {}
        asset_ids: dict[str, set[int]] = defaultdict(set)
        for fund in await uow.fund_registry.find_funds_by_legal_id(cnpjs):
            asset_ids[fund.legal_id].add(fund.asset_id)
        for fund_class in await uow.fund_registry.find_classes_by_cnpj(cnpjs):
            for unit in await uow.fund_registry.list_class_units(fund_class.id):
                asset_ids[fund_class.cnpj].add(unit.asset_id)
        assets = {
            asset.id: asset
            for asset in await uow.assets.get_by_ids(
                sorted({i for ids in asset_ids.values() for i in ids})
            )
        }
        return {
            cnpj: [assets[i] for i in sorted(ids) if i in assets] for cnpj, ids in asset_ids.items()
        }

    @staticmethod
    def _draft_line(index, line, costs, candidates, ticker, isin) -> DraftLine:  # noqa: PLR0913
        fees, tax = costs
        # O código primeiro; sem ele, ou sem ativo que o carregue, o ISIN — o
        # de um ETF de Londres, que o cadastro chama de EXUS.L; e o fundo, que
        # não tem código, pelo CNPJ que o extrato imprime.
        keys = (ticker, isin_key(isin), fund_key(only_digits(line.fund_cnpj)))
        matches = next((candidates[key] for key in keys if key and candidates.get(key)), [])
        if len(matches) == 1:
            match, asset_id, asset_name = AssetMatch.MATCHED, matches[0].id, matches[0].name
        elif matches:
            match, asset_id, asset_name = AssetMatch.AMBIGUOUS, None, None
        else:
            match, asset_id, asset_name = AssetMatch.UNKNOWN, None, None
        return DraftLine(
            index=index,
            side=line.side,
            market=line.market,
            security=line.security,
            ticker=ticker,
            isin=isin,
            quantity=abs(line.quantity),
            price=abs(line.price),
            value=abs(line.value),
            fees=fees,
            withheld_income_tax=tax,
            asset_id=asset_id,
            asset_name=asset_name,
            match=match,
        )
