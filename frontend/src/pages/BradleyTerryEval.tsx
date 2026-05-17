import { useEffect, useMemo, useState } from "react";
import { runBradleyTerry } from "../api/backend";
import type {
  BradleyTerryRunResponse,
  DatasetSummary,
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

const classificationMetrics = [
  { value: "f1_macro", label: "F1 Macro" },
  { value: "accuracy", label: "Accuracy" },
  { value: "roc_auc", label: "ROC-AUC" },
];

const regressionMetrics = [
  { value: "r2", label: "R²" },
  { value: "rmse", label: "RMSE" },
  { value: "mae", label: "MAE" },
];

const dynamicVariableOptions = [
  {
    value: "label_noise_rate",
    label: "标签噪声率 label_noise_rate",
    task: "classification",
    defaultStart: 0,
    defaultEnd: 0.4,
  },
  {
    value: "feature_noise_std",
    label: "特征噪声强度 feature_noise_std",
    task: "both",
    defaultStart: 0,
    defaultEnd: 1,
  },
  {
    value: "missing_rate",
    label: "随机缺失率 missing_rate",
    task: "both",
    defaultStart: 0,
    defaultEnd: 0.4,
  },
  {
    value: "max_depth",
    label: "树最大深度 max_depth",
    task: "both",
    defaultStart: 1,
    defaultEnd: 20,
  },
  {
    value: "n_estimators",
    label: "随机森林树数量 n_estimators",
    task: "both",
    defaultStart: 10,
    defaultEnd: 200,
  },
  {
    value: "n_neighbors",
    label: "KNN 邻居数 n_neighbors",
    task: "both",
    defaultStart: 1,
    defaultEnd: 25,
  },
  {
    value: "C",
    label: "逻辑回归 C",
    task: "classification",
    defaultStart: 0.01,
    defaultEnd: 5,
  },
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(4);
}

function BradleyTerryEval() {
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(
    null
  );
  const [datasetId, setDatasetId] = useState("");
  const [targetColumn, setTargetColumn] = useState("");

  const [taskType, setTaskType] = useState<TaskType>("classification");
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "logistic_regression",
    "random_forest",
    "decision_tree",
  ]);
  const [metric, setMetric] = useState("f1_macro");

  const [dynamicVariable, setDynamicVariable] = useState("label_noise_rate");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0.4);
  const [steps, setSteps] = useState(8);
  const [testSize, setTestSize] = useState(0.2);
  const [randomState, setRandomState] = useState(42);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BradleyTerryRunResponse | null>(null);
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

  const metricOptions = useMemo(() => {
    return taskType === "classification" ? classificationMetrics : regressionMetrics;
  }, [taskType]);

  const availableDynamicVariables = useMemo(() => {
    return dynamicVariableOptions.filter((item) => {
      return item.task === "both" || item.task === taskType;
    });
  }, [taskType]);

  const handleTaskTypeChange = (nextTaskType: TaskType) => {
    setTaskType(nextTaskType);
    setResult(null);
    setErrorMessage("");

    if (nextTaskType === "classification") {
      setSelectedModels(["logistic_regression", "random_forest", "decision_tree"]);
      setMetric("f1_macro");
      setDynamicVariable("label_noise_rate");
      setStart(0);
      setEnd(0.4);
    } else {
      setSelectedModels([
        "linear_regression",
        "random_forest_regressor",
        "decision_tree_regressor",
      ]);
      setMetric("r2");
      setDynamicVariable("feature_noise_std");
      setStart(0);
      setEnd(1);
    }
  };

  const toggleModel = (modelName: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelName)) {
        return prev.filter((item) => item !== modelName);
      }

      return [...prev, modelName];
    });
  };

  const handleDynamicVariableChange = (value: string) => {
    setDynamicVariable(value);
    setResult(null);

    const option = dynamicVariableOptions.find((item) => item.value === value);
    if (option) {
      setStart(option.defaultStart);
      setEnd(option.defaultEnd);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const data = await runBradleyTerry({
        dataset_id: datasetId,
        target_column: targetColumn,
        task_type: taskType,
        model_names: selectedModels,
        metric,
        dynamic_variable: dynamicVariable,
        start,
        end,
        steps,
        test_size: testSize,
        random_state: randomState,
      });

      setResult(data);
      localStorage.setItem("last_bradley_terry_result", JSON.stringify(data));
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Bradley-Terry 测评失败，请检查数据、模型或后端日志。";

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h1>Bradley-Terry 模型综合测评</h1>

      <p className="page-description">
        将多个模型在多个噪声或参数条件下的表现转化为成对胜负关系，
        再用 Bradley-Terry 模型估计综合强度分数。它不是预测模型，而是模型测评模型。
      </p>

      {!datasetId && (
        <div className="error-box">
          还没有检测到数据集。请先进入“数据上传”页面上传数据。
        </div>
      )}

      {datasetId && (
        <>
          <div className="form-card">
            <h2>BT 测评配置</h2>

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
                  分类
                </label>
                <label>
                  <input
                    type="radio"
                    checked={taskType === "regression"}
                    onChange={() => handleTaskTypeChange("regression")}
                  />
                  回归
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>参与测评的模型</label>
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
                <label>排序指标</label>
                <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                  {metricOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>动态变量</label>
                <select
                  value={dynamicVariable}
                  onChange={(e) => handleDynamicVariableChange(e.target.value)}
                >
                  {availableDynamicVariables.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>start</label>
                <input
                  type="number"
                  step="0.01"
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>end</label>
                <input
                  type="number"
                  step="0.01"
                  value={end}
                  onChange={(e) => setEnd(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>steps：{steps}</label>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                />
              </div>

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
            </div>

            <div className="form-group">
              <label>random_state</label>
              <input
                type="number"
                value={randomState}
                onChange={(e) => setRandomState(Number(e.target.value))}
              />
            </div>

            <div className="button-row">
              <button onClick={handleRun} disabled={loading}>
                {loading ? "BT 测评运行中..." : "运行 Bradley-Terry 测评"}
              </button>
            </div>

            {errorMessage && (
              <div className="error-box">
                <strong>测评失败：</strong>
                <pre>{errorMessage}</pre>
              </div>
            )}
          </div>

          {result && (
            <>
              <div className="card">
                <h2>模型综合排名</h2>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>模型</th>
                        <th>BT Score</th>
                        <th>Strength</th>
                        <th>胜场</th>
                        <th>负场</th>
                        <th>胜率</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.ranking.map((item) => (
                        <tr key={item.model_name}>
                          <td>{item.rank}</td>
                          <td>{item.model_name}</td>
                          <td>{formatNumber(item.bt_score)}</td>
                          <td>{formatNumber(item.strength)}</td>
                          <td>{item.wins}</td>
                          <td>{item.losses}</td>
                          <td>{formatNumber(item.win_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h2>胜负矩阵</h2>
                <p>
                  行模型胜过列模型的次数。该矩阵来自不同动态条件下的 pairwise
                  comparison。
                </p>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>模型</th>
                        {result.model_names.map((model) => (
                          <th key={model}>{model}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {result.model_names.map((rowModel) => (
                        <tr key={rowModel}>
                          <td>{rowModel}</td>
                          {result.model_names.map((colModel) => (
                            <td key={colModel}>
                              {rowModel === colModel
                                ? "-"
                                : result.win_matrix[rowModel]?.[colModel] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h2>实验明细</h2>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>条件编号</th>
                        <th>{result.dynamic_variable}</th>
                        <th>模型</th>
                        <th>指标</th>
                        <th>指标值</th>
                        <th>状态</th>
                        <th>错误</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.experiment_rows.map((row, index) => (
                        <tr key={index}>
                          <td>{row.condition_index}</td>
                          <td>{row.dynamic_value}</td>
                          <td>{row.model_name}</td>
                          <td>{row.metric}</td>
                          <td>{formatNumber(row.metric_value)}</td>
                          <td>{row.status}</td>
                          <td>{row.error || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h2>如何解释</h2>
                <p>
                  BT Score 越高，说明该模型在成对比较中越常胜出。Strength 是归一化后的强度比例。
                  它比简单平均指标更关注“模型 A 是否稳定地胜过模型 B”。
                </p>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default BradleyTerryEval;