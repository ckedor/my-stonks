from typing import Any, Iterable, Sequence

import numpy as np
import pandas as pd


def rows_to_df(
    rows: Sequence | Iterable,
    datetime_cols: Sequence[str] | None = None,
    numeric_fillna_cols: Sequence[str] | None = None,
) -> pd.DataFrame:
    """Build a DataFrame from repository rows (list of mappings).

    Optionally coerces ``datetime_cols`` to ``datetime64`` and
    ``numeric_fillna_cols`` to numeric with ``NaN`` replaced by 0.
    """
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    for col in datetime_cols or ():
        if col in df.columns:
            df[col] = pd.to_datetime(df[col])
    for col in numeric_fillna_cols or ():
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    return df


def df_to_named_dict(df: pd.DataFrame) -> dict[str, list[dict]]:
    df = df.copy()
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return {
        col: df[['date', col]]
        .dropna()
        .rename(columns={col: 'value'})
        .to_dict(orient='records')
        for col in df.columns
        if col != 'date'
    }
    
def extend_values_to_today(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.sort_values("date").reset_index(drop=True)

    last_date = df["date"].max()
    today = pd.Timestamp.today().normalize()

    if last_date >= today:
        return df

    full_range = pd.date_range(start=df["date"].min(), end=today, freq="D")

    df = df.set_index("date").reindex(full_range)

    df = df.ffill()
    df = df.rename_axis("date").reset_index()

    return df


def df_to_dict_list(df: pd.DataFrame) -> list[dict]:
    def convert_value(val:  Any):
            if isinstance(val, pd.Timestamp):
                return val.isoformat()
            if pd.isna(val) or val in {
                float('inf'),
                float('-inf'),
                np.inf,
                -np.inf,
            }:
                return None
            return val

    records = [
        {k: convert_value(v) for k, v in row.items()} for row in df.to_dict(orient='records')
    ]
    return records