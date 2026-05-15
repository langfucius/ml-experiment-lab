import { useEffect, useMemo, useState } from "react";
import { runExperiment } from "../api/backend";
import type {
  DatasetSummary,
  ExperimentMetricResult,
  TaskType,
} from "../api/backend";

const classificationModels = [
  { value: "logistic_regression", label: "Logistic Regression" },
  { value: "random_forest", label: "Random Forest" },
  { value: "decision_tree", label: "Decision Tree" },
  { value: "knn", label: "KNN" },
];

const regressionModels = [
  { value: "linear_regression", label: "Linear Regression" },
  { value: "random_forest_regressor", label: "Random Forest Regressor" },
  { value: "decision_tree_regressor", label: "Decision Tree Regressor" },
  { value: "knn_regressor", label: "KNN Regressor" },
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value.toFixed(4);
}

function ExperimentLab() {
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(
    null
  );
  const [datasetId, setDatasetId] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("classification");
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "random_forest",
  ]);
  const [testSize, setTestSize] = useState(0.2);
  const [randomState, setRandomState] = useState(42);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ExperimentMetricResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const rawSummary = localStorage.getItem("current_dataset_summary");
    const rawDatasetId = localStorage.getItem("current_dataset_id");

    if (rawSummary) {
      try {
        const parsed = JSON.parse(rawSummary) as DatasetSummary;
        setDatasetSummary(parsed);
        setDatasetId(parsed.dataset_id);

        if (parsed.columns.length > 0) {
          setTargetColumn(parsed.columns[parsed.columns.length - 1]);
        }
      } catch (error) {
        console.error(error);
      }
    } else if (rawDatasetId) {
      setDatasetId(rawDatasetId);
    }
  }, []);

  const modelOptions = useMemo(() => {
    return taskType === "classification" ? classificationModels : regressionModels;
  }, [taskType]);

  const handleTaskTypeChange = (nextTaskType: TaskType) => {
    setTaskType(nextTaskType);

    if (nextTaskType === "classification") {
      setSelectedModels(["random_forest"]);
    } else {
      setSelectedModels(["random_forest_regressor"]);
    }

    setResults([]);
    setErrorMessage("");
  };

  const toggleModel = (modelName: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelName)) {
        return prev.filter((item) => item !== modelName);
      }

      return [...prev, modelName];
    });
  };

  const handleRunExperiment = async () => {
    setLoading(true);
    setResults([]);
    setErrorMessage("");

    try {
      const data = await runExperiment({
        dataset_id: datasetId,
        target_column: targetColumn,
        task_type: taskType,
        model_names: selectedModels,
        test_size: testSize,
        random_state: randomState,
      });

      setResults(data.results);
      localStorage.setItem("last_experiment_results", JSON.stringify(data));
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "实验运行失败，请检查数据集、目标变量或后端日志。";

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h1>实验中心</h1>

      <p className="page-description">
        基于已上传的数据集，选择目标变量、任务类型和模型集合，运行基础机器学习实验。
        当前版本先完成分类和回归的最小闭环，后续会加入动态参数扫描与噪声扰动。
      </p>

      {!datasetSummary && !datasetId && (
        <div className="error-box">
          还没有检测到已上传的数据集。请先进入“数据上传”页面上传 CSV 或 Excel 文件。
        </div>
      )}

      {(datasetSummary || datasetId) && (
        <>
          <div className="form-card">
            <h2>实验配置</h2>

            <div className="info-box">
              <strong>当前 dataset_id：</strong>
              <code>{datasetId}</code>
              {datasetSummary && (
                <>
                  <br />
                  行数：{datasetSummary.rows}；列数：{datasetSummary.columns_count}
                </>
              )}
            </div>

            <div className="form-group">
              <label>目标变量</label>
              {datasetSummary ? (
                <select
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                >
                  {datasetSummary.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  placeholder="请输入目标变量名"
                />
              )}
            </div>

            <div className="form-group">
              <label>任务类型</label>
              <div className="radio-row">
                <label>
                  <input
                    type="radio"
                    checked={taskType === "classification"}
                    onChange={() => handleTaskTypeChange("classification")}
                  />
                  分类 Classification
                </label>

                <label>
                  <input
                    type="radio"
                    checked={taskType === "regression"}
                    onChange={() => handleTaskTypeChange("regression")}
                  />
                  回归 Regression
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>选择模型</label>

              <div className="checkbox-grid">
                {modelOptions.map((model) => (
                  <label key={model.value} className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.value)}
                      onChange={() => toggleModel(model.value)}
                    />
                    {model.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>测试集比例：{testSize}</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={testSize}
                  onChange={(e) => setTestSize(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>random_state</label>
                <input
                  type="number"
                  value={randomState}
                  onChange={(e) => setRandomState(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="button-row">
              <button onClick={handleRunExperiment} disabled={loading}>
                {loading ? "实验运行中..." : "运行实验"}
              </button>
            </div>

            {errorMessage && (
              <div className="error-box">
                <strong>实验失败：</strong>
                <pre>{errorMessage}</pre>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="card">
              <h2>实验结果</h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>模型</th>
                      <th>状态</th>
                      <th>训练行数</th>
                      <th>测试行数</th>
                      {taskType === "classification" ? (
                        <>
                          <th>Accuracy</th>
                          <th>F1 Macro</th>
                          <th>ROC-AUC</th>
                        </>
                      ) : (
                        <>
                          <th>MAE</th>
                          <th>RMSE</th>
                          <th>R²</th>
                        </>
                      )}
                      <th>错误信息</th>
                    </tr>
                  </thead>

                  <tbody>
                    {results.map((item) => (
                      <tr key={item.model_name}>
                        <td>{item.model_name}</td>
                        <td>{item.status}</td>
                        <td>{item.train_rows}</td>
                        <td>{item.test_rows}</td>

                        {taskType === "classification" ? (
                          <>
                            <td>{formatNumber(item.accuracy)}</td>
                            <td>{formatNumber(item.f1_macro)}</td>
                            <td>{formatNumber(item.roc_auc)}</td>
                          </>
                        ) : (
                          <>
                            <td>{formatNumber(item.mae)}</td>
                            <td>{formatNumber(item.rmse)}</td>
                            <td>{formatNumber(item.r2)}</td>
                          </>
                        )}

                        <td>{item.error || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="card">
              <h2>下一步</h2>
              <p>
                当前实验结果已经保存到浏览器 localStorage。后续的噪声鲁棒性实验和
                Bradley-Terry 测评模块会基于这些模型结果继续扩展。
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ExperimentLab;