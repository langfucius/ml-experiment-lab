from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


class NoiseError(Exception):
    """噪声生成错误。"""
    pass


def add_label_noise(
    y: pd.Series,
    noise_rate: float,
    random_state: int = 42,
) -> pd.Series:
    """
    分类任务标签翻转噪声。
    对一部分样本的标签随机替换为其他类别。
    """
    if noise_rate <= 0:
        return y.copy()

    if noise_rate >= 1:
        raise NoiseError("label_noise_rate 必须小于 1。")

    y_noisy = y.copy()
    classes = list(pd.Series(y_noisy).dropna().unique())

    if len(classes) < 2:
        raise NoiseError("标签噪声至少需要两个类别。")

    rng = np.random.default_rng(random_state)

    n = len(y_noisy)
    n_flip = int(n * noise_rate)

    if n_flip <= 0:
        return y_noisy

    flip_indices = rng.choice(n, size=n_flip, replace=False)

    for pos in flip_indices:
        current = y_noisy.iloc[pos]
        candidates = [c for c in classes if c != current]

        if candidates:
            y_noisy.iloc[pos] = rng.choice(candidates)

    return y_noisy


def add_feature_noise(
    X: pd.DataFrame,
    noise_std: float,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    对数值特征加入高斯噪声。
    noise_std 表示相对于每列标准差的比例。
    """
    if noise_std <= 0:
        return X.copy()

    X_noisy = X.copy()
    rng = np.random.default_rng(random_state)

    numeric_cols = X_noisy.select_dtypes(include=["number"]).columns

    for col in numeric_cols:
        col_std = X_noisy[col].std()

        if pd.isna(col_std) or col_std == 0:
            continue

        noise = rng.normal(
            loc=0.0,
            scale=noise_std * col_std,
            size=len(X_noisy),
        )

        X_noisy[col] = X_noisy[col] + noise

    return X_noisy


def add_missing_noise(
    X: pd.DataFrame,
    missing_rate: float,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    随机把特征中的一部分值置为缺失。
    不处理目标变量，只处理 X。
    """
    if missing_rate <= 0:
        return X.copy()

    if missing_rate >= 1:
        raise NoiseError("missing_rate 必须小于 1。")

    X_missing = X.copy()
    rng = np.random.default_rng(random_state)

    mask = rng.random(X_missing.shape) < missing_rate

    for row_idx, col_idx in zip(*np.where(mask)):
        X_missing.iat[row_idx, col_idx] = np.nan

    return X_missing


def apply_noise_to_xy(
    X: pd.DataFrame,
    y: pd.Series,
    task_type: str,
    label_noise_rate: float = 0.0,
    feature_noise_std: float = 0.0,
    missing_rate: float = 0.0,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    对 X 和 y 统一施加噪声。
    """
    X_new = X.copy()
    y_new = y.copy()

    if feature_noise_std > 0:
        X_new = add_feature_noise(
            X_new,
            noise_std=feature_noise_std,
            random_state=random_state,
        )

    if missing_rate > 0:
        X_new = add_missing_noise(
            X_new,
            missing_rate=missing_rate,
            random_state=random_state + 17,
        )

    if task_type == "classification" and label_noise_rate > 0:
        y_new = add_label_noise(
            y_new,
            noise_rate=label_noise_rate,
            random_state=random_state + 31,
        )

    return X_new, y_new


def make_dynamic_values(
    start: float,
    end: float,
    steps: int,
) -> list[float]:
    """
    生成动态实验点。
    """
    if steps < 2:
        return [float(start)]

    values = np.linspace(start, end, steps)

    return [float(round(v, 6)) for v in values]