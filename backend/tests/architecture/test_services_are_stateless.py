import ast
from pathlib import Path

SERVICE_ROOT = Path(__file__).parents[2] / 'app' / 'modules'


def _self_attributes(target: ast.expr) -> list[str]:
    return [
        node.attr
        for node in ast.walk(target)
        if isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == 'self'
    ]


def _assigned_targets(node: ast.AST) -> list[ast.expr]:
    if isinstance(node, ast.Assign):
        return list(node.targets)
    if isinstance(node, ast.AnnAssign | ast.AugAssign | ast.NamedExpr):
        return [node.target]
    if isinstance(node, ast.Delete):
        return list(node.targets)
    return []


def _is_setattr_self(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call) or not node.args:
        return False
    if not isinstance(node.func, ast.Name) or node.func.id != 'setattr':
        return False
    first_arg = node.args[0]
    return isinstance(first_arg, ast.Name) and first_arg.id == 'self'


def _constructed_service(node: ast.AST) -> str | None:
    if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
        return None
    if node.func.id.endswith('Service'):
        return node.func.id
    return None


def _find_method_mutations(
    path: Path,
    class_node: ast.ClassDef,
    method: ast.FunctionDef | ast.AsyncFunctionDef,
) -> list[str]:
    violations: list[str] = []
    relative_path = path.relative_to(SERVICE_ROOT.parent.parent)
    for node in ast.walk(method):
        for target in _assigned_targets(node):
            for attribute in _self_attributes(target):
                violations.append(
                    f'{relative_path}:{node.lineno} '
                    f'{class_node.name}.{method.name} assigns self.{attribute}'
                )
        if _is_setattr_self(node):
            violations.append(
                f'{relative_path}:{node.lineno} '
                f'{class_node.name}.{method.name} calls setattr(self, ...)'
            )
        service_name = _constructed_service(node)
        if service_name is not None:
            violations.append(
                f'{relative_path}:{node.lineno} '
                f'{class_node.name}.{method.name} constructs {service_name}'
            )
    return violations


def _find_service_state_mutations() -> list[str]:
    violations: list[str] = []
    service_files = sorted(
        path
        for path in SERVICE_ROOT.rglob('*.py')
        if 'service' in path.relative_to(SERVICE_ROOT).parts
    )
    for path in service_files:
        tree = ast.parse(path.read_text(), filename=str(path))
        for class_node in (node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)):
            methods = (
                node
                for node in class_node.body
                if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef)
                and node.name != '__init__'
            )
            for method in methods:
                violations.extend(_find_method_mutations(path, class_node, method))
    return violations


def test_application_services_do_not_mutate_self_after_construction():
    violations = _find_service_state_mutations()

    assert not violations, (
        'Application services must be stateless after construction. '
        'Inject collaborating services and keep UoW-scoped repositories local:\n'
        + '\n'.join(violations)
    )
