"""
Portfolio rebalancing service - handles rebalancing targets and calculations.

Rebalancing approach: Standard market redistribution.
- Based on the current total portfolio value.
- Calculates target value per category = total_value × category_target_pct / 100.
- Calculates target value per asset = category_target_value × asset_target_pct / 100.
- Difference = target_value − current_value.
  - Positive difference → buy more of that asset.
  - Negative difference → sell or redirect future contributions away.

This approach assumes redistribution of the existing portfolio (no new
contribution amount is considered). If the user wants contribution-only
rebalancing, the same difference values can be used to decide where to
direct new money without selling existing positions.
"""

from typing import List

from app.core.exceptions import BusinessRuleError
from app.infra.db.models.portfolio import CustomCategory, CustomCategoryAssignment
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.portfolio.api.rebalancing.schema import (
    AssetRebalancingEntry,
    CategoryRebalancingEntry,
    RebalancingResponse,
    SaveTargetsRequest,
)
from app.modules.portfolio.repositories import PortfolioRepository


class PortfolioRebalancingService:
    def __init__(self, session):
        self.session = session
        self.repo = PortfolioRepository(session)
        self.base_repo = SQLAlchemyRepository(session)

    async def get_rebalancing_data(self, portfolio_id: int) -> RebalancingResponse:
        """Return current positions enriched with target allocations and differences."""
        rows = await self.repo.get_position_on_date(portfolio_id)

        if not rows:
            return RebalancingResponse(
                portfolio_id=portfolio_id,
                total_value=0,
                categories=[],
            )

        positions = [
            {**dict(row), 'value': (row['quantity'] or 0) * (row['price'] or 0)}
            for row in rows
        ]
        total_value = sum(p['value'] for p in positions)

        # Load categories with their assignments (which hold asset-level targets)
        categories = await self.base_repo.get(
            CustomCategory,
            by={'portfolio_id': portfolio_id},
            relations=['assignments'],
        )

        # Build a map category_id → category object
        category_map = {cat.id: cat for cat in categories}

        # Build a map (asset_id) → assignment for this portfolio
        assignment_map = {}
        for cat in categories:
            for assignment in cat.assignments:
                assignment_map[assignment.asset_id] = assignment

        # Group positions by category
        category_groups = {}
        for row in positions:
            cat_name = row.get('category', None) or '(Sem Categoria)'
            if cat_name not in category_groups:
                category_groups[cat_name] = []
            category_groups[cat_name].append(row)

        # Find category model by name
        cat_by_name = {cat.name: cat for cat in categories}

        result_categories: List[CategoryRebalancingEntry] = []

        for cat_name, assets_rows in category_groups.items():
            cat_model = cat_by_name.get(cat_name)
            cat_id = cat_model.id if cat_model else 0
            cat_color = cat_model.color if cat_model else '#999'
            cat_target_pct = cat_model.target_percentage if cat_model else None

            cat_current_value = sum(r['value'] for r in assets_rows)
            cat_current_pct = (cat_current_value / total_value * 100) if total_value else 0

            cat_target_value = (total_value * cat_target_pct / 100) if cat_target_pct is not None else None
            cat_diff_value = (cat_target_value - cat_current_value) if cat_target_value is not None else None
            cat_diff_pct = (cat_target_pct - cat_current_pct) if cat_target_pct is not None else None

            asset_entries: List[AssetRebalancingEntry] = []
            for row in assets_rows:
                asset_id = int(row['asset_id'])
                asset_value = row['value']
                asset_pct_in_cat = (asset_value / cat_current_value * 100) if cat_current_value else 0

                assignment = assignment_map.get(asset_id)
                asset_target_pct = assignment.target_percentage if assignment and assignment.target_percentage is not None else None

                if asset_target_pct is not None and cat_target_value is not None:
                    asset_target_value = cat_target_value * asset_target_pct / 100
                    asset_diff_value = asset_target_value - asset_value
                    asset_diff_pct = asset_target_pct - asset_pct_in_cat
                else:
                    asset_target_value = None
                    asset_diff_value = None
                    asset_diff_pct = None

                asset_entries.append(AssetRebalancingEntry(
                    asset_id=asset_id,
                    ticker=row['ticker'],
                    name=row.get('name', row['ticker']),
                    category=cat_name,
                    category_id=cat_id,
                    current_value=asset_value,
                    current_pct_in_category=round(asset_pct_in_cat, 2),
                    target_pct_in_category=asset_target_pct,
                    target_value=round(asset_target_value, 2) if asset_target_value is not None else None,
                    diff_pct=round(asset_diff_pct, 2) if asset_diff_pct is not None else None,
                    diff_value=round(asset_diff_value, 2) if asset_diff_value is not None else None,
                ))

            # Sort assets by current value descending
            asset_entries.sort(key=lambda a: a.current_value, reverse=True)

            result_categories.append(CategoryRebalancingEntry(
                category_id=cat_id,
                category_name=cat_name,
                color=cat_color,
                current_value=round(cat_current_value, 2),
                current_pct=round(cat_current_pct, 2),
                target_pct=cat_target_pct,
                target_value=round(cat_target_value, 2) if cat_target_value is not None else None,
                diff_pct=round(cat_diff_pct, 2) if cat_diff_pct is not None else None,
                diff_value=round(cat_diff_value, 2) if cat_diff_value is not None else None,
                assets=asset_entries,
            ))

        # Sort categories by current value descending
        result_categories.sort(key=lambda c: c.current_value, reverse=True)

        return RebalancingResponse(
            portfolio_id=portfolio_id,
            total_value=round(total_value, 2),
            categories=result_categories,
        )

    async def save_targets(self, payload: SaveTargetsRequest) -> None:
        """
        Persist category and asset-level target percentages.

        Validations:
        - Sum of category target percentages must equal 100.
        - Sum of asset target percentages within each category must equal 100.
        """
        portfolio_id = payload.portfolio_id

        # Validate category sum
        cat_sum = sum(c.target_percentage for c in payload.categories)
        if abs(cat_sum - 100) > 0.01:
            raise BusinessRuleError(
                f'A soma dos percentuais das categorias deve ser 100%. Atual: {cat_sum:.2f}%',
            )

        # Validate asset sum per category
        for cat in payload.categories:
            asset_sum = sum(a.target_percentage for a in cat.assets)
            if abs(asset_sum - 100) > 0.01:
                category_obj = await self.base_repo.get(CustomCategory, id=cat.category_id)
                cat_name = category_obj.name if category_obj else str(cat.category_id)
                raise BusinessRuleError(
                    f'A soma dos percentuais dos ativos na categoria "{cat_name}" deve ser 100%. Atual: {asset_sum:.2f}%',
                )

        # Verify all categories belong to this portfolio
        portfolio_categories = await self.base_repo.get(
            CustomCategory, by={'portfolio_id': portfolio_id}
        )
        portfolio_category_ids = {cat.id for cat in portfolio_categories}

        for cat in payload.categories:
            if cat.category_id not in portfolio_category_ids:
                raise BusinessRuleError(
                    f'Categoria {cat.category_id} não pertence à carteira {portfolio_id}.',
                )

        # Save category targets
        for cat in payload.categories:
            await self.base_repo.update(CustomCategory, {
                'id': cat.category_id,
                'target_percentage': cat.target_percentage,
            })

            # Save asset targets
            for asset in cat.assets:
                assignment = await self.base_repo.get(
                    CustomCategoryAssignment,
                    by={
                        'custom_category_id': cat.category_id,
                        'asset_id': asset.asset_id,
                    },
                    first=True,
                )
                if assignment:
                    await self.base_repo.update(CustomCategoryAssignment, {
                        'id': assignment.id,
                        'target_percentage': asset.target_percentage,
                    })

        await self.session.commit()
