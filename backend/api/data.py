from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.services.data_service import (
    DataServiceError,
    list_datasets,
    register_uploaded_dataset,
)


router = APIRouter(prefix="/api/data", tags=["Data"])


class DatasetSummaryResponse(BaseModel):
    dataset_id: str
    filename: str | None = None
    rows: int
    columns_count: int
    columns: list[str]
    dtypes: dict[str, str]
    missing_counts: dict[str, int]
    numeric_columns: list[str]
    categorical_columns: list[str]
    preview: list[dict[str, Any]]


@router.post("/upload", response_model=DatasetSummaryResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """
    上传 CSV / Excel 数据集，并返回数据摘要。
    """
    try:
        summary = await register_uploaded_dataset(file)
        return summary

    except DataServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/datasets")
def get_dataset_list():
    """
    查看当前后端缓存的数据集列表。
    """
    return {
        "datasets": list_datasets()
    }