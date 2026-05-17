from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.cleaning_service import (
    clean_dataset_request,
    get_dataset_profile,
)

router = APIRouter(prefix="/api/cleaning", tags=["Cleaning"])


class CleaningProfileRequest(BaseModel):
    dataset_id: Optional[str] = None
    data: Optional[Any] = None
    rows: Optional[Any] = None


class CleaningRunRequest(BaseModel):
    dataset_id: Optional[str] = None
    data: Optional[Any] = None
    rows: Optional[Any] = None

    selected_columns: Optional[List[str]] = None
    drop_duplicates: bool = False

    numeric_missing_method: str = Field(default="不处理")
    categorical_missing_method: str = Field(default="不处理")
    outlier_method: str = Field(default="不处理")

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
        "categorical_missing_methods": [
            "不处理",
            "删除缺失行",
            "众数填充",
            "Unknown填充",
        ],
        "outlier_methods": [
            "不处理",
            "IQR剔除",
            "Z-score剔除",
        ],
        "type_options": [
            "numeric",
            "category",
            "datetime",
            "string",
            "bool",
        ],
    }


@router.post("/profile")
def cleaning_profile(payload: CleaningProfileRequest):
    try:
        return get_dataset_profile(
            dataset_id=payload.dataset_id,
            data=payload.data if payload.data is not None else payload.rows,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/run")
def run_cleaning(payload: CleaningRunRequest):
    try:
        result = clean_dataset_request(
            dataset_id=payload.dataset_id,
            data=payload.data if payload.data is not None else payload.rows,
            selected_columns=payload.selected_columns,
            drop_duplicates=payload.drop_duplicates,
            numeric_missing_method=payload.numeric_missing_method,
            categorical_missing_method=payload.categorical_missing_method,
            outlier_method=payload.outlier_method,
            type_config=payload.type_config,
        )

        return {
            "original_dataset_id": payload.dataset_id,
            "cleaned_dataset_id": result.cleaned_dataset_id,

            "cleaning_summary": result.cleaning_summary,

            "missing_value_summary_before": result.missing_value_summary_before,
            "missing_value_summary_after": result.missing_value_summary_after,

            "dtype_summary_before": result.dtype_summary_before,
            "dtype_summary_after": result.dtype_summary_after,

            "preview": result.preview,

            "summary": {
                "dataset_id": result.cleaned_dataset_id,
                "rows": int(result.cleaned_df.shape[0]),
                "columns_count": int(result.cleaned_df.shape[1]),
                "columns": result.columns,
                "numeric_columns": result.numeric_columns,
                "categorical_columns": result.categorical_columns,
                "datetime_columns": result.datetime_columns,
                "preview": result.preview,

                "missing_value_summary": result.missing_value_summary_after,
                "dtype_summary": result.dtype_summary_after,

                "dtypes": {
                    item["列名"]: item["数据类型"]
                    for item in result.dtype_summary_after
                    if "列名" in item and "数据类型" in item
                },
                "missing_counts": {
                    item["列名"]: item["缺失值数量"]
                    for item in result.missing_value_summary_after
                    if "列名" in item and "缺失值数量" in item
                },
            },
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))