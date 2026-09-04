from dataclasses import dataclass

#: Room for a report with fifty lines, each carrying a sentence of rationale.
#: A recommended-portfolio PDF that needs more than this is not one.
EXTRACTION_MAX_TOKENS = 8000

_SYSTEM = (
    'Você lê relatórios de casas de análise brasileiras e extrai deles a carteira '
    'recomendada. Você transcreve o que o relatório diz, e nada além disso: não '
    'estima peso que não está escrito, não completa carteira que veio incompleta e '
    'não opina sobre os ativos. Um campo que o relatório não traz é omitido.'
)

_INSTRUCTIONS = """\
Extraia a carteira recomendada deste relatório e responda com um único objeto JSON,
sem texto em volta e sem cercas de código.

O objeto tem estes campos:

- `source_name`: a casa que publicou o relatório, como ela se nomeia na capa
  (por exemplo "BTG Pactual", "XP Research"). Omita se não estiver no documento.
- `title`: o nome da carteira, como o relatório a chama (por exemplo "Carteira
  Recomendada de FIIs"). Não invente um título a partir do nome do arquivo.
- `reference_date`: o mês a que a carteira se refere, no formato `YYYY-MM-DD`.
  Use o primeiro dia do mês quando o relatório indicar apenas mês e ano. É a
  competência da carteira, não a data de impressão do documento.
- `summary`: em até 5 frases, o que o relatório diz sobre o cenário e sobre as
  mudanças desta edição. Em português.
- `objective`: o objetivo declarado da carteira — o que ela busca e para quem é.
  Só preencha se o relatório declarar isso; omita se não declarar.
- `positions`: uma entrada por ativo da carteira recomendada.

Cada entrada de `positions` tem:

- `ticker`: o código de negociação, em maiúsculas, sem espaços.
- `name`: o nome do ativo como o relatório escreve, se ele escrever.
- `weight`: o peso na carteira, em porcentagem, como número (5.5, não "5,5%").
- `target_price`: o preço-alvo em reais, como número, se o relatório trouxer.
- `rationale`: em uma ou duas frases, a tese do relatório para aquele ativo.
- `change`: o que esta edição fez com a linha, e apenas um destes valores:
  `entered` (entrou agora), `increased` (aumentou o peso), `reduced` (reduziu o
  peso), `unchanged` (o relatório diz que manteve), `exited` (saiu da carteira).
  Omita o campo quando o relatório não disser nada a respeito — não deduza pela
  ausência.

Inclua apenas os ativos que compõem a carteira recomendada. Tabelas de
acompanhamento, listas de observação e comparativos de índice não entram.
"""


@dataclass(frozen=True)
class ExtractionPrompt:
    system: str
    prompt: str
    temperature: float
    max_tokens: int


def build_recommended_portfolio_extraction_prompt() -> ExtractionPrompt:
    return ExtractionPrompt(
        system=_SYSTEM,
        prompt=_INSTRUCTIONS,
        # Transcription, not writing: the same PDF read twice should give the
        # same weights.
        temperature=0.0,
        max_tokens=EXTRACTION_MAX_TOKENS,
    )
