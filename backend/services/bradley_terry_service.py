from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy.optimize import minimize

from backend.services.data_service import get_dataset
from backend.services.experiment_runner import (
    ExperimentError,
    build_dynamic_model_params,
    evaluate_single_model,
    prepare_xy,
)
from backend.services.noise_generator import apply_noise_to_xy, make_dynamic_values


class BradleyTerryError(Exception):
    """Bradley-Terry 测评错误。"""
    pass


HIGHER_IS_BETTER = {
    "accuracy": True,
    "f1_macro": True,
    "roc_auc": True,
    "r2": True,
    "mae": False,
    "rmse": False,
}


def get_metric_value(result: dict[str, Any], metric: str) -> float | None:
    value = result.get(metric)

    if value is None:
        return None

    try:
        value = float(value)
    except Exception:
        return None

    if np.isnan(value) or np.isinf(value):
        return None

    return value


def compare_metric(a: float, b: float, metric: str) -> int:
    """
    返回：
    1  表示 a 胜 b
    -1 表示 b 胜 a
    0  表示平局
    """
    higher_better = HIGHER_IS_BETTER.get(metric, True)

    if abs(a - b) < 1e-12:
        return 0

    if higher_better:
        return 1 if a > b else -1

    return 1 if a < b else -1


def fit_bradley_terry(
    model_names: list[str],
    win_matrix: dict[str, dict[str, int]],
) -> list[dict[str, Any]]:
    """
    用最大似然估计 Bradley-Terry strength score。
    P(i beats j) = exp(s_i) / (exp(s_i) + exp(s_j))
    """

    n = len(model_names)

    if n < 2:
        raise BradleyTerryError("Bradley-Terry 至少需要两个模型。")

    name_to_idx = {name: idx for idx, name in enumerate(model_names)}

    pairs = []

    for i_name in model_names:
        for j_name in model_names:
            if i_name == j_name:
                continue

            wins_ij = win_matrix.get(i_name, {}).get(j_name, 0)

            if wins_ij > 0:
                pairs.append(
                    (
                        name_to_idx[i_name],
                        name_to_idx[j_name],
                        wins_ij,
                    )
                )

    if not pairs:
        raise BradleyTerryError("没有有效胜负关系，无法拟合 Bradley-Terry 模型。")

    def negative_log_likelihood(raw_scores: np.ndarray) -> float:
        # 固定均值为 0，避免不可识别
        scores = raw_scores - np.mean(raw_scores)

        loss = 0.0

        for i, j, wins in pairs:
            si = scores[i]
            sj = scores[j]

            # log P(i beats j)
            log_prob = si - np.logaddexp(si, sj)
            loss -= wins * log_prob

        return float(loss)

    init = np.zeros(n)

    result = minimize(
        negative_log_likelihood,
        init,
        method="BFGS",
    )

    if not result.success:
        # 不直接失败，因为小样本时也可能能给出近似结果
        scores = result.x - np.mean(result.x)
    else:
        scores = result.x - np.mean(result.x)

    exp_scores = np.exp(scores)
    strengths = exp_scores / exp_scores.sum()

    ranking = []

    for name, score, strength in zip(model_names, scores, strengths):
        total_wins = sum(win_matrix.get(name, {}).values())

        total_losses = 0
        for other in model_names:
            if other == name:
                continue
            total_losses += win_matrix.get(other, {}).get(name, 0)

        total_games = total_wins + total_losses
        win_rate = total_wins / total_games if total_games > 0 else None

        ranking.append(
            {
                "model_name": name,
                "bt_score": float(score),
                "strength": float(strength),
                "wins": int(total_wins),
                "losses": int(total_losses),
                "total_games": int(total_games),
                "win_rate": float(win_rate) if win_rate is not None else None,
            }
        )

    ranking.sort(key=lambda item: item["bt_score"], reverse=True)

    for rank, item in enumerate(ranking, start=1):
        item["rank"] = rank

    return ranking


