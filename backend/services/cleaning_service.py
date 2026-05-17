"""
Data cleaning service for the React + FastAPI version of mini ML Lab.

Goal: keep feature parity with the old Streamlit utils/data_cleaning.py while
preserving the new backend's cleaned_dataset_id workflow.

This module is intentionally defensive: it can work with an existing dataset
registry if your current backend already has one, and falls back to a local
in-memory registry when no compatible registry is found.
"""
from __future__ import annotations

import importlib
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

import numpy as np
import pandas as pd


NUMERIC_MISSING_METHODS = {
    "不处理",
    "删除缺失行",
    "均值填充",
    "中位数填充",
    "0填充",
    "线性插值",
    "前向填充",
    "后向填充",
}

CATEGORICAL_MISSING_METHODS = {
    "不处理",
    "删除缺失行",
    "众数填充",
    "Unknown填充",
}

OUTLIER_METHODS = {"不处理", "IQR剔除", "Z-score剔除"}
TYPE_METHODS = {"numeric", "category", "datetime", "string", "bool", "boolean"}

# Local fallback cache. Existing project registries are preferred when found.
_DATASET_CACHE: Dict[str, pd.DataFrame] = {}
_DATASET_META_CACHE: Dict[str, Dict[str, Any]] = {}


@dataclass
class CleanResult:
    cleaned_dataset_id: str
    original_df: pd.DataFrame
    cleaned_df: pd.DataFrame
    cleaning_summary: Dict[str, Any]
    missing_value_summary_before: List[Dict[str, Any]]
    missing_value_summary_after: List[Dict[str, Any]]
    dtype_summary_before: List[Dict[str, Any]]
    dtype_summary_after: List[Dict[str, Any]]
    preview: List[Dict[str, Any]]
    columns: List[str]
    numeric_columns: List[str]
    categorical_columns: List[str]
    datetime_columns: List[str]


def _candidate_registry_modules() -> List[str]:
    """Common places current project versions may keep uploaded data."""
    return [
        "backend.services.dataset_store",
        "backend.services.dataset_service",
        "backend.services.data_service",
        "backend.services.upload_service",
        "backend.services.storage_service",
        "backend.core.dataset_store",
        "backend.core.storage",
        "backend.storage",
        "backend.api.upload",
        "backend.api.datasets",
        "backend.api.data_upload",
    ]


def _to_dataframe(data: Any) -> pd.DataFrame:
    if isinstance(data, pd.DataFrame):
        return data.copy()
    if data is None:
        raise ValueError("没有找到数据。请传入 dataset_id，或在请求中提供 data/rows。")
    if isinstance(data, list):
        return pd.DataFrame(data)
    if isinstance(data, dict):
        # Accept common wrappers: {records: [...]}, {data: [...]}, {df: ...}
        for key in ("records", "rows", "data", "df", "dataset"):
            if key in data:
                return _to_dataframe(data[key])
        return pd.DataFrame(data)
    raise ValueError(f"无法转换为 DataFrame 的数据类型: {type(data)!r}")


