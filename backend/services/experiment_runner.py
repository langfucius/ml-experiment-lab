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

from backend.services.noise_generator import (
    NoiseError,
    apply_noise_to_xy,
    make_dynamic_values,
)


class ExperimentError(Exception):
    """实验运行错误。"""
    pass


def make_one_hot_encoder():
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


def get_classifier(model_name: str, model_params: dict[str, Any] | None = None):
    model_params = model_params or {}

    if model_name == "logistic_regression":
        return LogisticRegression(
            C=float(model_params.get("C", 1.0)),
            max_iter=1000,
        )

    if model_name == "random_forest":
        return RandomForestClassifier(
            n_estimators=int(model_params.get("n_estimators", 100)),
            max_depth=model_params.get("max_depth", None),
            min_samples_split=int(model_params.get("min_samples_split", 2)),
            random_state=42,
            n_jobs=-1,
        )

    if model_name == "decision_tree":
        return DecisionTreeClassifier(
            max_depth=model_params.get("max_depth", None),
            min_samples_split=int(model_params.get("min_samples_split", 2)),
            random_state=42,
        )

    if model_name == "knn":
        return KNeighborsClassifier(
            n_neighbors=int(model_params.get("n_neighbors", 5)),
        )

    raise ExperimentError(f"暂不支持分类模型：{model_name}")


def get_regressor(model_name: str, model_params: dict[str, Any] | None = None):
    model_params = model_params or {}

    if model_name == "linear_regression":
        return LinearRegression()

    if model_name == "random_forest_regressor":
        return RandomForestRegressor(
            n_estimators=int(model_params.get("n_estimators", 100)),
            max_depth=model_params.get("max_depth", None),
            min_samples_split=int(model_params.get("min_samples_split", 2)),
            random_state=42,
            n_jobs=-1,
        )

    if model_name == "decision_tree_regressor":
        return DecisionTreeRegressor(
            max_depth=model_params.get("max_depth", None),
            min_samples_split=int(model_params.get("min_samples_split", 2)),
            random_state=42,
        )

    if model_name == "knn_regressor":
        return KNeighborsRegressor(
            n_neighbors=int(model_params.get("n_neighbors", 5)),
        )

    raise ExperimentError(f"暂不支持回归模型：{model_name}")


def safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None

        if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
            return None

        return float(value)
    except Exception:
        return None


def prepare_xy(
    df: pd.DataFrame,
    target_column: str,
) -> tuple[pd.DataFrame, pd.Series]:
    if target_column not in df.columns:
        raise ExperimentError("目标变量不存在。")

    data = df.dropna(subset=[target_column]).copy()

    if data.empty:
        raise ExperimentError("删除目标变量缺失值后，数据为空。")

    X = data.drop(columns=[target_column])
    y = data[target_column]

    return X, y


