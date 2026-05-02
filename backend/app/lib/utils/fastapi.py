from io import BytesIO
from typing import Any

import numpy as np
import pandas as pd
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse


def df_response(df: pd.DataFrame) -> JSONResponse:
    def convert_value(val: Any):
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

    return JSONResponse(content=jsonable_encoder(records))


def df_to_xlsx_response(
    df: pd.DataFrame,
    filename: str,
    sheet_name: str = "Sheet1",
) -> StreamingResponse:
    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(
            writer,
            index=False,
            sheet_name=sheet_name,
        )

    output.seek(0)

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )