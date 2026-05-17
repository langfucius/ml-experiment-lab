function Dashboard() {
  return (
    <section>
      <h1>ML Experiment Lab</h1>

      <p className="page-description">
        一个面向机器学习实验流程的前后端分离平台，支持数据上传、数据清洗、
        EDA 可视化、基础模型训练、动态参数敏感性分析、Bradley-Terry 综合测评
        与 AI 实验报告生成。
      </p>

      <div className="card-grid">
        <div className="card">
          <h2>数据处理</h2>
          <p>支持 CSV / Excel 上传、字段类型识别、缺失值处理、异常值处理和清洗摘要。</p>
        </div>

        <div className="card">
          <h2>EDA 可视化</h2>
          <p>支持直方图、箱线图、频数图、散点图、分组箱线图、相关性热力图和缺失值图。</p>
        </div>

        <div className="card">
          <h2>模型实验</h2>
          <p>支持分类与回归模型训练，并返回 Accuracy、F1、ROC-AUC、MAE、RMSE、R² 等指标。</p>
        </div>

        <div className="card">
          <h2>参数敏感性</h2>
          <p>支持动态扫描 n_estimators、max_depth、n_neighbors、C 等模型参数。</p>
        </div>

        <div className="card">
          <h2>BT 综合测评</h2>
          <p>将不同模型在多个条件下的表现转化为成对胜负关系，估计综合强度排名。</p>
        </div>

        <div className="card">
          <h2>AI 报告</h2>
          <p>调用 DeepSeek 自动生成结构化 Markdown 实验报告。</p>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;