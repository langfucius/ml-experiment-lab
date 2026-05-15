import { useState } from "react";
import { checkBackendHealth } from "../api/backend";

function Dashboard() {
  const [status, setStatus] = useState("尚未连接后端");

  const handleCheckBackend = async () => {
    try {
      const data = await checkBackendHealth();
      setStatus(`后端状态：${data.status}，服务：${data.service}`);
    } catch (error) {
      console.error(error);
      setStatus("后端连接失败，请检查 FastAPI 是否正在运行。");
    }
  };

  return (
    <section>
      <h1>机器学习实验与鲁棒性评估平台</h1>
      <p className="page-description">
        面向数据分析与机器学习学习场景，支持 API 接入、动态参数实验、噪声扰动分析、
        多模型比较、Bradley-Terry 综合测评与 AI 实验报告生成。
      </p>

      <div className="card-grid">
        <div className="card">
          <h2>API 设置</h2>
          <p>配置 DeepSeek API，用于后续模型解释和报告生成。</p>
        </div>

        <div className="card">
          <h2>动态参数实验</h2>
          <p>观察模型参数变化对 Accuracy、F1、AUC、RMSE 等指标的影响。</p>
        </div>

        <div className="card">
          <h2>噪声鲁棒性分析</h2>
          <p>模拟标签噪声、特征噪声、缺失噪声和异常值扰动。</p>
        </div>

        <div className="card">
          <h2>Bradley-Terry 测评</h2>
          <p>将多模型实验结果转化为成对胜负关系，生成综合模型排名。</p>
        </div>
      </div>

      <button onClick={handleCheckBackend}>测试后端连接</button>

      <div className="status-card">{status}</div>
    </section>
  );
}

export default Dashboard;