def get_dataset_dataframe(dataset_id: Optional[str] = None, data: Any = None) -> pd.DataFrame:
    """
    Resolve a DataFrame from either raw request data or an existing dataset id.

    The adapter tries common service functions/variables, then falls back to this
    module's local cache. This avoids breaking when your current backend uses a
    slightly different name for the upload registry.
    """
    if data is not None:
        return _to_dataframe(data)

    if not dataset_id:
        raise ValueError("缺少 dataset_id，且请求中没有 data/rows。")

    if dataset_id in _DATASET_CACHE:
        return _DATASET_CACHE[dataset_id].copy()

    # 1) Try function-based registries.
    function_names = [
        "get_dataset_dataframe",
        "get_dataframe",
        "get_dataset_df",
        "get_dataset",
        "load_dataset",
        "read_dataset",
    ]
    for module_name in _candidate_registry_modules():
        try:
            module = importlib.import_module(module_name)
        except Exception:
            continue
        for fn_name in function_names:
            fn = getattr(module, fn_name, None)
            if callable(fn):
                try:
                    candidate = fn(dataset_id)
                    if candidate is not None:
                        return _to_dataframe(candidate)
                except Exception:
                    continue

    # 2) Try dict-like registries.
    dict_names = [
        "DATASETS",
        "CLEANED_DATASETS",
        "datasets",
        "cleaned_datasets",
        "dataset_store",
        "DATASET_STORE",
        "uploaded_datasets",
        "UPLOADED_DATASETS",
    ]
    for module_name in _candidate_registry_modules():
        try:
            module = importlib.import_module(module_name)
        except Exception:
            continue
        for attr in dict_names:
            store = getattr(module, attr, None)
            if isinstance(store, dict) and dataset_id in store:
                value = store[dataset_id]
                if isinstance(value, dict):
                    for key in ("df", "dataframe", "data", "records", "rows"):
                        if key in value:
                            return _to_dataframe(value[key])
                return _to_dataframe(value)

    raise ValueError(
        f"没有找到 dataset_id={dataset_id!r} 对应的数据。"
        "请确认上传接口和清洗接口共用同一个后端进程，或在请求中直接传 data/rows。"
    )


def register_dataset_dataframe(
    df: pd.DataFrame,
    *,
    dataset_id: Optional[str] = None,
    source_dataset_id: Optional[str] = None,
    kind: str = "cleaned",
    meta: Optional[Mapping[str, Any]] = None,
) -> str:
    """Store cleaned data and return its id, preferring existing project storage."""
    final_id = dataset_id or f"{kind}_{uuid.uuid4().hex[:12]}"
    payload_meta = dict(meta or {})
    payload_meta.update({
        "dataset_id": final_id,
        "source_dataset_id": source_dataset_id,
        "kind": kind,
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
    })

    # Always keep a local fallback copy.
    _DATASET_CACHE[final_id] = df.copy()
    _DATASET_META_CACHE[final_id] = payload_meta

    # Try to also write into current project's registry.
    writer_names = [
        "register_dataset_dataframe",
        "register_dataframe",
        "save_dataset_dataframe",
        "save_dataframe",
        "store_dataset_dataframe",
        "store_dataframe",
        "save_dataset",
        "store_dataset",
    ]
    for module_name in _candidate_registry_modules():
        try:
            module = importlib.import_module(module_name)
        except Exception:
            continue
        for fn_name in writer_names:
            fn = getattr(module, fn_name, None)
            if not callable(fn):
                continue
            call_patterns = [
                lambda: fn(final_id, df.copy(), payload_meta),
                lambda: fn(final_id, df.copy()),
                lambda: fn(df.copy(), dataset_id=final_id, meta=payload_meta),
                lambda: fn(df.copy(), final_id),
            ]
            for call in call_patterns:
                try:
                    call()
                    return final_id
                except TypeError:
                    continue
                except Exception:
                    break

    dict_names = [
        "DATASETS",
        "CLEANED_DATASETS",
        "datasets",
        "cleaned_datasets",
        "dataset_store",
        "DATASET_STORE",
    ]
    for module_name in _candidate_registry_modules():
        try:
            module = importlib.import_module(module_name)
        except Exception:
            continue
        for attr in dict_names:
            store = getattr(module, attr, None)
            if isinstance(store, dict):
                try:
                    store[final_id] = {
                        "df": df.copy(),
                        "dataframe": df.copy(),
                        "meta": payload_meta,
                    }
                    return final_id
                except Exception:
                    continue

    return final_id


def validate_method(value: Optional[str], allowed: Iterable[str], default: str) -> str:
    value = value or default
    if value not in set(allowed):
        raise ValueError(f"不支持的策略: {value!r}。可选值: {', '.join(allowed)}")
    return value


