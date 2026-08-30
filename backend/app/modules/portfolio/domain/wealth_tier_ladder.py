"""A escala de patentes: fixa, em código, e não em tabela.

Ela é arte antes de ser dado. Cada degrau tem um cenário desenhado à mão em
`frontend/src/assets/tiers`, e o cenário só existe porque o degrau existe: a
imagem 17 é do Mercenário e de mais ninguém. Uma tabela editável fazia parecer
que a escala era configurável, quando na prática renomear ou reordenar um
degrau desalinharia a galeria inteira — a linha e o arquivo teriam de mudar
juntos, e só um dos dois estava versionado.

Fixa em código, os dois andam no mesmo commit. É por isso que não há CRUD, nem
tabela, nem migração de conteúdo: acrescentar um degrau é acrescentar uma
linha aqui e o arquivo ao lado dela.

A ordem da tupla é a escala, e a posição de cada degrau nela — contada de zero
— é o que liga o degrau ao seu cenário no front.
"""

from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class WealthTier:
    """Um degrau: uma posição, um título e o patrimônio que o alcança.

    `rank` começa em 1 e é o número do degrau na escala. O limiar está em BRL,
    independente da moeda que a tela mostra: um título que mudasse ao trocar o
    seletor de moeda não seria um título.
    """

    rank: int
    name: str
    threshold: float


def _ladder(*rungs: tuple[str, float]) -> tuple[WealthTier, ...]:
    return tuple(
        WealthTier(rank=index, name=name, threshold=threshold)
        for index, (name, threshold) in enumerate(rungs, start=1)
    )


#: Cinquenta degraus, do mendigo ao mito, terminando em cinco milhões.
#:
#: O desenho da progressão é o do próprio caminho: os primeiros degraus são
#: baratos e frequentes, porque no começo cada dez mil reais muda a vida de
#: quem poupa e a escala precisa devolver esse movimento; do meio em diante os
#: saltos crescem, porque de um milhão para o seguinte o que muda é o tempo, e
#: não o esforço. Os títulos acompanham: ofício, aventura, nobreza, reino,
#: mito — cada bloco de degraus é um capítulo, e a virada de bloco é onde o
#: cenário muda de mundo.
LADDER: tuple[WealthTier, ...] = _ladder(
    # ── Miséria: sobreviver ──────────────────────────────────────
    ('Miserável', 0.0),
    ('Pedinte', 50_000.0),
    ('Sobrevivendo', 100_000.0),
    ('Camponês', 150_000.0),
    ('Fazendeiro', 200_000.0),
    ('Escudeiro', 250_000.0),
    ('Cavaleiro Andante', 300_000.0),
    ('Infantaria', 350_000.0),
    ('General do Exército', 400_000.0),
    ('Conde', 450_000.0),
    ('Duque', 500_000.0),
    ('Rei', 750_000.0),
    ('Imperador', 1_000_000.0),
    ('Conquistador', 2_000_000.0),
    ('Deus', 5_000_000.0),
)
