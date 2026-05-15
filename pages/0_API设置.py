import streamlit as st

from utils.llm_client import test_deepseek_connection, LLMClientError


st.set_page_config(page_title="API 设置", layout="wide")

st.title("API 设置")
st.caption("配置 DeepSeek API，用于后续的模型解释、实验报告生成和智能分析。")

st.warning("请不要把 API Key 写入代码或提交到 GitHub。这里只保存在当前 Streamlit 会话中。")

with st.form("deepseek_api_form"):
    api_key = st.text_input(
        "DeepSeek API Key",
        type="password",
        placeholder="请输入你的 DeepSeek API Key",
        value=st.session_state.get("llm_config", {}).get("api_key", ""),
    )

    base_url = st.text_input(
        "Base URL",
        value=st.session_state.get("llm_config", {}).get(
            "base_url",
            "https://api.deepseek.com",
        ),
    )

    model_name = st.text_input(
        "模型名称",
        value=st.session_state.get("llm_config", {}).get(
            "model_name",
            "deepseek-v4-flash",
        ),
        help="建议默认使用 deepseek-v4-flash；如果后面需要更强能力，可以改成 deepseek-v4-pro。",
    )

    temperature = st.slider(
        "temperature",
        min_value=0.0,
        max_value=2.0,
        value=float(st.session_state.get("llm_config", {}).get("temperature", 0.7)),
        step=0.1,
    )

    max_tokens = st.slider(
        "max_tokens",
        min_value=128,
        max_value=8192,
        value=int(st.session_state.get("llm_config", {}).get("max_tokens", 1024)),
        step=128,
    )

    col1, col2 = st.columns(2)

    with col1:
        save_clicked = st.form_submit_button("保存 API 设置")

    with col2:
        test_clicked = st.form_submit_button("测试连接")


if save_clicked:
    st.session_state["llm_config"] = {
        "api_key": api_key,
        "base_url": base_url,
        "model_name": model_name,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    st.success("API 设置已保存到当前会话。")


if test_clicked:
    st.session_state["llm_config"] = {
        "api_key": api_key,
        "base_url": base_url,
        "model_name": model_name,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    with st.spinner("正在测试 DeepSeek API 连接..."):
        try:
            result = test_deepseek_connection(
                api_key=api_key,
                base_url=base_url,
                model_name=model_name,
                temperature=0.3,
                max_tokens=128,
            )
            st.success("连接测试完成。")
            st.write(result)

        except LLMClientError as e:
            st.error("连接失败。")
            st.code(str(e))


if "llm_config" in st.session_state:
    st.subheader("当前 API 配置")

    safe_config = st.session_state["llm_config"].copy()
    safe_config["api_key"] = "已隐藏" if safe_config.get("api_key") else "未填写"

    st.json(safe_config)
else:
    st.info("当前还没有保存 API 配置。")