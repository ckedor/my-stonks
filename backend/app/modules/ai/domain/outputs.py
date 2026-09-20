"""The shapes a feature's answer is allowed to have.

These live in code and not in the database, and that is the point. A prompt is
text a person iterates on; a schema is a contract the screen reads. Keeping the
schema here means a card can never be broken by an edit made in the admin, and
it means the schema is reviewed and deployed with the code that renders it.

They are also the first line of correctness, and the cheapest. A field that
does not exist is a sentence the model cannot write: there is no
`recommendation` here, so no amount of prompting produces one in the payload.

Every field is required. Optional information is typed as nullable instead of
defaulted, because strict schema enforcement asks providers to emit every
declared key, and a default would let a missing key pass as a written one.
"""

from pydantic import BaseModel, ConfigDict, Field


class KeyFact(BaseModel):
    model_config = ConfigDict(extra='forbid')

    label: str = Field(description='O que o fato é, em duas ou três palavras')
    value: str = Field(description='O fato, como publicado')
    source_url: str | None = Field(description='De onde veio, quando veio da web')


class Development(BaseModel):
    model_config = ConfigDict(extra='forbid')

    title: str
    summary: str = Field(description='Uma ou duas frases, descritivas')
    url: str
    published_at: str | None = Field(description='Data de publicação em ISO-8601, se houver')
    source: str = Field(description='Nome do veículo ou da fonte')


class Source(BaseModel):
    model_config = ConfigDict(extra='forbid')

    title: str
    url: str


class AssetDescriptionDraft(BaseModel):
    """O rascunho do texto de cadastro de um ativo.

    Ele não é a descrição: é uma proposta que alguém lê, edita e salva. O que
    fica gravado em `asset.summary` e `asset.description` é o que o mantenedor
    salvou, então o texto no cadastro é sempre dele — e é por isso que não
    existe coluna dizendo de onde ele veio.

    Duas granularidades porque duas telas: uma linha de lista não comporta três
    parágrafos, e a página do ativo não se satisfaz com uma frase.
    """

    model_config = ConfigDict(extra='forbid')

    summary: str = Field(
        max_length=300,
        description='Uma frase dizendo o que o ativo é. Cabe num card.',
    )
    description: str = Field(
        description=(
            'O texto da página do ativo, em Markdown: o que o instrumento é, '
            'o que faz, e os fatos de cadastro relevantes. Sem recomendação, '
            'sem preço-alvo e sem juízo sobre estar caro ou barato.'
        )
    )
    sources: list[Source]
