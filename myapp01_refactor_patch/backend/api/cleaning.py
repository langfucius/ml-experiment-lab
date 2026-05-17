"""FastAPI routes for data cleaning."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.cleaning_service import (
    CATEGORICAL_MISSING_METHODS,
    NUMERIC_MISSING_METHODS,
    OUTLIER_METHODS,
    clean_dataset_request,
    get_dataset_profile,
)

router = APIRouter(prefix="/api/cleaning", tags=["cleaning"])


class CleaningProfileRequest(BaseModel):
    dataset_id: Optional[str] = None
    data: Optional[Any] = None
    rows: Optional[Any] = None


class CleaningRequest(BaseModel):
    dataset_id: Optional[str] = Field(default=None, description="原始 dataset_id")
    data: Optional[Any] = Field(default=None, description="兼容直接传 records")
    rows: Optional[Any] = Field(default=None, description="兼容直接传 rows")
    selected_columns: Optional[List[str]] = Field(default=None, description="参与清洗的字段")
    drop_duplicates: bool = False
    numeric_missing_method: str = "不处理"
    categorical_missing_method: str = "不处理"
    outlier_method: str = "不处理"
    type_config: Dict[str, str] = Field(default_factory=dict)


@router.get("/options")
def cleaning_options() -> Dict[str, Any]:
    return {
        "numeric_missing_methods": [
            "不处理",
            "删除缺失行",
            "均值填充",
            "中位数填充",
            "0填充",
            "线性插值",
            "前向填充",
            "后向填充",
        ],
        "categorical_missing_methods": ["不处理", "删除缺失行", "众数填充", "Unknown填充"],
        "outlier_methods": ["不处理", "IQR剔除", "Z-score剔除"],
        "type_options": ["numeric", "category", "datetime", "string"],
    }


@router.post("/profile")
def profile_dataset(req: CleaningProfileRequest) -> Dict[str, Any]:
    try:
        return get_dataset_profile(dataset_id=req.dataset_id, data=req.data if req.data is not None else req.rows)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/clean")
def clean_dataset(req: CleaningRequest) -> Dict[str, Any]:
    try:
        result = clean_dataset_request(
            dataset_id=req.dataset_id,
            data=req.data if req.data is not None else req.rows,
            selected_columns=req.selected_columns,
            drop_duplicates=req.drop_duplicates,
            numeric_missing_method=req.numeric_missing_method,
            categorical_missing_method=req.categorical_missing_method,
            outlier_method=req.outlier_method,
            type_config=req.type_config,
        )
        return {
            "cleaned_dataset_id": result.cleaned_dataset_id,
            "columns": result.columns,
            "numeric_columns": result.numeric_columns,
            "categorical_columns": result.categorical_columns,
            "datetime_columns": result.datetime_columns,
            "cleaning_summary": result.cleaning_summary,
            "missing_value_summary_before": result.missing_value_summary_before,
            "missing_value_summary_after": result.missing_value_summary_after,
            "dtype_summary_before": result.dtype_summary_before,
            "dtype_summary_after": result.dtype_summary_after,
            "preview": result.preview,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
