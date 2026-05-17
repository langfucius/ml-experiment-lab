from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.llm_client import LLMClientError, call_deepseek


router = APIRouter(prefix="/api/report", tags=["Report"])


class ReportGenerateRequest(BaseModel):
    api_key: str
    base_url: str = Field(default="https://api.deepseek.com")
    model_name: str = Field(default="deepseek-v4-flash")
    temperature: float = Field(default=0.4, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096, ge=512, le=8192)

    dataset_summary: dict[str, Any] | None = None
    cleaning_result: dict[str, Any] | None = None
    experiment_result: dict[str, Any] | None = None
    dynamic_result: dict[str, Any] | None = None
    bradley_terry_result: dict[str, Any] | None = None

    report_language: str = Field(default="中文")
    report_style: str = Field(default="学术但易读")


class ReportGenerateResponse(BaseModel):
    ok: bool
    report_markdown: str
    model_name: str


def build_report_prompt(payload: ReportGenerateRequest) -> str:
    return f"""
你是一个严谨的机器学习实验报告撰写助手。

请根据用户提供的机器学习实验信息，生成一份结构化 Markdown 报告。

要求：
1. 使用语言：{payload.report_language}
2. 写作风格：{payload.report_style}
3. 不要编造没有提供的数据。
4. 如果某个模块没有提供结果，请明确写“本次未提供该部分结果”。
5. 不要只罗列指标，要解释这些指标意味着什么。
6. 对数据质量、模型表现、噪声鲁棒性、Bradley-Terry 综合排名分别给出分析。
7. 最后给出后续优化建议。
8. 报告适合放进课程项目 / 简历项目 / GitHub README 的技术说明中。

请按下面结构输出：

# 机器学习实验与鲁棒性评估报告

## 1. 项目目标

## 2. 数据集概览

## 3. 数据清洗与数据质量分析

## 4. 探索性分析总结

## 5. 基础模型实验结果

## 6. 动态参数 / 噪声鲁棒性分析

## 7. Bradley-Terry 综合测评结果

## 8. 主要发现

## 9. 局限性

## 10. 后续优化建议

下面是实验数据，JSON 内容可能不完整，请只基于已有信息分析。

【数据集摘要】
{payload.dataset_summary}

【清洗结果】
{payload.cleaning_result}

【基础实验结果】
{payload.experiment_result}

【动态实验结果】
{payload.dynamic_result}

【Bradley-Terry 测评结果】
{payload.bradley_terry_result}
""".strip()


@router.post("/generate", response_model=ReportGenerateResponse)
def generate_report(payload: ReportGenerateRequest):
    prompt = build_report_prompt(payload)

    try:
        report = call_deepseek(
            api_key=payload.api_key,
            base_url=payload.base_url,
            model_name=payload.model_name,
            messages=[
                {
                    "role": "system",
                    "content": "你是一个严谨、专业、善于解释机器学习实验结果的报告撰写助手。",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
        )

        return ReportGenerateResponse(
            ok=True,
            report_markdown=report,
            model_name=payload.model_name,
        )

    except LLMClientError as e:
        raise HTTPException(status_code=400, detail=str(e))