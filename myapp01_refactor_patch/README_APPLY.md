# myapp01 React + FastAPI 重构补丁：清洗 + EDA

本补丁不删除旧 Streamlit 项目，只覆盖/新增新版 React + FastAPI 的模块。

## 1. 覆盖文件

把压缩包解压后，将这些文件复制到你的项目根目录：

```text
backend/services/cleaning_service.py
backend/api/cleaning.py
backend/services/eda_service.py
backend/api/eda.py
frontend/src/api/mlLabApi.ts
frontend/src/pages/DataCleaning.tsx
frontend/src/pages/EDA.tsx
```

## 2. 确认 backend/main.py 已挂载路由

打开 `backend/main.py`，确保有类似内容：

```python
from backend.api.cleaning import router as cleaning_router
from backend.api.eda import router as eda_router

app.include_router(cleaning_router)
app.include_router(eda_router)
```

如果已有旧的 cleaning/eda router，只保留一份，避免重复挂载。

## 3. 确认前端路由

如果你的 `frontend/src/App.tsx` 或 router 配置里已经引用 `DataCleaning` 和 `EDA`，文件名保持一致即可。
如果页面名原本叫 `EDA.tsx` 以外的名字，请按你现有路由名改 import。

## 4. 运行

后端：

```powershell
cd D:\HuaweiMoveData\Users\CGMS2\Desktop\second_2\myapp01
.\.venv\Scripts\activate
uvicorn backend.main:app --reload --port 8000
```

前端：

```powershell
cd D:\HuaweiMoveData\Users\CGMS2\Desktop\second_2\myapp01\frontend
npm run dev
```

## 5. 兼容说明

- 清洗服务完整覆盖旧版 `utils/data_cleaning.py` 的能力。
- EDA 服务覆盖旧版 `utils/visualization.py` 中的基础 EDA 图：histogram、boxplot、bar、scatter、line、grouped boxplot、correlation heatmap、missing values。
- 后端保留 `cleaned_dataset_id` 机制，并尽量自动适配你现有的上传数据缓存/注册表；如果你当前项目的上传模块变量名非常特殊，只需要在 `cleaning_service.py` 的 `_candidate_registry_modules()` 或函数/字典候选名里加一个名字。
- 前端会优先读取 `localStorage.cleaned_dataset_id`，因此清洗完成后 EDA 默认分析清洗后的数据。
