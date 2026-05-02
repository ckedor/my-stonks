import math

import pandas as pd


def sanitize_dict(records: list[dict]) -> list[dict]:
    def clean_value(v):
        if isinstance(v, float) and (math.isnan(v) or v in {float('inf'), float('-inf')}):
            return None
        if isinstance(v, pd.Timestamp):
            return v.isoformat()
        return v

    return [{k: clean_value(v) for k, v in row.items()} for row in records]
