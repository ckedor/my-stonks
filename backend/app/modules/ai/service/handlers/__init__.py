"""The handlers, by feature key.

Two registries and not one, because two different questions are asked of a
feature at two different moments.

The *classes* answer what a feature is: the shape of its input, the shape of
its answer, and the names its prompt may use. The admin needs that to build a
run form and to refuse a prompt naming data nobody assembles, and it needs it
without a database session or a provider.

The *instances* answer what a feature does, and they carry the read services
that assemble its context. Those are built by the composition root, because
that is the only place allowed to wire one module's services into another.
"""

from app.modules.ai.domain.enums import AIFeatureKey
from app.modules.ai.service.handlers.asset_description_draft import (
    AssetDescriptionDraftHandler,
    AssetDescriptionDraftInput,
)
from app.modules.ai.service.handlers.base import AIFeatureHandler

HANDLER_CLASSES: dict[AIFeatureKey, type[AIFeatureHandler]] = {
    AssetDescriptionDraftHandler.feature_key: AssetDescriptionDraftHandler,
}

__all__ = [
    'HANDLER_CLASSES',
    'AIFeatureHandler',
    'AssetDescriptionDraftHandler',
    'AssetDescriptionDraftInput',
]
