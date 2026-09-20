"""The regulator's files about listed companies.

Two files, two jobs. ``cad_cia_aberta.csv`` is the registry of every company
with an open registration: CNPJ, legal name, trade name, CVM code and status.
The registration form (FCA) carries, in its ``valor_mobiliario`` member, the
only tie between a negotiation code and a CNPJ that CVM open data publishes —
without it a ticker cannot be resolved to the company that issued it.

Headers are validated against the files themselves, never against the published
dictionary: a missing column fails the file.
"""

from collections.abc import Iterable, Iterator
from datetime import date
from pathlib import Path

from app.infra.exceptions import IntegrationBadResponse
from app.infra.integrations.cvm_client import (
    PROVIDER,
    company_securities_member,
    iter_csv_rows,
)
from app.modules.market_data.domain.market_scope import is_b3_ticker

COMPANY_COLUMNS = ('CNPJ_CIA', 'DENOM_SOCIAL', 'DENOM_COMERC', 'CD_CVM', 'SIT', 'DT_REG')
SECURITY_COLUMNS = (
    'CNPJ_Companhia',
    'Valor_Mobiliario',
    'Sigla_Classe_Acao_Preferencial',
    'Codigo_Negociacao',
    'Mercado',
    'Segmento',
    'Data_Fim_Negociacao',
    'Data_Referencia',
    'Versao',
)

#: Só as espécies que são participação societária viram ativo. O mesmo arquivo
#: lista debênture e nota comercial, que não têm código de negociação em bolsa
#: e não são o que `asset.stock` guarda.
_SHARE_CLASS_BY_SECURITY = {
    'ações ordinárias': 'ON',
    'ações preferenciais': 'PN',
    'units': 'UNIT',
    'certificados de depósito de ações': 'UNIT',
}

#: A CVM registra a companhia como ativa, e é só isso que o cadastro precisa
#: saber: qualquer outra situação é um registro que não está mais de pé.
_ACTIVE_COMPANY_STATUS = 'ATIVO'


def _text(value: str | None, limit: int | None = None) -> str | None:
    value = (value or '').strip()
    if not value:
        return None
    return value[:limit] if limit else value


def _date(value: str | None) -> date | None:
    value = (value or '').strip()
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def digits(value: str | None) -> str | None:
    """Só os dígitos de um documento, que é como o cadastro os guarda."""
    kept = ''.join(character for character in (value or '') if character.isdigit())
    return kept or None


def _require(member: str, row: dict[str, str], columns: Iterable[str]) -> None:
    missing = [column for column in columns if column not in row]
    if missing:
        raise IntegrationBadResponse(
            f'CVM file member {member} lacks columns {", ".join(missing)}',
            provider=PROVIDER,
        )


CNPJ_LENGTH = 14


def iter_company_rows(path: Path) -> Iterator[dict]:
    """One legal entity per company with a CNPJ the registry states in full.

    A row whose CNPJ is not 14 digits is skipped rather than stored: the CNPJ is
    the identity here, and a partial one would create an entity nothing can
    match later.
    """
    validated = False
    for member, raw in iter_csv_rows(path):
        if not validated:
            _require(member, raw, COMPANY_COLUMNS)
            validated = True
        cnpj = digits(raw['CNPJ_CIA'])
        if cnpj is None or len(cnpj) != CNPJ_LENGTH:
            continue
        legal_name = _text(raw['DENOM_SOCIAL'], 300)
        if legal_name is None:
            continue
        status = _text(raw['SIT'], 40)
        yield {
            'cnpj': cnpj,
            'name': _text(raw['DENOM_COMERC'], 300) or legal_name,
            'legal_name': legal_name,
            'cvm_code': _text(raw['CD_CVM'], 10),
            'country': 'BR',
            'status': status,
            'registered_at': _date(raw['DT_REG']),
            'active': (status or '').upper() == _ACTIVE_COMPANY_STATUS,
        }


def _share_class(raw: dict[str, str]) -> str | None:
    """A espécie do papel, como o arquivo a declara.

    A sigla vem completa quando existe — `PNA`, `ONB` — e é preferida por ser
    mais específica do que a espécie. Sem sigla, a espécie responde.
    """
    sigla = _text(raw['Sigla_Classe_Acao_Preferencial'], 10)
    if sigla:
        return sigla.upper()
    security = (raw['Valor_Mobiliario'] or '').strip().lower()
    return _SHARE_CLASS_BY_SECURITY.get(security)


def iter_security_rows(path: Path) -> Iterator[dict]:
    """One traded security per row: its ticker, its company, its class.

    Rows without a negotiation code are skipped — a debenture or a commercial
    note is in the same file and is not what a ticker resolves to.

    The code is free text and filers abuse it: Marfrig wrote ``ADR``, CSN wrote
    ``4030``, BTG Pactual wrote ``000000``. Anything that is not shaped like a
    B3 ticker is dropped, because a junk value cannot identify an asset and
    could, by coincidence, identify the wrong one.
    """
    validated = False
    for member, raw in iter_csv_rows(path, members=company_securities_member):
        if not validated:
            _require(member, raw, SECURITY_COLUMNS)
            validated = True
        ticker = _text(raw['Codigo_Negociacao'], 30)
        cnpj = digits(raw['CNPJ_Companhia'])
        share_class = _share_class(raw)
        if (
            not ticker
            or not is_b3_ticker(ticker)
            or cnpj is None
            or len(cnpj) != CNPJ_LENGTH
            or share_class is None
        ):
            continue
        yield {
            'ticker': ticker.upper(),
            'cnpj': cnpj,
            'share_class': share_class,
            'listing_segment': _text(raw['Segmento'], 60),
            'market': _text(raw['Mercado'], 60),
            'delisted_at': _date(raw['Data_Fim_Negociacao']),
            'reference_date': _date(raw['Data_Referencia']) or date.min,
            'version': int(_text(raw['Versao']) or 0),
        }


def latest_securities(rows: Iterable[dict]) -> dict[str, dict]:
    """The newest filing for each ticker, across years and form versions.

    A company files the form once a year and revises it, so the same ticker
    appears several times. The reference date orders the years and the version
    orders the revisions within one; without both, an old revision can overwrite
    a newer one depending on the order the rows happen to arrive in.
    """
    newest: dict[str, dict] = {}
    for row in rows:
        current = newest.get(row['ticker'])
        if current is None or (row['reference_date'], row['version']) > (
            current['reference_date'],
            current['version'],
        ):
            newest[row['ticker']] = row
    return newest


def latest_companies(rows: Iterable[dict]) -> list[dict]:
    """One row per CNPJ, preferring the registration that is still open.

    The file repeats rows: 2,677 lines carry 2,530 distinct CNPJs, and the
    duplicates observed are byte-identical. Deduplicating here rather than at
    write time keeps the unique CNPJ a guarantee of the table instead of
    something the caller has to remember.
    """
    kept: dict[str, dict] = {}
    for row in rows:
        current = kept.get(row['cnpj'])
        if current is None or (row['active'] and not current['active']):
            kept[row['cnpj']] = row
    return list(kept.values())
