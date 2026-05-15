from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from backend.services.llm_client import (
    test_deepseek_connection,
    LLMClientError,
)


router = APIRouter(prefix="/api/llm", tags=["LLM"])


class DeepSeekTestRequest(BaseModel):
    api_key: str = Field(..., description="DeepSeek API Key")
    base_url: str = Field(default="https://api.deepseek.com")
    model_name: str = Field(default="deepseek-v4-flash")
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=128, ge=1, le=8192)


class DeepSeekTestResponse(BaseModel):
    ok: bool
    message: str
    model_name: str


@router.post("/test", response_model=DeepSeekTestResponse)
def test_llm_connection(payload: DeepSeekTestRequest):
    """
    测试 DeepSeek API 连接。
    """

    try:
        result = test_deepseek_connection(
            api_key=payload.api_key,
            base_url=payload.base_url,
            model_name=payload.model_name,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
        )

        return DeepSeekTestResponse(
            ok=True,
            message=result,
            model_name=payload.model_name,
        )

    except LLMClientError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )