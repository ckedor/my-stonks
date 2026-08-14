"""The published HTTP contract, pinned against a versioned snapshot.

The React front consumes this API, so a contract change that nobody meant to
make breaks the UI silently: no test fails, no linter complains, and the schema
only stops matching once a screen renders wrong. Diffing the generated spec
against a committed file turns that into a diff in the pull request.

This is not hypothetical. During the service/API boundary refactor an
annotation correction (`str` defaulting to None) made two query parameters
nullable, and neither the suite nor ruff nor the import linter noticed.

When a change is deliberate, run `task openapi_update` and commit the snapshot
alongside the code that changed it.
"""

import json
from pathlib import Path

import pytest

SNAPSHOT = Path(__file__).parent / 'openapi.json'


def generate_spec() -> dict:
    """The spec as the running application publishes it."""
    from app.entrypoints.http.fastapi_app import create_app

    return create_app().openapi()


def _dump(spec: dict) -> str:
    return json.dumps(spec, indent=1, sort_keys=True, ensure_ascii=False) + '\n'


def _describe(current: dict, snapshot: dict) -> str:
    """Name what moved, so the failure is readable without reading the diff."""
    lines = []

    current_paths = set(current.get('paths', {}))
    snapshot_paths = set(snapshot.get('paths', {}))
    for path in sorted(current_paths - snapshot_paths):
        lines.append(f'  + rota nova: {path}')
    for path in sorted(snapshot_paths - current_paths):
        lines.append(f'  - rota sumiu: {path}')

    current_schemas = set(current.get('components', {}).get('schemas', {}))
    snapshot_schemas = set(snapshot.get('components', {}).get('schemas', {}))
    for name in sorted(current_schemas - snapshot_schemas):
        lines.append(f'  + schema novo: {name}')
    for name in sorted(snapshot_schemas - current_schemas):
        lines.append(f'  - schema sumiu: {name}')

    for path in sorted(current_paths & snapshot_paths):
        if current['paths'][path] != snapshot['paths'][path]:
            lines.append(f'  ~ rota mudou: {path}')
    for name in sorted(current_schemas & snapshot_schemas):
        if current['components']['schemas'][name] != snapshot['components']['schemas'][name]:
            lines.append(f'  ~ schema mudou: {name}')

    return '\n'.join(lines) or '  (mudança fora de paths e schemas)'


@pytest.mark.contract
def test_openapi_matches_snapshot():
    assert SNAPSHOT.exists(), f'Snapshot ausente em {SNAPSHOT}. Gere com: task openapi_update'

    current = generate_spec()
    snapshot = json.loads(SNAPSHOT.read_text())

    assert current == snapshot, (
        'O contrato HTTP publicado mudou.\n\n'
        f'{_describe(current, snapshot)}\n\n'
        'Se foi de propósito, rode `task openapi_update` e commite o snapshot '
        'junto com a mudança. Se não foi, o front quebra sem ninguém perceber.'
    )


if __name__ == '__main__':
    SNAPSHOT.write_text(_dump(generate_spec()))
    print(f'snapshot atualizado: {SNAPSHOT}')
