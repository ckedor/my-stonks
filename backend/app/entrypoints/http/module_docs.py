"""Independent OpenAPI and Swagger pages for each application module."""

from dataclasses import dataclass
from html import escape
from typing import Any

from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse


@dataclass(frozen=True)
class ModuleDocs:
    slug: str
    title: str
    path_prefixes: tuple[str, ...]

    def includes(self, path: str) -> bool:
        return any(path == prefix or path.startswith(f'{prefix}/') for prefix in self.path_prefixes)


MODULE_DOCS = (
    ModuleDocs('users', 'Usuários e autenticação', ('/auth', '/users')),
    ModuleDocs('ai', 'Inteligência artificial', ('/ai',)),
    ModuleDocs('market-data', 'Dados de mercado', ('/market_data',)),
    ModuleDocs('portfolio', 'Portfólio', ('/portfolio',)),
    ModuleDocs('system', 'Sistema', ('/hc',)),
)

_SWAGGER_UI_PARAMETERS = {
    'displayRequestDuration': True,
    'persistAuthorization': True,
}

_NAVIGATION_STYLE = """
.module-docs-nav {
  align-items: center;
  background: #fafafa;
  border-bottom: 1px solid #d8dde3;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
  color: #3b4151;
  display: flex;
  gap: 24px;
  min-height: 56px;
  overflow-x: auto;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 10000;
}
.module-docs-nav__brand {
  color: #3b4151;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}
.module-docs-nav__links {
  align-items: stretch;
  display: flex;
  min-height: 56px;
}
.module-docs-nav__link {
  align-items: center;
  border-bottom: 3px solid transparent;
  color: #3b4151;
  display: flex;
  font-size: 14px;
  padding: 0 14px;
  text-decoration: none;
  white-space: nowrap;
}
.module-docs-nav__link:hover {
  background: #f1f1f1;
  color: #1b1b1b;
}
.module-docs-nav__link[aria-current="page"] {
  border-bottom-color: #4990e2;
  color: #1b1b1b;
  font-weight: 700;
}
.swagger-ui .topbar {
  display: none;
}
@media (max-width: 700px) {
  .module-docs-nav {
    gap: 10px;
    padding: 0 12px;
  }
  .module-docs-nav__link {
    padding: 0 10px;
  }
}
"""


def _referenced_components(value: Any) -> set[tuple[str, str]]:
    references = set()
    if isinstance(value, str) and value.startswith('#/components/'):
        _, _, section, name = value.split('/', maxsplit=3)
        references.add((section, name))
    elif isinstance(value, dict):
        for nested_value in value.values():
            references.update(_referenced_components(nested_value))
    elif isinstance(value, list):
        for nested_value in value:
            references.update(_referenced_components(nested_value))
    return references


def _module_components(
    complete_schema: dict[str, Any],
    paths: dict[str, Any],
) -> dict[str, Any]:
    complete_components = complete_schema.get('components', {})
    pending = list(_referenced_components(paths))
    selected: dict[str, dict[str, Any]] = {}

    while pending:
        section, name = pending.pop()
        if name in selected.get(section, {}):
            continue
        component = complete_components.get(section, {}).get(name)
        if component is None:
            continue
        selected.setdefault(section, {})[name] = component
        pending.extend(_referenced_components(component))

    security_names = {
        security_name
        for path_item in paths.values()
        for operation in path_item.values()
        if isinstance(operation, dict)
        for requirement in operation.get('security', [])
        for security_name in requirement
    }
    security_names.update(
        security_name
        for requirement in complete_schema.get('security', [])
        for security_name in requirement
    )
    if security_names:
        selected['securitySchemes'] = {
            name: scheme
            for name, scheme in complete_components.get('securitySchemes', {}).items()
            if name in security_names
        }
    return selected


def build_module_openapi(app: FastAPI, module: ModuleDocs) -> dict[str, Any]:
    """Return the main OpenAPI schema filtered to a single module."""
    complete_schema = app.openapi()
    paths = {
        path: path_item
        for path, path_item in complete_schema['paths'].items()
        if module.includes(path)
    }
    used_tags = {
        tag
        for path_item in paths.values()
        for operation in path_item.values()
        if isinstance(operation, dict)
        for tag in operation.get('tags', [])
    }

    module_schema = {
        **complete_schema,
        'info': {
            **complete_schema['info'],
            'title': f'{app.title} — {module.title}',
            'description': f'Documentação isolada do módulo {module.title}.',
        },
        'paths': paths,
        'components': _module_components(complete_schema, paths),
    }
    if 'tags' in complete_schema:
        module_schema['tags'] = [
            tag for tag in complete_schema['tags'] if tag.get('name') in used_tags
        ]
    return module_schema


