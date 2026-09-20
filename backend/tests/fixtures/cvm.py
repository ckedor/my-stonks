"""Small regulator files for tests, in the published layouts.

Built from the headers of the real files (checked 2026-09-17) with a handful of
rows, so a test reads what the ingestion reads without downloading megabytes.
"""

import hashlib
import io
import zipfile
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

from app.infra.exceptions import IntegrationUnavailable
from app.infra.integrations.cvm_client import CvmFile, DownloadedFile, NotModified, NotPublished

FUND_HEADER = (
    'ID_Registro_Fundo;CNPJ_Fundo;Codigo_CVM;Data_Registro;Data_Constituicao;Tipo_Fundo;'
    'Denominacao_Social;Data_Cancelamento;Situacao;Data_Inicio_Situacao;Data_Adaptacao_RCVM175;'
    'Data_Inicio_Exercicio_Social;Data_Fim_Exercicio_Social;Patrimonio_Liquido;'
    'Data_Patrimonio_Liquido;Diretor;CNPJ_Administrador;Administrador;Tipo_Pessoa_Gestor;'
    'CPF_CNPJ_Gestor;Gestor'
)
CLASS_HEADER = (
    'ID_Registro_Fundo;ID_Registro_Classe;CNPJ_Classe;Codigo_CVM;Data_Registro;Data_Constituicao;'
    'Data_Inicio;Tipo_Classe;Denominacao_Social;Situacao;Data_Inicio_Situacao;Classificacao;'
    'Indicador_Desempenho;Classe_Cotas;Classificacao_Anbima;Tributacao_Longo_Prazo;'
    'Entidade_Investimento;Permitido_Aplicacao_CemPorCento_Exterior;Classe_ESG;Forma_Condominio;'
    'Exclusivo;Publico_Alvo;Patrimonio_Liquido;Data_Patrimonio_Liquido;CNPJ_Auditor;Auditor;'
    'CNPJ_Custodiante;Custodiante;CNPJ_Controlador;Controlador'
)
SUBCLASS_HEADER = (
    'ID_Registro_Classe;ID_Subclasse;Codigo_CVM;Data_Constituicao;Data_Inicio;Denominacao_Social;'
    'Situacao;Data_Inicio_Situacao;Forma_Condominio;Exclusivo;Publico_Alvo;Previdenciario;'
    'Exclusivo_INR;Exclusivo_Previdencia_Complementar'
)
TERMS_HEADER = (
    'TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DENOM_SOCIAL;DT_COMPTC;CONDOM;TAXA_ADM;TAXA_PERFM;'
    'PARAM_TAXA_PERFM;APLIC_MIN;QT_DIA_CONVERSAO_COTA;QT_DIA_PAGTO_RESGATE'
)
DAILY_HEADER = (
    'TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;'
    'CAPTC_DIA;RESG_DIA;NR_COTST'
)
FIDC_HEADER = (
    'TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DENOM_SOCIAL;DT_COMPTC;TAB_X_CLASSE_SERIE;TAB_X_QT_COTA;'
    'TAB_X_VL_COTA'
)

PLGN_FUND = (
    '13812;55139905000139;224339;2024-05-15;2024-05-13;FIDC;PLGN EQUIPE FIC FIDC;;'
    'Em Funcionamento Normal;2024-06-13;2024-05-15;2026-02-01;2027-01-31;20471867.51;2024-09-30;'
    'GUSTAVO;59281253000123;BTG PACTUAL SERVIÇOS FINANCEIROS S/A DTVM;PJ;43241789000185;'
    'POLÍGONO CAPITAL LTDA'
)
PLGN_CLASS = (
    '13812;31847;55139905000139;9628;2024-05-15;2024-05-13;2024-05-15;'
    'Classes de Cotas de Fundos FIDC;PLGN EQUIPE FIC FIDC;Em Funcionamento Normal;2024-06-13;;;;;;;;N;'
    'Aberto;;;44134147.21;2026-08-31;61366936000125;ERNST & YOUNG;30306294000145;'
    'BANCO BTG PACTUAL S/A;;'
)


def csv_bytes(header: str, *rows: str) -> bytes:
    return '\n'.join([header, *rows, '']).encode('latin-1')


