import streamlit as st

st.set_page_config(page_title="数据来源", layout="wide")

st.title("数据来源")
st.caption("从本地文件、API 或示例数据集中获取数据，并统一保存为 DataFrame。")

source_type = st.radio(
    "请选择数据来源",
    ["本地文件上传", "API 数据接入", "示例数据集"],
    horizontal=True
)

if source_type == "本地文件上传":
    st.subheader("本地文件上传")
    st.info("这里以后接入 CSV / Excel 上传逻辑。")

elif source_type == "API 数据接入":
    st.subheader("API 数据接入")
    st.info("这里以后接入 API URL、参数、headers，并将 JSON 转换为 DataFrame。")

elif source_type == "示例数据集":
    st.subheader("示例数据集")
    st.info("这里以后放 iris、wine、breast cancer 等 sklearn 示例数据。")