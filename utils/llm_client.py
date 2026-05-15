import requests


class LLMClientError(Exception):
    """LLM API 调用错误。"""
    pass


def call_deepseek(
    api_key: str,
    base_url: str,
    model_name: str,
    messages: list,
    temperature: float = 0.7,
    max_tokens: int = 1024,
    timeout: int = 60,
) -> str:
    """
    调用 DeepSeek Chat Completions API。

    参数
    ----
    api_key:
        DeepSeek API Key。
    base_url:
        例如 https://api.deepseek.com
    model_name:
        例如 deepseek-v4-flash
    messages:
        OpenAI 风格消息列表，例如：
        [{"role": "user", "content": "你好"}]
    temperature:
        生成随机性。
    max_tokens:
        最大输出 token 数。
    timeout:
        请求超时时间。

    返回
    ----
    str:
        模型返回的文本内容。
    """
    if not api_key:
        raise LLMClientError("缺少 API Key。")

    if not base_url:
        raise LLMClientError("缺少 Base URL。")

    if not model_name:
        raise LLMClientError("缺少模型名称。")

    if not messages:
        raise LLMClientError("messages 不能为空。")

    url = base_url.rstrip("/") + "/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=timeout,
        )
    except requests.RequestException as e:
        raise LLMClientError(f"请求 DeepSeek API 失败：{e}") from e

    if response.status_code != 200:
        raise LLMClientError(
            f"DeepSeek API 返回错误：HTTP {response.status_code}\n{response.text}"
        )

    data = response.json()

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise LLMClientError(f"DeepSeek API 返回格式异常：{data}") from e


def test_deepseek_connection(
    api_key: str,
    base_url: str,
    model_name: str,
    temperature: float = 0.3,
    max_tokens: int = 128,
) -> str:
    """
    测试 DeepSeek API 是否可用。
    """
    messages = [
        {
            "role": "system",
            "content": "你是一个简洁的 API 测试助手。",
        },
        {
            "role": "user",
            "content": "请只回复四个字：连接成功",
        },
    ]

    return call_deepseek(
        api_key=api_key,
        base_url=base_url,
        model_name=model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )