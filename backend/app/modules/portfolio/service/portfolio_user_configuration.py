# app/modules/portfolio/service/portfolio_user_configuration.py
"""
Portfolio user configuration service - handles portfolio settings.
"""

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.portfolio.domain.entities import ConfigurationName, PortfolioUserConfiguration
from app.modules.portfolio.api.user_configuration.schemas import (
    UserConfigurationUpdateRequest,
)
from app.modules.portfolio.repositories import PortfolioRepository
from app.infra.db.unit_of_work import UnitOfWork


class PortfolioUserConfigurationService:
    def __init__(
        self,
        repository: PortfolioRepository | None = None,
        uow: UnitOfWork | None = None,
    ):
        self.repository = repository
        self.uow = uow

    async def get_user_configurations(self, portfolio_id: int):
        if self.repository is None:
            raise RuntimeError('A repository is required for this read operation')
        user_configurations = await self.repository.get(
            PortfolioUserConfiguration,
            by={'portfolio_id': portfolio_id}
        )

        config_names = await self.repository.get(ConfigurationName)
        name_options = [c.name for c in config_names]

        return {
            "configurations": [
                {
                    "id": c.id,
                    "portfolio_id": c.portfolio_id,
                    "name": self._get_name_by_id(config_names, c.configuration_name_id),
                    "enabled": c.enabled,
                    "config_data": c.config_data
                }
                for c in user_configurations
            ],
            "nameOptions": name_options
        }

    def _get_name_by_id(self, config_names, config_name_id):
        for c in config_names:
            if c.id == config_name_id:
                return c.name
        return None

    async def update_user_configuration(self, portfolio_id: int, user_configuration_request: UserConfigurationUpdateRequest):
        name = user_configuration_request.configuration
        enabled = user_configuration_request.enabled

        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        async with self.uow as uow:
            config_names = await uow.portfolios.get(ConfigurationName, by={'name': name})
            if not config_names:
                raise ValidationError('Invalid configuration name.')

            config_name = config_names[0]
            existing_configs = await uow.portfolios.get(
                PortfolioUserConfiguration,
                by={
                    "portfolio_id": portfolio_id,
                    "configuration_name_id": config_name.id,
                },
            )
            if not existing_configs:
                raise NotFoundError('Configuration not found.')
            existing_configs[0].enabled = enabled

        return {"detail": "Configuration updated successfully"}
