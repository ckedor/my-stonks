from app.infra.db.repositories.base_repository import SQLAlchemyRepository


class AssetRepository(SQLAlchemyRepository):
    def __init__(self, session):
        super().__init__(session)
