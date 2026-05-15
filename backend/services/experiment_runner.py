from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor


class ExperimentError(Exception):
    """实验运行错误。"""
    pass


def make_one_hot_encoder():
    """
    兼容不同 sklearn 版本。
    新版本使用 sparse_output，旧版本使用 sparse。
    """
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric_features = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_features = X.select_dtypes(
        include=["object", "category", "bool"]
    ).columns.tolist()

    transformers = []

    if numeric_features:
        numeric_pipeline = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]
        )
        transformers.append(("num", numeric_pipeline, numeric_features))

    if categorical_features:
        categorical_pipeline = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", make_one_hot_encoder()),
            ]
        )
        transformers.append(("cat", categorical_pipeline, categorical_features))

    if not transformers:
        raise ExperimentError("没有可用于建模的特征列。")

    return ColumnTransformer(transformers=transformers)


def get_classifier(model_name: str):
    if model_name == "logistic_regression":
        return LogisticRegression(max_iter=1000)

    if model_name == "random_forest":
        return RandomForestClassifier(
            n_estimators=100,
            random_state=42,
            n_jobs=-1,
        )

    if model_name == "decision_tree":
        return DecisionTreeClassifier(random_state=42)

    if model_name == "knn":
        return KNeighborsClassifier(n_neighbors=5)

    raise ExperimentError(f"暂不支持分类模型：{model_name}")


def get_regressor(model_name: str):
    if model_name == "linear_regression":
        return LinearRegression()

    if model_name == "random_forest_regressor":
        return RandomForestRegressor(
            n_estimators=100,
            random_state=42,
            n_jobs=-1,
        )

    if model_name == "decision_tree_regressor":
        return DecisionTreeRegressor(random_state=42)

    if model_name == "knn_regressor":
        return KNeighborsRegressor(n_neighbors=5)

    raise ExperimentError(f"暂不支持回归模型：{model_name}")


def clean_target(y: pd.Series) -> pd.Series:
    """
    目标变量不能有缺失值。
    """
    return y


def safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None

        if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
            return None

        return float(value)
    except Exception:
        return None


def run_classification_experiment(
    df: pd.DataFrame,
    target_column: str,
    model_names: list[str],
    test_size: float,
    random_state: int,
) -> list[dict[str, Any]]:
    if target_column not in df.columns:
        raise ExperimentError("目标变量不存在。")

    data = df.dropna(subset=[target_column]).copy()

    if data.empty:
        raise ExperimentError("删除目标变量缺失值后，数据为空。")

    X = data.drop(columns=[target_column])
    y = clean_target(data[target_column])

    if y.nunique() < 2:
        raise ExperimentError("分类任务至少需要两个类别。")

    stratify = y if y.nunique() <= min(20, len(y) // 2) else None

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=test_size,
            random_state=random_state,
            stratify=stratify,
        )
    except ValueError:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=test_size,
            random_state=random_state,
            stratify=None,
        )

    results = []

    for model_name in model_names:
        preprocessor = build_preprocessor(X_train)
        model = get_classifier(model_name)

        pipeline = Pipeline(
            steps=[
                ("preprocess", preprocessor),
                ("model", model),
            ]
        )

        try:
            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)

            accuracy = accuracy_score(y_test, y_pred)
            f1_macro = f1_score(y_test, y_pred, average="macro")

            roc_auc = None

            if hasattr(pipeline, "predict_proba") and y.nunique() == 2:
                try:
                    y_proba = pipeline.predict_proba(X_test)[:, 1]
                    roc_auc = roc_auc_score(y_test, y_proba)
                except Exception:
                    roc_auc = None

            results.append(
                {
                    "model_name": model_name,
                    "task_type": "classification",
                    "accuracy": safe_float(accuracy),
                    "f1_macro": safe_float(f1_macro),
                    "roc_auc": safe_float(roc_auc),
                    "train_rows": int(len(X_train)),
                    "test_rows": int(len(X_test)),
                    "status": "ok",
                    "error": None,
                }
            )

        except Exception as e:
            results.append(
                {
                    "model_name": model_name,
                    "task_type": "classification",
                    "accuracy": None,
                    "f1_macro": None,
                    "roc_auc": None,
                    "train_rows": int(len(X_train)),
                    "test_rows": int(len(X_test)),
                    "status": "failed",
                    "error": str(e),
                }
            )

    return results


def run_regression_experiment(
    df: pd.DataFrame,
    target_column: str,
    model_names: list[str],
    test_size: float,
    random_state: int,
) -> list[dict[str, Any]]:
    if target_column not in df.columns:
        raise ExperimentError("目标变量不存在。")

    data = df.dropna(subset=[target_column]).copy()

    if data.empty:
        raise ExperimentError("删除目标变量缺失值后，数据为空。")

    if not pd.api.types.is_numeric_dtype(data[target_column]):
        raise ExperimentError("回归任务的目标变量必须是数值型。")

    X = data.drop(columns=[target_column])
    y = data[target_column]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
    )

    results = []

    for model_name in model_names:
        preprocessor = build_preprocessor(X_train)
        model = get_regressor(model_name)

        pipeline = Pipeline(
            steps=[
                ("preprocess", preprocessor),
                ("model", model),
            ]
        )

        try:
            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)

            mae = mean_absolute_error(y_test, y_pred)
            rmse = mean_squared_error(y_test, y_pred) ** 0.5
            r2 = r2_score(y_test, y_pred)

            results.append(
                {
                    "model_name": model_name,
                    "task_type": "regression",
                    "mae": safe_float(mae),
                    "rmse": safe_float(rmse),
                    "r2": safe_float(r2),
                    "train_rows": int(len(X_train)),
                    "test_rows": int(len(X_test)),
                    "status": "ok",
                    "error": None,
                }
            )

        except Exception as e:
            results.append(
                {
                    "model_name": model_name,
                    "task_type": "regression",
                    "mae": None,
                    "rmse": None,
                    "r2": None,
                    "train_rows": int(len(X_train)),
                    "test_rows": int(len(X_test)),
                    "status": "failed",
                    "error": str(e),
                }
            )

    return results


def run_experiment(
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
    model_names: list[str],
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict[str, Any]:
    if not model_names:
        raise ExperimentError("请至少选择一个模型。")

    if test_size <= 0 or test_size >= 0.9:
        raise ExperimentError("test_size 应该在 0 到 0.9 之间。")

    if task_type == "classification":
        results = run_classification_experiment(
            df=df,
            target_column=target_column,
            model_names=model_names,
            test_size=test_size,
            random_state=random_state,
        )

    elif task_type == "regression":
        results = run_regression_experiment(
            df=df,
            target_column=target_column,
            model_names=model_names,
            test_size=test_size,
            random_state=random_state,
        )

    else:
        raise ExperimentError(f"暂不支持任务类型：{task_type}")

    return {
        "target_column": target_column,
        "task_type": task_type,
        "test_size": test_size,
        "random_state": random_state,
        "results": results,
    }