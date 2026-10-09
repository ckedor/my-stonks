from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Query

from app.composition.ai import (
    get_ai_artifact_service,
    get_ai_feature_service,
    get_ai_prompt_service,
    get_ai_usage_service,
)
from app.entrypoints.worker.task_runner import run_task_by_name
from app.modules.ai.api.schemas import (
    AIArtifactResponse,
    AIFeatureFormResponse,
    AIFeatureResponse,
    AIFeatureUpdateRequest,
    AIPromptVersionCreateRequest,
    AIPromptVersionResponse,
    AIRunResponse,
    AITaskDispatchResponse,
    AIUsageRowResponse,
)
from app.modules.ai.domain.commands import (
    CreateAIPromptVersionCommand,
    UpdateAIFeatureCommand,
)
from app.modules.ai.domain.enums import AIFeatureKey
from app.modules.ai.service.ai_artifact_service import AIArtifactService
from app.modules.ai.service.ai_feature_service import AIFeatureService
from app.modules.ai.service.ai_prompt_service import AIPromptService
from app.modules.ai.service.ai_usage_service import (
    DEFAULT_RUN_LIMIT,
    DEFAULT_WINDOW_DAYS,
    AIUsageService,
)
from app.modules.users.views import current_active_user, current_superuser

#: Dispatched by name, never imported: a task pulls in its service, its
#: handlers and its provider, and importing one here would load all of that
#: into the HTTP process at boot.
RUN_AI_FEATURE_TASK = 'run_ai_feature'

router = APIRouter(tags=['AI'], prefix='/ai')

#: Everything under here is operational: it edits prompts, spends money, or
#: reports what was spent. The product routes are declared on the main router
#: and are the only ones an ordinary reader reaches.
admin_router = APIRouter(dependencies=[Depends(current_superuser)])


@admin_router.get('/feature', response_model=list[AIFeatureResponse])
async def list_features(service: Annotated[AIFeatureService, Depends(get_ai_feature_service)]):
    return await service.list()


@admin_router.get('/feature/{feature_key}', response_model=AIFeatureResponse)
async def get_feature(
    feature_key: str,
    service: Annotated[AIFeatureService, Depends(get_ai_feature_service)],
):
    return await service.get(feature_key)


@admin_router.patch('/feature/{feature_key}', response_model=AIFeatureResponse)
async def update_feature(
    feature_key: str,
    payload: AIFeatureUpdateRequest,
    service: Annotated[AIFeatureService, Depends(get_ai_feature_service)],
):
    command = UpdateAIFeatureCommand(
        feature_key=feature_key,
        name=payload.name,
        description=payload.description,
        enabled=payload.enabled,
        freshness=payload.freshness,
        ttl_hours=payload.ttl_hours,
    )
    return await service.update(command)


@admin_router.get('/feature/{feature_key}/form', response_model=AIFeatureFormResponse)
async def get_feature_form(
    feature_key: str,
    features: Annotated[AIFeatureService, Depends(get_ai_feature_service)],
    prompts: Annotated[AIPromptService, Depends(get_ai_prompt_service)],
):
    """Everything the admin needs to run and to write a prompt for a feature.

    Both halves are declared on the handler, so a feature added later gets its
    run form and its list of available data without a line of frontend.
    """
    return AIFeatureFormResponse(
        feature_key=feature_key,
        input_schema=features.input_schema(feature_key),
        context_keys=await prompts.context_keys(feature_key),
    )


@admin_router.post('/feature/{feature_key}/run', response_model=AIArtifactResponse)
async def run_feature(
    feature_key: str,
    payload: Annotated[dict[str, Any], Body(default_factory=dict)],
    service: Annotated[AIArtifactService, Depends(get_ai_artifact_service)],
):
    """Generate now and replace what was stored — the refresh, in other words.

    It answers with the payload and with what the call cost, so the admin can
    read the result and its price on the same screen.
    """
    return await service.generate(feature_key, payload)


@admin_router.post('/feature/{feature_key}/schedule', response_model=AITaskDispatchResponse)
async def run_feature_schedule(feature_key: str):
    """Run the scheduled refresh of a feature now, in the worker.

    The same task the beat calls, with the same arguments. Manual and scheduled
    triggers enter one operation because they do the same thing.
    """
    task = run_task_by_name(RUN_AI_FEATURE_TASK, feature_key)
    return AITaskDispatchResponse(task_id=task.id, task_name=RUN_AI_FEATURE_TASK)


@admin_router.get(
    '/feature/{feature_key}/prompt_version', response_model=list[AIPromptVersionResponse]
)
async def list_prompt_versions(
    feature_key: str,
    service: Annotated[AIPromptService, Depends(get_ai_prompt_service)],
):
    return await service.list_versions(feature_key)


@admin_router.post('/feature/{feature_key}/prompt_version', response_model=AIPromptVersionResponse)
async def create_prompt_version(
    feature_key: str,
    payload: AIPromptVersionCreateRequest,
    service: Annotated[AIPromptService, Depends(get_ai_prompt_service)],
):
    command = CreateAIPromptVersionCommand(
        feature_key=feature_key,
        system=payload.system,
        template=payload.template,
        model=payload.model,
        temperature=payload.temperature,
        max_output_tokens=payload.max_output_tokens,
        web_search=payload.web_search,
        notes=payload.notes,
        activate=payload.activate,
    )
    return await service.create_version(command)


@admin_router.post('/prompt_version/{version_id}/activate', response_model=AIPromptVersionResponse)
async def activate_prompt_version(
    version_id: int,
    service: Annotated[AIPromptService, Depends(get_ai_prompt_service)],
):
    return await service.activate(version_id)


@admin_router.get('/usage', response_model=list[AIUsageRowResponse])
async def get_usage(
    service: Annotated[AIUsageService, Depends(get_ai_usage_service)],
    days: Annotated[int, Query(ge=1, le=365)] = DEFAULT_WINDOW_DAYS,
):
    return await service.usage_by_day(days)


@admin_router.get('/run', response_model=list[AIRunResponse])
async def list_runs(
    service: Annotated[AIUsageService, Depends(get_ai_usage_service)],
    limit: Annotated[int, Query(ge=1, le=500)] = DEFAULT_RUN_LIMIT,
):
    return await service.recent_runs(limit)


@router.get('/asset_description_draft', response_model=AIArtifactResponse)
async def get_asset_description_draft(
    asset_id: Annotated[int, Query(description='Id do ativo registrado')],
    _: Annotated[object, Depends(current_active_user)],
    service: Annotated[AIArtifactService, Depends(get_ai_artifact_service)],
):
    """O rascunho do texto de cadastro, para o botão de preencher.

    Lê o que já existe e só gera quando não há nada — clicar duas vezes não
    paga duas vezes. Querer um rascunho diferente é uma decisão, e ela entra
    pela rota de execução.

    Nada daqui chega ao cadastro: o texto vai para o formulário, e o que fica
    gravado em `asset.summary` e `asset.description` é o que o mantenedor
    salvar.
    """
    return await service.get_or_generate(
        AIFeatureKey.ASSET_DESCRIPTION_DRAFT, {'asset_id': asset_id}
    )


router.include_router(admin_router)