def _navigation_html(root_path: str, current_slug: str | None) -> str:
    links = [
        (
            'complete',
            'Completa',
            f'{root_path}/docs',
        ),
        *[
            (
                module.slug,
                module.title,
                f'{root_path}/docs/{module.slug}',
            )
            for module in MODULE_DOCS
        ],
    ]
    rendered_links = ''.join(
        f'<a class="module-docs-nav__link" href="{escape(href)}"'
        f'{' aria-current="page"' if slug == current_slug else ""}>'
        f'{escape(label)}</a>'
        for slug, label, href in links
    )
    return (
        '<nav class="module-docs-nav" aria-label="Documentação por módulo">'
        f'<a class="module-docs-nav__brand" href="{escape(root_path)}/docs/modules">'
        'My Stonks API</a>'
        f'<div class="module-docs-nav__links">{rendered_links}</div>'
        '</nav>'
    )


def _swagger_document(
    *,
    app: FastAPI,
    openapi_url: str,
    title: str,
    root_path: str,
    current_slug: str | None,
) -> HTMLResponse:
    swagger_response = get_swagger_ui_html(
        openapi_url=openapi_url,
        title=title,
        swagger_ui_parameters=_SWAGGER_UI_PARAMETERS,
    )
    document = swagger_response.body.decode('utf-8')
    document = document.replace(
        '</head>',
        f'<style>{_NAVIGATION_STYLE}</style></head>',
        1,
    )
    document = document.replace(
        '<body>',
        f'<body>{_navigation_html(root_path, current_slug)}',
        1,
    )
    return HTMLResponse(document)


def _module_index_endpoint(app: FastAPI):
    async def module_index(request: Request) -> HTMLResponse:
        root_path = request.scope.get('root_path', '').rstrip('/')
        links = ''.join(
            f'<li><a href="{root_path}/docs/{escape(module.slug)}">{escape(module.title)}</a></li>'
            for module in MODULE_DOCS
        )
        return HTMLResponse(
            '<!doctype html><html lang="pt-BR"><head>'
            f'<title>{escape(app.title)} — Módulos</title>'
            '<meta charset="utf-8">'
            '<style>body{font-family:system-ui;max-width:760px;margin:48px auto;padding:0 20px}'
            'li{margin:12px 0}a{font-size:18px}</style>'
            '</head><body>'
            f'<h1>{escape(app.title)}</h1>'
            '<p>Selecione a documentação de um módulo:</p>'
            f'<ul>{links}</ul>'
            f'<p><a href="{root_path}/docs">Ver documentação completa</a></p>'
            '</body></html>'
        )

    return module_index


def _module_schema_endpoint(app: FastAPI, module: ModuleDocs):
    async def module_schema() -> JSONResponse:
        return JSONResponse(build_module_openapi(app, module))

    module_schema.__name__ = f'{module.slug.replace("-", "_")}_openapi'
    return module_schema


def _complete_swagger_endpoint(app: FastAPI):
    async def complete_swagger(request: Request) -> HTMLResponse:
        root_path = request.scope.get('root_path', '').rstrip('/')
        return _swagger_document(
            app=app,
            openapi_url=f'{root_path}{app.openapi_url}',
            title=f'{app.title} — Documentação completa',
            root_path=root_path,
            current_slug='complete',
        )

    return complete_swagger


def _module_swagger_endpoint(app: FastAPI, module: ModuleDocs):
    async def module_swagger(request: Request) -> HTMLResponse:
        root_path = request.scope.get('root_path', '').rstrip('/')
        return _swagger_document(
            app=app,
            openapi_url=f'{root_path}/openapi/{module.slug}.json',
            title=f'{app.title} — {module.title}',
            root_path=root_path,
            current_slug=module.slug,
        )

    module_swagger.__name__ = f'{module.slug.replace("-", "_")}_swagger'
    return module_swagger


def setup_module_docs(app: FastAPI) -> None:
    """Register one OpenAPI schema and Swagger page per application module."""
    app.add_api_route(
        '/docs',
        _complete_swagger_endpoint(app),
        methods=['GET'],
        include_in_schema=False,
    )
    app.add_api_route(
        '/docs/modules',
        _module_index_endpoint(app),
        methods=['GET'],
        include_in_schema=False,
    )
    for module in MODULE_DOCS:
        app.add_api_route(
            f'/openapi/{module.slug}.json',
            _module_schema_endpoint(app, module),
            methods=['GET'],
            include_in_schema=False,
        )
        app.add_api_route(
            f'/docs/{module.slug}',
            _module_swagger_endpoint(app, module),
            methods=['GET'],
            include_in_schema=False,
        )
