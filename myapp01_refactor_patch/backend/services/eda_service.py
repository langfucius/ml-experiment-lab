"""EDA plotting service compatible with the old Streamlit visualization module."""
from __future__ import annotations

import base64
import io
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from backend.services.cleaning_service import get_dataset_dataframe

plt.rcParams["font.sans-serif"] = ["SimHei", "Microsoft YaHei", "Arial Unicode MS", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False


def _fig_to_base64(fig) -> str:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _check_column(df: pd.DataFrame, column: Optional[str], name: str) -> str:
    if not column:
        raise ValueError(f"缺少字段: {name}")
    if column not in df.columns:
        raise ValueError(f"字段不存在: {column}")
    return column


def _non_empty(data: Any, msg: str) -> None:
    if data is None:
        raise ValueError(msg)
    if hasattr(data, "empty") and data.empty:
        raise ValueError(msg)
    if hasattr(data, "__len__") and len(data) == 0:
        raise ValueError(msg)


def _plot_histogram(df: pd.DataFrame, column: str):
    data = df[column].dropna()
    _non_empty(data, "该字段删除缺失值后为空，无法绘制直方图")
    fig, ax = plt.subplots(figsize=(8, 5))
    sns.histplot(data, kde=True, ax=ax)
    ax.set_title(f"{column} 的分布直方图")
    ax.set_xlabel(column)
    ax.set_ylabel("频数")
    return fig


def _plot_boxplot(df: pd.DataFrame, column: str):
    data = df[column].dropna()
    _non_empty(data, "该字段删除缺失值后为空，无法绘制箱线图")
    fig, ax = plt.subplots(figsize=(8, 5))
    sns.boxplot(x=data, ax=ax)
    ax.set_title(f"{column} 的箱线图")
    ax.set_xlabel(column)
    return fig


def _plot_bar_chart(df: pd.DataFrame, column: str, top_n: int = 10):
    value_counts = df[column].astype(str).value_counts().head(top_n)
    _non_empty(value_counts, "该字段没有可统计类别，无法绘制条形图")
    fig, ax = plt.subplots(figsize=(8, 5))
    sns.barplot(x=value_counts.values, y=value_counts.index, ax=ax)
    ax.set_title(f"{column} 的前 {top_n} 个类别计数图")
    ax.set_xlabel("数量")
    ax.set_ylabel(column)
    return fig


def _plot_scatter(df: pd.DataFrame, x_col: str, y_col: str, hue_col: Optional[str] = None):
    cols = [x_col, y_col] + ([hue_col] if hue_col and hue_col in df.columns else [])
    plot_df = df[cols].dropna()
    _non_empty(plot_df, "删除缺失值后为空，无法绘制散点图")
    fig, ax = plt.subplots(figsize=(8, 6))
    if hue_col and hue_col in df.columns:
        sns.scatterplot(data=plot_df, x=x_col, y=y_col, hue=hue_col, ax=ax)
    else:
        sns.scatterplot(data=plot_df, x=x_col, y=y_col, ax=ax)
    ax.set_title(f"{x_col} vs {y_col} 散点图")
    return fig


def _plot_line_chart(df: pd.DataFrame, x_col: str, y_col: str):
    plot_df = df[[x_col, y_col]].dropna().copy()
    _non_empty(plot_df, "删除缺失值后为空，无法绘制折线图")
    if len(plot_df) < 2:
        raise ValueError("折线图至少需要 2 个数据点")
    try:
        plot_df = plot_df.sort_values(by=x_col)
    except Exception:
        pass
    fig, ax = plt.subplots(figsize=(10, 6))
    sns.lineplot(data=plot_df, x=x_col, y=y_col, ax=ax)
    ax.set_title(f"{y_col} 随 {x_col} 变化")
    plt.xticks(rotation=45)
    return fig


def _plot_grouped_boxplot(df: pd.DataFrame, x_col: str, y_col: str):
    plot_df = df[[x_col, y_col]].dropna()
    _non_empty(plot_df, "删除缺失值后为空，无法绘制分组箱线图")
    if plot_df[x_col].nunique() < 2:
        raise ValueError(f"分组变量 {x_col} 少于 2 个类别")
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.boxplot(data=plot_df, x=x_col, y=y_col, ax=ax)
    ax.set_title(f"{y_col} 按 {x_col} 分组箱线图")
    plt.xticks(rotation=45)
    return fig


def _plot_correlation_heatmap(df: pd.DataFrame, columns: List[str]):
    if not columns or len(columns) < 2:
        raise ValueError("相关性热力图至少需要 2 个字段")
    existing = [c for c in columns if c in df.columns]
    if len(existing) < 2:
        raise ValueError("有效字段不足 2 个")
    temp = df[existing].apply(pd.to_numeric, errors="coerce").dropna()
    _non_empty(temp, "字段转数值并删除缺失值后为空，无法计算相关性")
    if temp.shape[0] < 2:
        raise ValueError("至少需要 2 行有效数据")
    non_constant = [c for c in temp.columns if temp[c].nunique() > 1]
    if len(non_constant) < 2:
        raise ValueError("非常数数值字段不足 2 个，无法计算相关性")
    corr = temp[non_constant].corr()
    if corr.empty or corr.isnull().all().all():
        raise ValueError("相关性矩阵全为空")
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(corr, annot=True, cmap="coolwarm", fmt=".2f", ax=ax, square=True, cbar_kws={"shrink": 0.8})
    ax.set_title("相关性热力图")
    return fig


def _plot_missing_values(df: pd.DataFrame):
    missing_counts = df.isnull().sum()
    missing_counts = missing_counts[missing_counts > 0].sort_values(ascending=False)
    if missing_counts.empty:
        # Still return a useful chart instead of failing.
        fig, ax = plt.subplots(figsize=(8, 4))
        ax.text(0.5, 0.5, "当前数据没有缺失值", ha="center", va="center", fontsize=14)
        ax.axis("off")
        return fig
    fig, ax = plt.subplots(figsize=(10, max(5, len(missing_counts) * 0.3)))
    sns.barplot(x=missing_counts.values, y=missing_counts.index, ax=ax)
    ax.set_title("各列缺失值数量")
    ax.set_xlabel("缺失值数量")
    ax.set_ylabel("列名")
    return fig


def generate_eda_plot(
    *,
    dataset_id: Optional[str] = None,
    data: Any = None,
    chart_type: str,
    column: Optional[str] = None,
    x_col: Optional[str] = None,
    y_col: Optional[str] = None,
    hue_col: Optional[str] = None,
    columns: Optional[List[str]] = None,
    top_n: int = 10,
) -> Dict[str, Any]:
    df = get_dataset_dataframe(dataset_id=dataset_id, data=data)
    if df.empty:
        raise ValueError("数据为空，无法绘图")

    chart_type = chart_type.strip()
    if chart_type == "histogram":
        fig = _plot_histogram(df, _check_column(df, column, "column"))
    elif chart_type == "boxplot":
        fig = _plot_boxplot(df, _check_column(df, column, "column"))
    elif chart_type == "bar":
        fig = _plot_bar_chart(df, _check_column(df, column, "column"), top_n=top_n)
    elif chart_type == "scatter":
        fig = _plot_scatter(df, _check_column(df, x_col, "x_col"), _check_column(df, y_col, "y_col"), hue_col=hue_col)
    elif chart_type == "line":
        fig = _plot_line_chart(df, _check_column(df, x_col, "x_col"), _check_column(df, y_col, "y_col"))
    elif chart_type == "grouped_boxplot":
        fig = _plot_grouped_boxplot(df, _check_column(df, x_col, "x_col"), _check_column(df, y_col, "y_col"))
    elif chart_type == "correlation_heatmap":
        fig = _plot_correlation_heatmap(df, columns or [])
    elif chart_type == "missing_values":
        fig = _plot_missing_values(df)
    else:
        raise ValueError(f"不支持的图表类型: {chart_type}")

    plt.tight_layout()
    return {
        "chart_type": chart_type,
        "image_base64": _fig_to_base64(fig),
        "mime_type": "image/png",
    }