def convert_column_types(df: pd.DataFrame, type_config: Optional[Mapping[str, str]] = None) -> pd.DataFrame:
    """
    Type conversion compatible with the old Streamlit version.

    Supported values:
    - numeric: pd.to_numeric(errors='coerce')
    - category: astype('category')
    - datetime: pd.to_datetime(errors='coerce')
    - string: pandas string dtype, preserving missing values better than astype(str)
    - bool/boolean: pandas nullable boolean where possible
    """
    df_converted = df.copy()
    if not type_config:
        return df_converted

    for col, target_type in type_config.items():
        if col not in df_converted.columns or not target_type:
            continue
        target_type = str(target_type).strip()
        if target_type not in TYPE_METHODS:
            continue
        try:
            if target_type == "numeric":
                df_converted[col] = pd.to_numeric(df_converted[col], errors="coerce")
            elif target_type == "category":
                df_converted[col] = df_converted[col].astype("category")
            elif target_type == "datetime":
                df_converted[col] = pd.to_datetime(df_converted[col], errors="coerce")
            elif target_type == "string":
                df_converted[col] = df_converted[col].astype("string")
            elif target_type in {"bool", "boolean"}:
                df_converted[col] = df_converted[col].astype("boolean")
        except Exception:
            # Keep old behavior: conversion failure should not kill the app.
            continue
    return df_converted


def handle_numeric_missing_values(df: pd.DataFrame, method: str = "不处理") -> pd.DataFrame:
    method = validate_method(method, NUMERIC_MISSING_METHODS, "不处理")
    df_result = df.copy()
    numeric_columns = df_result.select_dtypes(include=["number"]).columns.tolist()
    if not numeric_columns or method == "不处理":
        return df_result

    if method == "删除缺失行":
        return df_result.dropna(subset=numeric_columns)

    if method == "均值填充":
        for col in numeric_columns:
            df_result[col] = df_result[col].fillna(df_result[col].mean())
    elif method == "中位数填充":
        for col in numeric_columns:
            df_result[col] = df_result[col].fillna(df_result[col].median())
    elif method == "0填充":
        for col in numeric_columns:
            df_result[col] = df_result[col].fillna(0)
    elif method == "线性插值":
        df_result[numeric_columns] = df_result[numeric_columns].interpolate(
            method="linear", limit_direction="both"
        )
    elif method == "前向填充":
        df_result[numeric_columns] = df_result[numeric_columns].ffill()
    elif method == "后向填充":
        df_result[numeric_columns] = df_result[numeric_columns].bfill()
    return df_result


def handle_categorical_missing_values(df: pd.DataFrame, method: str = "不处理") -> pd.DataFrame:
    method = validate_method(method, CATEGORICAL_MISSING_METHODS, "不处理")
    df_result = df.copy()
    categorical_columns = df_result.select_dtypes(include=["object", "category", "bool", "boolean", "string"]).columns.tolist()
    if not categorical_columns or method == "不处理":
        return df_result

    if method == "删除缺失行":
        return df_result.dropna(subset=categorical_columns)

    if method == "众数填充":
        for col in categorical_columns:
            mode_value = df_result[col].mode(dropna=True)
            if not mode_value.empty:
                fill_value = mode_value.iloc[0]
                if pd.api.types.is_categorical_dtype(df_result[col]) and fill_value not in df_result[col].cat.categories:
                    df_result[col] = df_result[col].cat.add_categories([fill_value])
                df_result[col] = df_result[col].fillna(fill_value)
    elif method == "Unknown填充":
        for col in categorical_columns:
            if pd.api.types.is_categorical_dtype(df_result[col]) and "Unknown" not in df_result[col].cat.categories:
                df_result[col] = df_result[col].cat.add_categories(["Unknown"])
            df_result[col] = df_result[col].fillna("Unknown")
    return df_result


