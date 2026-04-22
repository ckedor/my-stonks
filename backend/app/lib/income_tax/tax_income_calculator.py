import pandas as pd
from app.lib.income_tax.constants import (
    FREE_TAX_LIMIT_CRYPTO,
    FREE_TAX_LIMIT_STOCK,
    TAX_RATE_CRYPTO,
    TAX_RATE_ETF,
    TAX_RATE_FII,
    TAX_RATE_STOCK,
    TaxableAssetType,
)


class TaxIncomeCalculator:
    
    REQUIRED_COLUMNS = ['realized_profit', 'gross_sales']
    
    def __init__(self, asset_type: TaxableAssetType, transactions_df: pd.DataFrame):
        self.asset_type = asset_type
        self.tax_rate = self._get_tax_rate()
        self.free_tax_limit = self._get_free_tax_limit()
        for col in TaxIncomeCalculator.REQUIRED_COLUMNS:
            if col not in transactions_df.columns:
                raise ValueError(f"Missing required column: {col}")
        self.transactions_df = transactions_df

    def _get_tax_rate(self) -> float:
        if self.asset_type == TaxableAssetType.FII:
            return TAX_RATE_FII
        elif self.asset_type == TaxableAssetType.ETF:
            return TAX_RATE_ETF
        elif self.asset_type == TaxableAssetType.STOCK:
            return TAX_RATE_STOCK
        elif self.asset_type == TaxableAssetType.CRIPTO:
            return TAX_RATE_CRYPTO
        else:
            raise ValueError("Invalid asset type")

    def _get_free_tax_limit(self) -> float:
        if self.asset_type == TaxableAssetType.FII:
            return 0.0
        elif self.asset_type == TaxableAssetType.ETF:
            return 0.0
        elif self.asset_type == TaxableAssetType.STOCK:
            return FREE_TAX_LIMIT_STOCK
        elif self.asset_type == TaxableAssetType.CRIPTO:
            return FREE_TAX_LIMIT_CRYPTO
        else:
            raise ValueError("Invalid asset type")

    def calculate_tax(self) -> pd.DataFrame:
        acc_loss = 0.0

        for idx, row in self.transactions_df.iterrows():
            profit = row['realized_profit']
            total_sold = row['gross_sales']
            tax_due = 0.0

            if profit < 0:
                acc_loss += -profit
            else:
                profit_after_loss = profit - acc_loss

                if self.free_tax_limit and total_sold <= self.free_tax_limit:
                    tax_due = 0.0
                elif profit_after_loss <= 0:
                    acc_loss -= profit
                else:
                    tax_due = profit_after_loss * self.tax_rate
                    acc_loss = 0.0

            self.transactions_df.at[idx, 'accumulated_loss'] = acc_loss
            self.transactions_df.at[idx, 'tax_due'] = round(tax_due, 2)

        return self.transactions_df