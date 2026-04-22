from app.infra.db.session import get_session
from app.modules.ai.api.schemas import (
    AIFeatureResponse,
    AIFeatureUpdate,
    AssetOverviewAndNewsResponse,
)
from app.modules.ai.domain.feature_keys import AIFeatureKey
from app.modules.ai.service.ai_artifact_service import AIArtifactService
from app.modules.ai.service.ai_feature_service import AIFeatureService
from app.modules.users.views import current_active_user, current_superuser
from fastapi import APIRouter, Depends
from fastapi.params import Query

router = APIRouter(tags=['AI'], prefix='/ai')

features_router = APIRouter(prefix='/features', dependencies=[Depends(current_superuser)])


@features_router.get('', response_model=list[AIFeatureResponse])
async def list_features(session=Depends(get_session)):
    return await AIFeatureService(session).list()


@features_router.get('/{feature_id}', response_model=AIFeatureResponse)
async def get_feature(feature_id: int, session=Depends(get_session)):
    return await AIFeatureService(session).get(feature_id)


@features_router.patch('/{feature_id}', response_model=AIFeatureResponse)
async def update_feature(feature_id: int, payload: AIFeatureUpdate, session=Depends(get_session)):
    return await AIFeatureService(session).update(feature_id, payload)


@router.get('/asset_overview_and_news', response_model=AssetOverviewAndNewsResponse)
async def get_asset_overview_and_news(
    ticker: str = Query(..., description='Asset ticker'),
    force_generate: bool = Query(
        default=False,
        description='If true, forces a fresh generation even when existing artifact is still valid',
    ),
    _: object = Depends(current_active_user),
    session=Depends(get_session),
):
    ai_artifact_service = AIArtifactService(session)
    return await ai_artifact_service.get_or_generate_artifact(
        feature_key=AIFeatureKey.ASSET_OVERVIEW_AND_NEWS,
        input_payload={'ticker': ticker},
        force_generate=force_generate,
    )


router.include_router(features_router)