def remove_outliers_iqr(df: pd.DataFrame, multiplier: float = 1.5) -> pd.DataFrame:
    df_result = df.copy()
    numeric_columns = df_result.select_dtypes(include=["number"]).columns.tolist()
    if not numeric_columns:
        return df_result

    mask = pd.Series(True, index=df_result.index)
    for col in numeric_columns:
        q1 = df_result[col].quantile(0.25)
        q3 = df_result[col].quantile(0.75)
        iqr = q3 - q1
        if pd.isna(iqr) or iqr == 0:
            continue
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        col_mask = df_result[col].isna() | ((df_result[col] >= lower_bound) & (df_result[col] <= upper_bound))
        mask = mask & col_mask
    return df_result.loc[mask].copy()


def remove_outliers_zscore(df: pd.DataFrame, threshold: float = 3.0) -> pd.DataFrame:
    df_result = df.copy()
    numeric_columns = df_result.select_dtypes(include=["number"]).columns.tolist()
    if not numeric_columns:
        return df_result

    mask = pd.Series(True, index=df_result.index)
    for col in numeric_columns:
        std = df_result[col].std()
        mean = df_result[col].mean()
        if pd.isna(std) or std == 0:
            continue
        z_scores = (df_result[col] - mean) / std
        col_mask = df_result[col].isna() | (z_scores.abs() <= threshold)
        mask = mask & col_mask
    return df_result.loc[mask].copy()


def clean_data(
    df: pd.DataFrame,
    selected_columns: Optional[List[str]],
    drop_duplicates: bool = False,
    numeric_missing_method: str = "不处理",
    categorical_missing_method: str = "不处理",
    outlier_method: str = "不处理",
    type_config: Optional[Mapping[str, str]] = None,
) -> pd.DataFrame:
    numeric_missing_method = validate_method(numeric_missing_method, NUMERIC_MISSING_METHODS, "不处理")
    categorical_missing_method = validate_method(categorical_missing_method, CATEGORICAL_MISSING_METHODS, "不处理")
    outlier_method = validate_method(outlier_method, OUTLIER_METHODS, "不处理")

    if not selected_columns:
        selected_columns = df.columns.tolist()

    missing_cols = [c for c in selected_columns if c not in df.columns]
    if missing_cols:
        raise ValueError(f"选择了不存在的字段: {missing_cols}")

    df_cleaned = df[selected_columns].copy()
    df_cleaned = convert_column_types(df_cleaned, type_config=type_config)
    df_cleaned = handle_numeric_missing_values(df_cleaned, numeric_missing_method)
    df_cleaned = handle_categorical_missing_values(df_cleaned, categorical_missing_method)

    if outlier_method == "IQR剔除":
        df_cleaned = remove_outliers_iqr(df_cleaned)
    elif outlier_method == "Z-score剔除":
        df_cleaned = remove_outliers_zscore(df_cleaned)

    if drop_duplicates:
        df_cleaned = df_cleaned.drop_duplicates()

    return df_cleaned.reset_index(drop=True)


def get_missing_value_summary(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["列名", "缺失值数量", "缺失比例(%)"])
    denominator = max(len(df), 1)
    return pd.DataFrame({
        "列名": df.columns,
        "缺失值数量": df.isnull().sum().astype(int).values,
        "缺失比例(%)": (df.isnull().sum().values / denominator * 100).round(2),
    })


def get_cleaning_summary(original_df: pd.DataFrame, cleaned_df: pd.DataFrame) -> Dict[str, Any]:
    return {
        "原始行数": int(original_df.shape[0]),
        "原始列数": int(original_df.shape[1]),
        "清洗后行数": int(cleaned_df.shape[0]),
        "清洗后列数": int(cleaned_df.shape[1]),
        "减少行数": int(original_df.shape[0] - cleaned_df.shape[0]),
        "减少列数": int(original_df.shape[1] - cleaned_df.shape[1]),
        "原始缺失值总数": int(original_df.isnull().sum().sum()),
        "清洗后缺失值总数": int(cleaned_df.isnull().sum().sum()),
        "原始重复行数": int(original_df.duplicated().sum()) if not original_df.empty else 0,
        "清洗后重复行数": int(cleaned_df.duplicated().sum()) if not cleaned_df.empty else 0,
    }


