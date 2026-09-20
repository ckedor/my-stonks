"""What each model costs, in US dollars per million tokens.

Fixed in code and added by a commit, like the wealth-tier ladder and the
laboratory's preset allocations. It is not an admin screen because it is not a
decision: it is what the provider charges, and typing a wrong number here would
make every cost on the usage screen wrong without anything failing.

A model absent from the table costs nothing as far as this table knows, and a
run records zero. Zero reads as "not priced", which is the truth — inventing an
average would put a number nobody was charged into the total.
"""

from dataclasses import dataclass

TOKENS_PER_MILLION = 1_000_000


@dataclass(frozen=True)
class ModelPrice:
    input_per_million: float
    output_per_million: float


MODEL_PRICES: dict[str, ModelPrice] = {
    # OpenAI
    'gpt-4o': ModelPrice(2.50, 10.00),
    'gpt-4o-mini': ModelPrice(0.15, 0.60),
    'gpt-4.1': ModelPrice(2.00, 8.00),
    'gpt-4.1-mini': ModelPrice(0.40, 1.60),
    'gpt-5': ModelPrice(1.25, 10.00),
    'gpt-5-mini': ModelPrice(0.25, 2.00),
    # Anthropic
    'claude-opus-5': ModelPrice(5.00, 25.00),
    'claude-sonnet-5': ModelPrice(3.00, 15.00),
    'claude-haiku-4-5': ModelPrice(1.00, 5.00),
}


def calculate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """What a call cost, or zero when the model is not in the table.

    The lookup falls back to the longest declared prefix of the model name, so
    a dated release such as ``claude-haiku-4-5-20251001`` is priced as the
    family it belongs to instead of silently costing nothing.
    """
    price = MODEL_PRICES.get(model) or _price_by_prefix(model)
    if price is None:
        return 0.0
    return (
        input_tokens * price.input_per_million + output_tokens * price.output_per_million
    ) / TOKENS_PER_MILLION


def _price_by_prefix(model: str) -> ModelPrice | None:
    candidates = [known for known in MODEL_PRICES if model.startswith(known)]
    if not candidates:
        return None
    return MODEL_PRICES[max(candidates, key=len)]
