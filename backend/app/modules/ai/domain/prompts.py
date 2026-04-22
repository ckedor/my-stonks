from dataclasses import dataclass


@dataclass(frozen=True)
class AIPrompt:
    system: str
    prompt: str
    temperature: float
    max_tokens: int
    summary: str


def build_asset_overview_and_news_prompt(ticker: str) -> AIPrompt:
    return AIPrompt(
        system=(
            'Você é um assistente financeiro especializado em ativos do mercado brasileiro e '
            'internacional. Responda sempre em português do Brasil, de forma clara e objetiva, '
            'usando Markdown quando ajudar a leitura.'
        ),
        prompt=f'Explique o que é o ativo {ticker}.',
        temperature=0.2,
        max_tokens=500,
        summary=f'Visão geral do ativo {ticker}',
    )
