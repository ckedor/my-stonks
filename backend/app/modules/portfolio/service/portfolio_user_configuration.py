# app/modules/portfolio/service/portfolio_user_configuration.py
"""
Portfolio user configuration service - handles portfolio settings.
"""

from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.entities import ConfigurationName, PortfolioUserConfiguration


class PortfolioUserConfigurationService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def get_user_configurations(self, portfolio_id: int):
        async with self.uow as uow:
            user_configurations = await uow.portfolios.get(
                PortfolioUserConfiguration,
                by={'portfolio_id': portfolio_id},
            )
            config_names = await uow.portfolios.get(ConfigurationName)
        name_options = [c.name for c in config_names]

        return {
            'configurations': [
                {
                    'id': c.id,
                    'portfolio_id': c.portfolio_id,
                    'name': self._get_name_by_id(config_names, c.configuration_name_id),
                    'enabled': c.enabled,
                    'config_data': c.config_data,
                }
                for c in user_configurations
            ],
            'nameOptions': name_options,
        }

    @staticmethod
    def _get_name_by_id(config_names, config_name_id):
        for c in config_names:
            if c.id == config_name_id:
                return c.name
        return None

    async def update_user_configuration(
        self, portfolio_id: int, *, configuration: str, enabled: bool
    ):
        async with self.uow as uow:
            config_names = await uow.portfolios.get(ConfigurationName, by={'name': configuration})
            if not config_names:
                raise ValidationError('Invalid configuration name.')

            config_name = config_names[0]
            existing_configs = await uow.portfolios.get(
                PortfolioUserConfiguration,
                by={
                    'portfolio_id': portfolio_id,
                    'configuration_name_id': config_name.id,
                },
            )
            # Sem linha significa "nunca configurado", não "não existe": toda
            # configuração nasce assim, e a primeira vez que alguém mexe no
            # interruptor é justamente quando a linha precisa ser criada. Antes
            # disso o serviço recusava, então uma configuração nova era
            # impossível de ligar.
            if existing_configs:
                existing_configs[0].enabled = enabled
            else:
                await uow.portfolios.create(
                    PortfolioUserConfiguration,
                    {
                        'portfolio_id': portfolio_id,
                        'configuration_name_id': config_name.id,
                        'enabled': enabled,
                    },
                )
            await uow.commit()

        return {'detail': 'Configuration updated successfully'}
