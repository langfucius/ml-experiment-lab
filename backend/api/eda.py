from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.cleaning_service import get_dataset_profile
from backend.services.eda_service import generate_eda_plot


router = APIRouter(prefix="/api/eda", tags=["EDA"])


class EDAProfileRequest(BaseModel):
    dataset_id: Optional[str] = None
    data: Optional[Any] = None
    rows: Optional[Any] = None


class EDAPlotRequest(BaseModel):
    dataset_id: Optional[str] = None
    data: Optional[Any] = None
    rows: Optional[Any] = None

    chart_type: str

    column: Optional[str] = None
    x_col: Optional[str] = None
    y_col: Optional[str] = None
    hue_col: Optional[str] = None
    columns: Optional[List[str]] = None

    top_n: int = Field(default=10, ge=1, le=50)


@router.post("/profile")
def eda_profile(payload: EDAProfileRequest):
    try:
        return get_dataset_profile(
            dataset_id=payload.dataset_id,
            data=payload.data if payload.data is not None else payload.rows,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/plot")
def eda_plot(payload: EDAPlotRequest):
    try:
        return generate_eda_plot(
            dataset_id=payload.dataset_id,
            data=payload.data if payload.data is not None else payload.rows,
            chart_type=payload.chart_type,
            column=payload.column,
            x_col=payload.x_col,
            y_col=payload.y_col,
            hue_col=payload.hue_col,
            columns=payload.columns,
            top_n=payload.top_n,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))