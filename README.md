# mini ML Lab
# ML Experiment Lab

ML Experiment Lab 是一个基于 React + FastAPI 的机器学习实验平台，支持从数据上传、数据清洗、EDA 可视化、模型训练到动态参数敏感性分析、Bradley-Terry 综合测评和 AI 实验报告生成的完整流程。

## Features

- CSV / Excel 数据上传与字段摘要
- 数据清洗：字段选择、类型转换、缺失值处理、异常值处理、重复值删除
- EDA 可视化：直方图、箱线图、频数图、散点图、分组箱线图、相关性热力图、缺失值图
- 分类与回归模型训练
- 动态参数敏感性分析：n_estimators、max_depth、min_samples_split、n_neighbors、C
- Bradley-Terry 模型综合测评
- DeepSeek API 驱动的 AI 实验报告生成

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: FastAPI, pandas, scikit-learn
- Visualization: matplotlib / seaborn backend-generated charts
- LLM: DeepSeek API