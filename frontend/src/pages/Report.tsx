import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateReport } from "../api/backend";

function readJsonFromLocalStorage(key: string) {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function Report() {
  const storedSafeConfig = useMemo(() => {
    const raw = localStorage.getItem("llm_config_safe");
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(
    storedSafeConfig?.base_url || "https://api.deepseek.com"
  );
  const [modelName, setModelName] = useState(
    storedSafeConfig?.model_name || "deepseek-v4-flash"
  );
  const [temperature, setTemperature] = useState(
    Number(storedSafeConfig?.temperature ?? 0.4)
  );
  const [maxTokens, setMaxTokens] = useState(
    Number(storedSafeConfig?.max_tokens ?? 4096)
  );

  const [reportLanguage, setReportLanguage] = useState("中文");
  const [reportStyle, setReportStyle] = useState("学术但易读");

  const [loading, setLoading] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState(
    localStorage.getItem("last_ai_report") || ""
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");

  const datasetSummary = readJsonFromLocalStorage("current_dataset_summary");
  const cleaningResult = readJsonFromLocalStorage("last_cleaning_result");
  const experimentResult = readJsonFromLocalStorage("last_experiment_results");
  const dynamicResult = readJsonFromLocalStorage("last_dynamic_experiment");
  const bradleyTerryResult = readJsonFromLocalStorage(
    "last_bradley_terry_result"
  );

  const availableSections = [
    {
      name: "数据集摘要",
      available: Boolean(datasetSummary),
      description: "包含字段、行列数、缺失值和数据预览。",
    },
    {
      name: "数据清洗结果",
      available: Boolean(cleaningResult),
      description: "包含清洗前后对比、缺失值处理和类型变化。",
    },
    {
      name: "基础实验结果",
      available: Boolean(experimentResult),
      description: "包含模型指标、训练/测试划分和性能对比。",
    },
    {
      name: "动态实验结果",
      available: Boolean(dynamicResult),
      description: "包含噪声或参数变化下的模型表现。",
    },
    {
      name: "Bradley-Terry 测评结果",
      available: Boolean(bradleyTerryResult),
      description: "包含模型胜负矩阵、BT 强度分数和综合排名。",
    },
  ];

  const handleGenerateReport = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await generateReport({
        api_key: apiKey,
        base_url: baseUrl,
        model_name: modelName,
        temperature,
        max_tokens: maxTokens,
        dataset_summary: datasetSummary,
        cleaning_result: cleaningResult,
        experiment_result: experimentResult,
        dynamic_result: dynamicResult,
        bradley_terry_result: bradleyTerryResult,
        report_language: reportLanguage,
        report_style: reportStyle,
      });

      setReportMarkdown(result.report_markdown);
      localStorage.setItem("last_ai_report", result.report_markdown);
      setViewMode("preview");
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "报告生成失败，请检查 API Key 或后端日志。";

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = async () => {
    if (!reportMarkdown) return;

    await navigator.clipboard.writeText(reportMarkdown);
    alert("报告已复制到剪贴板。");
  };

  return (
    <section className="report-page">
      <div className="page-header">
        <div>
          <h1>AI 实验报告生成</h1>
          <p className="page-description">
            自动整合数据上传、数据清洗、基础建模、动态噪声分析和
            Bradley-Terry 测评结果，使用 DeepSeek 生成结构化实验报告。
          </p>
        </div>
      </div>

      <div className="section-status-grid">
        {availableSections.map((section) => (
          <div
            className={
              section.available
                ? "section-status-card section-status-ok"
                : "section-status-card section-status-missing"
            }
            key={section.name}
          >
            <div className="section-status-title">{section.name}</div>
            <div className="section-status-badge">
              {section.available ? "已检测到" : "暂未检测到"}
            </div>
            <p>{section.description}</p>
          </div>
        ))}
      </div>

      <div className="form-card report-config-card">
        <h2>报告生成配置</h2>

        <div className="form-group">
          <label>DeepSeek API Key</label>
          <input
            type="password"
            placeholder="请输入 DeepSeek API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <small>
            API Key 只会发送到本地 FastAPI 后端用于本次生成，不会写入代码。
          </small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>模型名称</label>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </div>
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
              min="512"
              max="8192"
              step="512"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>报告语言</label>
            <select
              value={reportLanguage}
              onChange={(e) => setReportLanguage(e.target.value)}
            >
              <option value="中文">中文</option>
              <option value="English">English</option>
              <option value="中英双语">中英双语</option>
            </select>
          </div>

          <div className="form-group">
            <label>报告风格</label>
            <select
              value={reportStyle}
              onChange={(e) => setReportStyle(e.target.value)}
            >
              <option value="学术但易读">学术但易读</option>
              <option value="简历项目描述风格">简历项目描述风格</option>
              <option value="课程作业报告风格">课程作业报告风格</option>
              <option value="企业数据分析报告风格">企业数据分析报告风格</option>
            </select>
          </div>
        </div>

        <div className="button-row">
          <button onClick={handleGenerateReport} disabled={loading}>
            {loading ? "正在生成报告..." : "生成 AI 实验报告"}
          </button>

          {reportMarkdown && (
            <>
              <button className="secondary-button" onClick={handleCopyReport}>
                复制 Markdown
              </button>

              <button
                className="secondary-button"
                onClick={() =>
                  setViewMode(viewMode === "preview" ? "raw" : "preview")
                }
              >
                {viewMode === "preview" ? "查看源码" : "查看预览"}
              </button>
            </>
          )}
        </div>

        {errorMessage && (
          <div className="error-box">
            <strong>报告生成失败：</strong>
            <pre>{errorMessage}</pre>
          </div>
        )}
      </div>

      {reportMarkdown && (
        <div className="report-output-card">
          <div className="report-output-header">
            <div>
              <h2>生成结果</h2>
              <p>当前显示模式：{viewMode === "preview" ? "排版预览" : "Markdown 源码"}</p>
            </div>
          </div>

          {viewMode === "preview" ? (
            <article className="markdown-report">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reportMarkdown}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="report-preview">
              <pre>{reportMarkdown}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default Report;