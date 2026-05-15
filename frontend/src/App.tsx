import { useState } from "react";
import axios from "axios";
import "./App.css";

type HealthResponse = {
  status: string;
  service: string;
};

function App() {
  const [backendStatus, setBackendStatus] = useState<string>("尚未连接后端");

  const checkBackend = async () => {
    try {
      const response = await axios.get<HealthResponse>(
        "http://127.0.0.1:8000/api/health"
      );

      setBackendStatus(
        `后端状态：${response.data.status}，服务：${response.data.service}`
      );
    } catch (error) {
      console.error(error);
      setBackendStatus("后端连接失败，请检查 FastAPI 是否正在运行。");
    }
  };

  return (
    <div className="app-container">
      <h1>ML Experiment Lab</h1>
      <p>机器学习实验与鲁棒性评估网页平台</p>

      <button onClick={checkBackend}>测试后端连接</button>

      <div className="status-card">
        {backendStatus}
      </div>
    </div>
  );
}

export default App;