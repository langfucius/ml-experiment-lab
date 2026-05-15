import { useState } from "react";
import { testDeepSeekConnection } from "../api/backend";

function ApiSettings() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [modelName, setModelName] = useState("deepseek-v4-flash");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(128);

  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult("");
    setErrorMessage("");

    try {
      const data = await testDeepSeekConnection({
        api_key: apiKey,
        base_url: baseUrl,
        model_name: modelName,
        temperature,
        max_tokens: maxTokens,
      });

      setTestResult(
        `连接测试成功。模型：${data.model_name}；返回：${data.message}`
      );
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "未知错误，请检查后端或 API Key。";

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLocal = () => {
    const config = {
      base_url: baseUrl,
      model_name: modelName,
      temperature,
      max_tokens: maxTokens,
      has_api_key: apiKey.trim().length > 0,
    };

    localStorage.setItem("llm_config_safe", JSON.stringify(config));

    setTestResult("配置已保存到浏览器本地。注意：API Key 不会保存。");
    setErrorMessage("");
  };

  return (
    <section>
      <h1>API 设置</h1>

      <p className="page-description">
        在这里配置 DeepSeek API。API Key 只会发送给本地 FastAPI 后端用于本次测试，
        不会写入代码，也不会保存到 GitHub。
      </p>

      <div className="form-card">
        <h2>DeepSeek 配置</h2>

        <div className="form-group">
          <label>DeepSeek API Key</label>
          <input
            type="password"
            placeholder="请输入你的 DeepSeek API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <small>建议只在本地测试时输入，不要写入任何代码文件。</small>
        </div>

        <div className="form-group">
          <label>Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>模型名称</label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
          <small>
            这里保持可编辑，方便以后切换不同 DeepSeek 模型或兼容 OpenAI 风格接口。
          </small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>temperature：{temperature}</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>max_tokens：{maxTokens}</label>
            <input
              type="range"
              min="128"
              max="8192"
              step="128"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="button-row">
          <button onClick={handleTestConnection} disabled={loading}>
            {loading ? "正在测试..." : "测试连接"}
          </button>

          <button className="secondary-button" onClick={handleSaveLocal}>
            保存非敏感配置
          </button>
        </div>

        {testResult && (
          <div className="success-box">
            {testResult}
          </div>
        )}

        {errorMessage && (
          <div className="error-box">
            <strong>连接失败：</strong>
            <pre>{errorMessage}</pre>
          </div>
        )}
      </div>

      <div className="card">
        <h2>后续用途</h2>
        <p>
          这个 API 设置后续会用于自动解释模型评估结果、总结参数敏感性实验、
          分析噪声鲁棒性，以及生成完整的机器学习实验报告。
        </p>
      </div>
    </section>
  );
}

export default ApiSettings;