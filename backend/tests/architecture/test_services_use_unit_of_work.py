"""UnitOfWork is the only persistence entry point for application services."""

import ast
from pathlib import Path

BACKEND_ROOT = Path(__file__).parents[2]
SERVICE_ROOT = BACKEND_ROOT / 'app' / 'modules'

# Services that legitimately need several independent transactions.
UOW_FACTORY_ALLOWED = {
    'DataIngestionService',
    'MarketDataSeriesIngestionService',
    'QuoteService',
    'UsdBrlIngestionService',
}


def _service_files() -> list[Path]:
    return sorted(
        path
        for path in SERVICE_ROOT.rglob('*.py')
        if 'service' in path.relative_to(SERVICE_ROOT).parts
    )


def _constructor_params(class_node: ast.ClassDef) -> list[str]:
    init = next(
        (
            node
            for node in class_node.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name == '__init__'
        ),
        None,
    )
    if init is None:
        return []
    args = init.args
    return [
        arg.arg
        for arg in (args.posonlyargs + args.args + args.kwonlyargs)
        if arg.arg != 'self'
    ]


def test_services_never_take_a_repository_dependency():
    violations = []
    for path in _service_files():
        tree = ast.parse(path.read_text(), filename=str(path))
        for class_node in (n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)):
            params = _constructor_params(class_node)
            repositories = [name for name in params if 'repositor' in name]
            if repositories:
                relative = path.relative_to(BACKEND_ROOT)
                violations.append(
                    f'{relative}:{class_node.lineno} {class_node.name} takes '
                    f'{", ".join(repositories)}'
                )

    assert not violations, (
        'Application services reach persistence only through UnitOfWork. '
        'Replace the repository dependency with `uow: UnitOfWork` and use '
        '`async with self.uow as uow` inside the method:\n' + '\n'.join(violations)
    )


def test_only_fan_out_services_take_a_unit_of_work_factory():
    violations = []
    for path in _service_files():
        tree = ast.parse(path.read_text(), filename=str(path))
        for class_node in (n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)):
            if 'uow_factory' not in _constructor_params(class_node):
                continue
            if class_node.name in UOW_FACTORY_ALLOWED:
                continue
            relative = path.relative_to(BACKEND_ROOT)
            violations.append(f'{relative}:{class_node.lineno} {class_node.name}')

    assert not violations, (
        'uow_factory exists only for services running concurrent transactions. '
        'Take `uow: UnitOfWork` instead, or add the service to '
        'UOW_FACTORY_ALLOWED with a reason:\n' + '\n'.join(violations)
    )


def test_write_scopes_commit():
    """A UoW scope that writes must commit, otherwise the write is discarded."""
    write_calls = {
        'create',
        'update',
        'delete',
        'upsert_bulk',
        'upsert_quotes',
        'create_execution',
        'create_attempt',
        'maintain_execution_history',
        'detach_ingestion_attempts',
    }
    violations = []
    for path in _service_files():
        source = path.read_text()
        tree = ast.parse(source, filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.AsyncWith):
                continue
            if not any('uow' in ast.unparse(item.context_expr) for item in node.items):
                continue
            block = ast.get_source_segment(source, node) or ''
            if '.commit()' in block:
                continue
            written = sorted(name for name in write_calls if f'.{name}(' in block)
            if written:
                relative = path.relative_to(BACKEND_ROOT)
                violations.append(f'{relative}:{node.lineno} calls {", ".join(written)}')

    assert not violations, (
        'These UnitOfWork scopes write without committing, so the write is '
        'rolled back on exit:\n' + '\n'.join(violations)
    )