def get_dtype_summary(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["列名", "数据类型"])
    return pd.DataFrame({"列名": df.columns, "数据类型": df.dtypes.astype(str).values})


def _records(df: pd.DataFrame, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    out = df.head(limit).copy() if limit else df.copy()
    out = out.replace({np.nan: None, pd.NaT: None})
    records = out.to_dict(orient="records")
    for row in records:
        for key, value in list(row.items()):
            if isinstance(value, (datetime, date, pd.Timestamp)):
                row[key] = value.isoformat()
            elif isinstance(value, np.generic):
                row[key] = value.item()
    return records


def _column_groups(df: pd.DataFrame) -> Tuple[List[str], List[str], List[str]]:
    numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
    datetime_columns = df.select_dtypes(include=["datetime", "datetimetz"]).columns.tolist()
    categorical_columns = [c for c in df.columns if c not in numeric_columns and c not in datetime_columns]
    return numeric_columns, categorical_columns, datetime_columns


def clean_dataset_request(
    *,
    dataset_id: Optional[str] = None,
    data: Any = None,
    selected_columns: Optional[List[str]] = None,
    drop_duplicates: bool = False,
    numeric_missing_method: str = "不处理",
    categorical_missing_method: str = "不处理",
    outlier_method: str = "不处理",
    type_config: Optional[Mapping[str, str]] = None,
) -> CleanResult:
    original_df = get_dataset_dataframe(dataset_id=dataset_id, data=data)
    before_selected = original_df[selected_columns].copy() if selected_columns else original_df.copy()
    cleaned_df = clean_data(
        original_df,
        selected_columns=selected_columns,
        drop_duplicates=drop_duplicates,
        numeric_missing_method=numeric_missing_method,
        categorical_missing_method=categorical_missing_method,
        outlier_method=outlier_method,
        type_config=type_config,
    )

    cleaned_id = register_dataset_dataframe(
        cleaned_df,
        source_dataset_id=dataset_id,
        kind="cleaned",
        meta={
            "selected_columns": selected_columns or original_df.columns.tolist(),
            "drop_duplicates": drop_duplicates,
            "numeric_missing_method": numeric_missing_method,
            "categorical_missing_method": categorical_missing_method,
            "outlier_method": outlier_method,
            "type_config": dict(type_config or {}),
        },
    )

    numeric_columns, categorical_columns, datetime_columns = _column_groups(cleaned_df)
    return CleanResult(
        cleaned_dataset_id=cleaned_id,
        original_df=before_selected,
        cleaned_df=cleaned_df,
        cleaning_summary=get_cleaning_summary(before_selected, cleaned_df),
        missing_value_summary_before=_records(get_missing_value_summary(before_selected)),
        missing_value_summary_after=_records(get_missing_value_summary(cleaned_df)),
        dtype_summary_before=_records(get_dtype_summary(before_selected)),
        dtype_summary_after=_records(get_dtype_summary(cleaned_df)),
        preview=_records(cleaned_df, limit=50),
        columns=cleaned_df.columns.tolist(),
        numeric_columns=numeric_columns,
        categorical_columns=categorical_columns,
        datetime_columns=datetime_columns,
    )


def get_dataset_profile(dataset_id: Optional[str] = None, data: Any = None) -> Dict[str, Any]:
    df = get_dataset_dataframe(dataset_id=dataset_id, data=data)
    numeric_columns, categorical_columns, datetime_columns = _column_groups(df)
    return {
        "dataset_id": dataset_id,
        "rows": int(df.shape[0]),
        "columns_count": int(df.shape[1]),
        "columns": df.columns.tolist(),
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "datetime_columns": datetime_columns,
        "missing_value_summary": _records(get_missing_value_summary(df)),
        "dtype_summary": _records(get_dtype_summary(df)),
        "preview": _records(df, limit=50),
    }
