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
    ('Pedinte', 25_000.0),
    ('Humilde', 50_000.0),
    ('Humilde 2', 75_000.0),
    ('', 100_000.0),
    ('', 100_000.0),
    # ── Ofício: ter o que fazer ──────────────────────────────────
    ('Lavrador', 15_000.0),
    ('Lenhador', 20_000.0),
    ('Pescador', 30_000.0),
    ('Aprendiz', 40_000.0),
    ('Artesão', 50_000.0),
    ('Ferreiro', 65_000.0),
    ('Feirante', 80_000.0),
    ('Taverneiro', 100_000.0),
    ('Mercador', 125_000.0),
    # ── Aventura: sair da vila ───────────────────────────────────
    ('Escudeiro', 150_000.0),
    ('Batedor', 175_000.0),
    ('Caçador de Recompensas', 200_000.0),
    ('Mercenário', 250_000.0),
    ('Guarda da Cidade', 300_000.0),
    ('Sargento de Armas', 350_000.0),
    ('Cavaleiro Errante', 400_000.0),
    ('Cavaleiro', 450_000.0),
    ('Capitão da Guarda', 500_000.0),
    ('Comandante', 600_000.0),
    # ── Nobreza: mandar em terra ─────────────────────────────────
    ('Senhor de Terras', 700_000.0),
    ('Castelão', 800_000.0),
    ('Barão', 900_000.0),
    ('Visconde', 1_000_000.0),
    ('Conde', 1_150_000.0),
    ('Marquês', 1_300_000.0),
    ('Duque', 1_500_000.0),
    ('Grão-Duque', 1_700_000.0),
    # ── Reino: mandar em gente que manda ─────────────────────────
    ('Príncipe', 1_900_000.0),
    ('Rei', 2_100_000.0),
    ('Alto Rei', 2_300_000.0),
    ('Imperador', 2_500_000.0),
    ('Guardião do Reino', 2_700_000.0),
    ('Senhor da Guerra', 2_900_000.0),
    ('Arquiduque', 3_100_000.0),
    ('Suserano dos Mares', 3_300_000.0),
    # ── Mito: sair da história e entrar na lenda ─────────────────
    ('Imperador dos Mil Vales', 3_500_000.0),
    ('Arquimago', 3_700_000.0),
    ('Oráculo', 3_900_000.0),
    ('Semideus', 4_100_000.0),
    ('Domador de Dragões', 4_300_000.0),
    ('Senhor dos Dragões', 4_500_000.0),
    ('Titã', 4_650_000.0),
    ('Avatar', 4_800_000.0),
    ('Lenda', 4_900_000.0),
    ('Mito Eterno', 5_000_000.0),
)
