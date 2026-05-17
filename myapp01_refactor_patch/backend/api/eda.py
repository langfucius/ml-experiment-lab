"""FastAPI routes for EDA charts."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.cleaning_service import get_dataset_profile
from backend.services.eda_service import generate_eda_plot

router = APIRouter(prefix="/api/eda", tags=["eda"])


class EDAProfileRequest(BaseModel):
    dataset_id: Optional[str] = None
    data: Optional[Any] = None
    rows: Optional[Any] = None


class EDAPlotRequest(BaseModel):
    dataset_id: Optional[str] = None
    data: Optional[Any] = None
    rows: Optional[Any] = None
    chart_type: str = Field(..., description="histogram/boxplot/bar/scatter/line/grouped_boxplot/correlation_heatmap/missing_values")
    column: Optional[str] = None
    x_col: Optional[str] = None
    y_col: Optional[str] = None
    hue_col: Optional[str] = None
    columns: Optional[List[str]] = None
    top_n: int = 10


@router.get("/options")
def eda_options() -> Dict[str, Any]:
    return {
        "chart_types": [
            {"value": "histogram", "label": "Histogram / 直方图"},
            {"value": "boxplot", "label": "Boxplot / 箱线图"},
            {"value": "bar", "label": "Bar chart / 类别条形图"},
            {"value": "scatter", "label": "Scatter / 散点图"},
            {"value": "line", "label": "Line chart / 折线图"},
            {"value": "grouped_boxplot", "label": "Grouped boxplot / 分组箱线图"},
            {"value": "correlation_heatmap", "label": "Correlation heatmap / 相关性热力图"},
            {"value": "missing_values", "label": "Missing values / 缺失值图"},
        ]
    }


@router.post("/profile")
def profile(req: EDAProfileRequest) -> Dict[str, Any]:
    try:
        return get_dataset_profile(dataset_id=req.dataset_id, data=req.data if req.data is not None else req.rows)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/plot")
def plot(req: EDAPlotRequest) -> Dict[str, Any]:
    try:
        return generate_eda_plot(
            dataset_id=req.dataset_id,
            data=req.data if req.data is not None else req.rows,
            chart_type=req.chart_type,
            column=req.column,
            x_col=req.x_col,
            y_col=req.y_col,
            hue_col=req.hue_col,
            columns=req.columns,
            top_n=req.top_n,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