def run_bradley_terry_benchmark(
    dataset_id: str,
    target_column: str,
    task_type: str,
    model_names: list[str],
    metric: str,
    dynamic_variable: str,
    start: float,
    end: float,
    steps: int,
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict[str, Any]:
    if len(model_names) < 2:
        raise BradleyTerryError("请至少选择两个模型。")

    if metric not in HIGHER_IS_BETTER:
        raise BradleyTerryError(f"不支持的指标：{metric}")

    df = get_dataset(dataset_id)
    X_raw, y_raw = prepare_xy(df, target_column)

    values = make_dynamic_values(start=start, end=end, steps=steps)

    experiment_rows: list[dict[str, Any]] = []

    win_matrix: dict[str, dict[str, int]] = {
        model: {other: 0 for other in model_names if other != model}
        for model in model_names
    }

    for condition_index, value in enumerate(values):
        condition_results = []

        label_noise_rate = 0.0
        feature_noise_std = 0.0
        missing_rate = 0.0

        if dynamic_variable == "label_noise_rate":
            label_noise_rate = value
        elif dynamic_variable == "feature_noise_std":
            feature_noise_std = value
        elif dynamic_variable == "missing_rate":
            missing_rate = value

        try:
            X_noisy, y_noisy = apply_noise_to_xy(
                X=X_raw,
                y=y_raw,
                task_type=task_type,
                label_noise_rate=label_noise_rate,
                feature_noise_std=feature_noise_std,
                missing_rate=missing_rate,
                random_state=random_state + condition_index * 13,
            )
        except Exception as e:
            raise BradleyTerryError(f"噪声生成失败：{e}") from e

        for model_name in model_names:
            model_params: dict[str, Any] = {}

            if dynamic_variable not in [
                "label_noise_rate",
                "feature_noise_std",
                "missing_rate",
            ]:
                model_params = build_dynamic_model_params(
                    dynamic_variable=dynamic_variable,
                    value=value,
                )

            try:
                result = evaluate_single_model(
                    X=X_noisy,
                    y=y_noisy,
                    task_type=task_type,
                    model_name=model_name,
                    test_size=test_size,
                    random_state=random_state,
                    model_params=model_params,
                )

                metric_value = get_metric_value(result, metric)

                row = {
                    "condition_index": condition_index,
                    "dynamic_variable": dynamic_variable,
                    "dynamic_value": value,
                    "model_name": model_name,
                    "metric": metric,
                    "metric_value": metric_value,
                    "status": result.get("status", "ok"),
                    "error": result.get("error"),
                    **result,
                }

            except Exception as e:
                row = {
                    "condition_index": condition_index,
                    "dynamic_variable": dynamic_variable,
                    "dynamic_value": value,
                    "model_name": model_name,
                    "metric": metric,
                    "metric_value": None,
                    "status": "failed",
                    "error": str(e),
                }

            condition_results.append(row)
            experiment_rows.append(row)

        # 同一个 condition 下做成对比较
        for i in range(len(condition_results)):
            for j in range(i + 1, len(condition_results)):
                a = condition_results[i]
                b = condition_results[j]

                a_value = a.get("metric_value")
                b_value = b.get("metric_value")

                if a_value is None or b_value is None:
                    continue

                cmp_result = compare_metric(a_value, b_value, metric)

                a_name = a["model_name"]
                b_name = b["model_name"]

                if cmp_result > 0:
                    win_matrix[a_name][b_name] += 1
                elif cmp_result < 0:
                    win_matrix[b_name][a_name] += 1
                else:
                    # 平局不计入胜负
                    pass

    ranking = fit_bradley_terry(model_names, win_matrix)

    return {
        "dataset_id": dataset_id,
        "target_column": target_column,
        "task_type": task_type,
        "model_names": model_names,
        "metric": metric,
        "dynamic_variable": dynamic_variable,
        "values": values,
        "win_matrix": win_matrix,
        "ranking": ranking,
        "experiment_rows": experiment_rows,
    }