def zipped(members: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def registry_zip(funds: list[str], classes: list[str], subclasses: list[str]) -> bytes:
    return zipped({
        'registro_fundo.csv': csv_bytes(FUND_HEADER, *funds),
        'registro_classe.csv': csv_bytes(CLASS_HEADER, *classes),
        'registro_subclasse.csv': csv_bytes(SUBCLASS_HEADER, *subclasses),
    })


@dataclass
class Published:
    body: bytes
    etag: str


@dataclass
class FakeCvmClient:
    """Serves bodies by path, honours validators, and records what was asked.

    ``failures`` names paths whose download raises, to exercise source errors.
    """

    tmp_path: Path
    files: dict[str, Published] = field(default_factory=dict)
    listings: dict[str, list[CvmFile]] = field(default_factory=dict)
    failures: set[str] = field(default_factory=set)
    requests: list[tuple[str, str | None]] = field(default_factory=list)
    served: list[str] = field(default_factory=list)

    def publish(self, path: str, body: bytes) -> None:
        self.files[path] = Published(body=body, etag=f'"{hashlib.sha256(body).hexdigest()[:16]}"')

    def unpublish(self, path: str) -> None:
        self.files.pop(path, None)

    @asynccontextmanager
    async def download(self, path, *, etag=None, last_modified=None):
        self.requests.append((path, etag))
        if path in self.failures:
            raise IntegrationUnavailable(provider='cvm', status_code=503)
        published = self.files.get(path)
        if published is None:
            yield NotPublished()
            return
        if etag is not None and etag == published.etag:
            yield NotModified()
            return
        self.served.append(path)
        destination = self.tmp_path / f'{len(self.requests)}-{Path(path).name}'
        destination.write_bytes(published.body)
        try:
            yield DownloadedFile(
                path=destination,
                etag=published.etag,
                last_modified=None,
                size_bytes=len(published.body),
                content_version=hashlib.sha256(published.body).hexdigest(),
            )
        finally:
            destination.unlink(missing_ok=True)

    def downloaded(self) -> list[str]:
        """Paths whose body was actually served, in order."""
        return list(self.served)

    async def list_daily_share_value_files(self):
        return self._listing('daily')

    async def list_fidc_monthly_files(self):
        return self._listing('fidc')

    def _listing(self, name):
        return sorted(
            (file for file in self.listings.get(name, []) if file.path in self.files),
            key=lambda file: file.period,
        )

    async def close(self):
        return None


DAILY_DIRECTORY = 'FI/DOC/INF_DIARIO/DADOS'
FIDC_DIRECTORY = 'FIDC/DOC/INF_MENSAL/DADOS'


def daily_path(period: str) -> str:
    return f'{DAILY_DIRECTORY}/inf_diario_fi_{period}.zip'


def fidc_path(period: str) -> str:
    return f'{FIDC_DIRECTORY}/inf_mensal_fidc_{period}.zip'


def publish_daily(client: FakeCvmClient, period: str, rows: list[str]) -> None:
    """``rows`` are ``cnpj;subclass;date;value``."""
    lines = []
    for row in rows:
        cnpj, subclass, day, value = row.split(';')
        lines.append(f'CLASSES - FIF;{cnpj};{subclass};{day};1;{value};1;0;0;1')
    path = daily_path(period)
    client.publish(path, zipped({f'inf_diario_fi_{period}.csv': csv_bytes(DAILY_HEADER, *lines)}))
    _list(client, 'daily', path, period)


def publish_fidc(client: FakeCvmClient, period: str, rows: list[str]) -> None:
    """``rows`` are ``cnpj;date;label;shares;value``."""
    lines = []
    for row in rows:
        cnpj, day, label, shares, value = row.split(';')
        lines.append(f'Classe;{cnpj};FUNDO;{day};{label};{shares};{value}')
    path = fidc_path(period)
    client.publish(
        path, zipped({f'inf_mensal_fidc_tab_X_2_{period}.csv': csv_bytes(FIDC_HEADER, *lines)})
    )
    _list(client, 'fidc', path, period)


def _list(client: FakeCvmClient, listing: str, path: str, period: str) -> None:
    files = client.listings.setdefault(listing, [])
    if all(file.path != path for file in files):
        files.append(CvmFile(path=path, period=period))
