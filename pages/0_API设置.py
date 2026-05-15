import streamlit as st

st.set_page_config(page_title="API 设置", layout="wide")

st.title("API 设置")
st.caption("配置 DeepSeek API，用于后续的模型解释、实验报告生成和智能分析。")

st.warning("请不要把 API Key 写入代码或提交到 GitHub。这里只保存在当前 Streamlit 会话中。")

api_key = st.text_input(
    "DeepSeek API Key",
    type="password",
    placeholder="请输入你的 DeepSeek API Key"
)

base_url = st.text_input(
    "Base URL",
    value="https://api.deepseek.com",
)

model_name = st.text_input(
    "模型名称",
    value="deepseek-v4-flash",
    help="建议先使用当前官方推荐模型名；旧的 deepseek-chat / deepseek-reasoner 以后可能停用。"
)

temperature = st.slider(
    "temperature",
    min_value=0.0,
    max_value=2.0,
    value=0.7,
    step=0.1
)

max_tokens = st.slider(
    "max_tokens",
    min_value=128,
    max_value=8192,
    value=1024,
    step=128
)

if st.button("保存 API 设置"):
    st.session_state["llm_config"] = {
        "api_key": api_key,
        "base_url": base_url,
        "model_name": model_name,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    st.success("API 设置已保存到当前会话。")

if "llm_config" in st.session_state:
    st.subheader("当前配置")
    safe_config = st.session_state["llm_config"].copy()
    safe_config["api_key"] = "已隐藏" if safe_config["api_key"] else "未填写"
    st.json(safe_config)