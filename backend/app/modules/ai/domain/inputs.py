from pydantic import BaseModel


class AIArtifactInput(BaseModel):
    """Base class for typed AI artifact inputs."""

    model_config = {'frozen': True, 'extra': 'forbid'}


class AssetOverviewAndNewsInput(AIArtifactInput):
    ticker: str
