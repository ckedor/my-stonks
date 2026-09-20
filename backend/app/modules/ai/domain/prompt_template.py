"""Rendering a prompt version's template, and the rule that keeps it safe.

A prompt lives in the database so it can be edited without a deploy. The risk
that buys is a template naming something the code does not assemble, which
would only be discovered when a generation failed in front of someone.

So the placeholders a template uses are checked against the keys its feature's
handler declares, at the moment the version is saved. A prompt that would break
at generation cannot be stored — which is what makes editing prompts in a screen
a safe thing to allow.
"""

from string import Formatter
from typing import Any

from app.core.exceptions import ValidationError


def placeholders(template: str) -> frozenset[str]:
    """Every ``{name}`` the template refers to.

    Positional and nested fields are reported by their root name, so
    ``{returns[cagr]}`` counts as a use of ``returns``.
    """
    found: set[str] = set()
    for _, field_name, _, _ in Formatter().parse(template):
        if not field_name:
            continue
        root = field_name.split('.')[0].split('[')[0]
        if root:
            found.add(root)
    return frozenset(found)


def assert_placeholders_known(template: str, known: frozenset[str]) -> None:
    unknown = sorted(placeholders(template) - known)
    if unknown:
        raise ValidationError(
            'O prompt usa dados que a feature não monta: '
            + ', '.join(f'{{{name}}}' for name in unknown)
            + '. Disponíveis: '
            + ', '.join(sorted(known))
        )


def render(template: str, context: dict[str, Any]) -> str:
    missing = sorted(placeholders(template) - context.keys())
    if missing:
        raise ValidationError(
            'O contexto não trouxe: ' + ', '.join(f'{{{name}}}' for name in missing)
        )
    return template.format_map(context)