def evaluate_classification(
    X: pd.DataFrame,
    y: pd.Series,
    model_name: str,
    test_size: float,
    random_state: int,
    model_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
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

    preprocessor = build_preprocessor(X_train)
    model = get_classifier(model_name, model_params=model_params)

    pipeline = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", model),
        ]
    )

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

    return {
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


def evaluate_regression(
    X: pd.DataFrame,
    y: pd.Series,
    model_name: str,
    test_size: float,
    random_state: int,
    model_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not pd.api.types.is_numeric_dtype(y):
        raise ExperimentError("回归任务的目标变量必须是数值型。")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
    )

    preprocessor = build_preprocessor(X_train)
    model = get_regressor(model_name, model_params=model_params)

    pipeline = Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("model", model),
        ]
    )

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred) ** 0.5
    r2 = r2_score(y_test, y_pred)

    return {
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


def evaluate_single_model(
    X: pd.DataFrame,
    y: pd.Series,
    task_type: str,
    model_name: str,
    test_size: float,
    random_state: int,
    model_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if task_type == "classification":
        return evaluate_classification(
            X=X,
            y=y,
            model_name=model_name,
            test_size=test_size,
            random_state=random_state,
            model_params=model_params,
        )

    if task_type == "regression":
        return evaluate_regression(
            X=X,
            y=y,
            model_name=model_name,
            test_size=test_size,
            random_state=random_state,
            model_params=model_params,
        )

    raise ExperimentError(f"暂不支持任务类型：{task_type}")


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

    X, y = prepare_xy(df, target_column)

    results = []

    for model_name in model_names:
        try:
            result = evaluate_single_model(
                X=X,
                y=y,
                task_type=task_type,
                model_name=model_name,
                test_size=test_size,
                random_state=random_state,
            )
            results.append(result)

        except Exception as e:
            results.append(
                {
                    "model_name": model_name,
                    "task_type": task_type,
                    "status": "failed",
                    "error": str(e),
                    "train_rows": 0,
                    "test_rows": 0,
                }
            )

    return {
        "target_column": target_column,
        "task_type": task_type,
        "test_size": test_size,
        "random_state": random_state,
        "results": results,
    }


def build_dynamic_model_params(
    dynamic_variable: str,
    value: float,
) -> dict[str, Any]:
    """
    当动态变量是模型参数时，将 value 转成对应参数。
    """
    if dynamic_variable == "n_estimators":
        return {"n_estimators": max(1, int(round(value)))}

    if dynamic_variable == "max_depth":
        depth = int(round(value))
        return {"max_depth": None if depth <= 0 else depth}

    if dynamic_variable == "min_samples_split":
        return {"min_samples_split": max(2, int(round(value)))}

    if dynamic_variable == "n_neighbors":
        return {"n_neighbors": max(1, int(round(value)))}

    if dynamic_variable == "C":
        return {"C": max(0.0001, float(value))}

    return {}


def run_dynamic_experiment(
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
    model_name: str,
    dynamic_variable: str,
    start: float,
    end: float,
    steps: int,
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    动态实验：
    每次改变一个变量，重复训练模型，返回指标曲线。
    """
    X_raw, y_raw = prepare_xy(df, target_column)

    values = make_dynamic_values(start=start, end=end, steps=steps)
    curve = []

    for index, value in enumerate(values):
        label_noise_rate = 0.0
        feature_noise_std = 0.0
        missing_rate = 0.0
        model_params: dict[str, Any] = {}

        if dynamic_variable == "label_noise_rate":
            label_noise_rate = value

        elif dynamic_variable == "feature_noise_std":
            feature_noise_std = value

        elif dynamic_variable == "missing_rate":
            missing_rate = value

        else:
            model_params = build_dynamic_model_params(
                dynamic_variable=dynamic_variable,
                value=value,
            )

        try:
            X_noisy, y_noisy = apply_noise_to_xy(
                X=X_raw,
                y=y_raw,
                task_type=task_type,
                label_noise_rate=label_noise_rate,
                feature_noise_std=feature_noise_std,
                missing_rate=missing_rate,
                random_state=random_state + index * 13,
            )

            result = evaluate_single_model(
                X=X_noisy,
                y=y_noisy,
                task_type=task_type,
                model_name=model_name,
                test_size=test_size,
                random_state=random_state,
                model_params=model_params,
            )

            curve.append(
                {
                    "x": value,
                    "dynamic_variable": dynamic_variable,
                    "model_name": model_name,
                    "task_type": task_type,
                    "label_noise_rate": label_noise_rate,
                    "feature_noise_std": feature_noise_std,
                    "missing_rate": missing_rate,
                    "model_params": model_params,
                    **result,
                }
            )

        except (ExperimentError, NoiseError, Exception) as e:
            curve.append(
                {
                    "x": value,
                    "dynamic_variable": dynamic_variable,
                    "model_name": model_name,
                    "task_type": task_type,
                    "status": "failed",
                    "error": str(e),
                }
            )

    return {
        "target_column": target_column,
        "task_type": task_type,
        "model_name": model_name,
        "dynamic_variable": dynamic_variable,
        "values": values,
        "curve": curve,
    }