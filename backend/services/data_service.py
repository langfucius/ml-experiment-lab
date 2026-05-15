from __future__ import annotations

import io
import uuid
from typing import Any

import numpy as np
import pandas as pd
from fastapi import UploadFile


DATASET_STORE: dict[str, pd.DataFrame] = {}


class DataServiceError(Exception):
    """数据服务错误。"""
    pass


def _normalize_cell(value: Any) -> Any:
    """
    把 pandas / numpy 中不适合 JSON 序列化的值转换成普通 Python 类型。
    """
    if pd.isna(value):
        return None

    if isinstance(value, (np.integer,)):
        return int(value)

    if isinstance(value, (np.floating,)):
        return float(value)

    if isinstance(value, (np.bool_,)):
        return bool(value)

    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()

    return value


def dataframe_to_preview(df: pd.DataFrame, n: int = 10) -> list[dict[str, Any]]:
    preview_df = df.head(n).copy()

    records = []
    for _, row in preview_df.iterrows():
        item = {}
        for col in preview_df.columns:
            item[str(col)] = _normalize_cell(row[col])
        records.append(item)

    return records


def summarize_dataframe(df: pd.DataFrame, dataset_id: str) -> dict[str, Any]:
    """
    生成前端展示用的数据摘要。
    """
    columns = [str(col) for col in df.columns]

    dtypes = {
        str(col): str(dtype)
        for col, dtype in df.dtypes.items()
    }

    missing_counts = {
        str(col): int(count)
        for col, count in df.isna().sum().items()
    }

    numeric_columns = [
        str(col)
        for col in df.select_dtypes(include=["number"]).columns
    ]

    categorical_columns = [
        str(col)
        for col in df.select_dtypes(include=["object", "category", "bool"]).columns
    ]

    return {
        "dataset_id": dataset_id,
        "rows": int(df.shape[0]),
        "columns_count": int(df.shape[1]),
        "columns": columns,
        "dtypes": dtypes,
        "missing_counts": missing_counts,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "preview": dataframe_to_preview(df, n=10),
    }


async def read_uploaded_file(file: UploadFile) -> pd.DataFrame:
    """
    读取上传文件，支持 CSV / Excel。
    """
    filename = file.filename or ""

    if not filename:
        raise DataServiceError("文件名为空。")

    suffix = filename.lower().split(".")[-1]

    content = await file.read()

    if not content:
        raise DataServiceError("上传文件为空。")

    try:
        if suffix == "csv":
            # utf-8-sig 兼容 Excel 导出的 CSV BOM
            try:
                return pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
            except UnicodeDecodeError:
                return pd.read_csv(io.BytesIO(content), encoding="gb18030")

        if suffix in ["xlsx", "xls"]:
            return pd.read_excel(io.BytesIO(content))

    except Exception as e:
        raise DataServiceError(f"读取文件失败：{e}") from e

    raise DataServiceError("暂只支持 CSV、XLSX、XLS 文件。")


async def register_uploaded_dataset(file: UploadFile) -> dict[str, Any]:
    """
    读取上传文件，缓存为 DataFrame，并返回摘要。
    """
    df = await read_uploaded_file(file)

    if df.empty:
        raise DataServiceError("数据为空，无法继续分析。")

    dataset_id = str(uuid.uuid4())
    DATASET_STORE[dataset_id] = df

    summary = summarize_dataframe(df, dataset_id)
    summary["filename"] = file.filename

    return summary


def get_dataset(dataset_id: str) -> pd.DataFrame:
    """
    根据 dataset_id 取出缓存中的 DataFrame。
    """
    if dataset_id not in DATASET_STORE:
        raise DataServiceError("dataset_id 不存在或后端已重启，请重新上传数据。")

    return DATASET_STORE[dataset_id]


def list_datasets() -> list[dict[str, Any]]:
    """
    查看当前后端内存中保存的数据集。
    """
    result = []

    for dataset_id, df in DATASET_STORE.items():
        result.append(
            {
                "dataset_id": dataset_id,
                "rows": int(df.shape[0]),
                "columns_count": int(df.shape[1]),
                "columns": [str(col) for col in df.columns],
            }
        )

    return result