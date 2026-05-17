import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { runDynamicExperiment } from "../api/backend";
import type {
  DatasetSummary,
  DynamicExperimentPoint,
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

const dynamicVariableOptions = [
  {
    value: "n_estimators",
    label: "随机森林树数量 n_estimators",
    models: ["random_forest", "random_forest_regressor"],
    defaultStart: 10,
    defaultEnd: 200,
  },
  {
    value: "max_depth",
    label: "树最大深度 max_depth",
    models: [
      "random_forest",
      "random_forest_regressor",
      "decision_tree",
      "decision_tree_regressor",
    ],
    defaultStart: 1,
    defaultEnd: 20,
  },
  {
    value: "min_samples_split",
    label: "最小分裂样本数 min_samples_split",
    models: [
      "random_forest",
      "random_forest_regressor",
      "decision_tree",
      "decision_tree_regressor",
    ],
    defaultStart: 2,
    defaultEnd: 20,
  },
  {
    value: "n_neighbors",
    label: "KNN 邻居数 n_neighbors",
    models: ["knn", "knn_regressor"],
    defaultStart: 1,
    defaultEnd: 25,
  },
  {
    value: "C",
    label: "逻辑回归正则参数 C",
    models: ["logistic_regression"],
    defaultStart: 0.01,
    defaultEnd: 5,
  },
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toFixed(4);
}

function getPrimaryMetric(taskType: TaskType) {
  return taskType === "classification" ? "f1_macro" : "r2";
}

function getDefaultModel(taskType: TaskType) {
  return taskType === "classification" ? "random_forest" : "random_forest_regressor";
}

function getAvailableDynamicVariables(modelName: string) {
  return dynamicVariableOptions.filter((item) => item.models.includes(modelName));
}

function getDefaultDynamicVariable(modelName: string) {
  const available = getAvailableDynamicVariables(modelName);
  return available[0] || dynamicVariableOptions[0];
}

function NoiseAnalysis() {
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(
    null
  );
  const [datasetId, setDatasetId] = useState("");
  const [targetColumn, setTargetColumn] = useState("");

  const [taskType, setTaskType] = useState<TaskType>("classification");
  const [modelName, setModelName] = useState("random_forest");
  const [dynamicVariable, setDynamicVariable] = useState("n_estimators");
  const [start, setStart] = useState(10);
  const [end, setEnd] = useState(200);
  const [steps, setSteps] = useState(8);
  const [testSize, setTestSize] = useState(0.2);
  const [randomState, setRandomState] = useState(42);

  const [curve, setCurve] = useState<DynamicExperimentPoint[]>([]);
  const [loading, setLoading] = useState(false);
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

  const availableDynamicVariables = useMemo(() => {
    return getAvailableDynamicVariables(modelName);
  }, [modelName]);

  const primaryMetric = getPrimaryMetric(taskType);

  const chartData = curve.map((point) => ({
    x: point.x,
    accuracy: point.accuracy ?? null,
    f1_macro: point.f1_macro ?? null,
    roc_auc: point.roc_auc ?? null,
    mae: point.mae ?? null,
    rmse: point.rmse ?? null,
    r2: point.r2 ?? null,
    status: point.status,
  }));

  const handleTaskTypeChange = (nextTaskType: TaskType) => {
    const nextModel = getDefaultModel(nextTaskType);
    const nextVariable = getDefaultDynamicVariable(nextModel);

    setTaskType(nextTaskType);
    setModelName(nextModel);
    setDynamicVariable(nextVariable.value);
    setStart(nextVariable.defaultStart);
    setEnd(nextVariable.defaultEnd);

    setCurve([]);
    setErrorMessage("");
  };

  const handleModelChange = (nextModel: string) => {
    const nextVariable = getDefaultDynamicVariable(nextModel);

    setModelName(nextModel);
    setDynamicVariable(nextVariable.value);
    setStart(nextVariable.defaultStart);
    setEnd(nextVariable.defaultEnd);

    setCurve([]);
    setErrorMessage("");
  };

  const handleDynamicVariableChange = (value: string) => {
    const option = dynamicVariableOptions.find((item) => item.value === value);

    setDynamicVariable(value);
    setCurve([]);
    setErrorMessage("");

    if (option) {
      setStart(option.defaultStart);
      setEnd(option.defaultEnd);
    }
  };

  const handleRunDynamic = async () => {
    if (!datasetId) {
      setErrorMessage("没有检测到 dataset_id，请先上传数据。");
      return;
    }

    if (!targetColumn) {
      setErrorMessage("请选择目标变量。");
      return;
    }

    setLoading(true);
    setCurve([]);
    setErrorMessage("");

    try {
      const result = await runDynamicExperiment({
        dataset_id: datasetId,
        target_column: targetColumn,
        task_type: taskType,
        model_name: modelName,
        dynamic_variable: dynamicVariable,
        start,
        end,
        steps,
        test_size: testSize,
        random_state: randomState,
      });

      setCurve(result.curve);
      localStorage.setItem("last_dynamic_experiment", JSON.stringify(result));
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "参数扫描失败，请检查数据、目标变量、模型或后端日志。";

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h1>动态参数敏感性分析</h1>

      <p className="page-description">
        这里不是单次训练，而是动态改变一个模型参数，多次训练同一模型，
        观察 Accuracy、F1、R²、RMSE 等指标如何随参数变化而变化。
        你可以用它分析不同模型参数对性能的影响。
      </p>

      {!datasetSummary && !datasetId && (
        <div className="error-box">
          还没有检测到已上传的数据集。请先进入“数据上传”页面上传 CSV 或 Excel 文件。
        </div>
      )}

      {(datasetSummary || datasetId) && (
        <>
          <div className="form-card">
            <h2>参数扫描配置</h2>

            <div className="info-box">
              <strong>当前 dataset_id：</strong>
              <code>{datasetId}</code>
              {datasetSummary && (
                <>
                  <br />
                  行数：{datasetSummary.rows}；列数：
                  {datasetSummary.columns_count}
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

            <div className="form-row">
              <div className="form-group">
                <label>模型</label>
                <select
                  value={modelName}
                  onChange={(e) => handleModelChange(e.target.value)}
                >
                  {modelOptions.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>扫描参数</label>
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
                <label>起点 start</label>
                <input
                  type="number"
                  step="0.01"
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>终点 end</label>
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
                <label>实验点数量 steps：{steps}</label>
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
              <button onClick={handleRunDynamic} disabled={loading}>
                {loading ? "参数扫描运行中..." : "运行参数扫描"}
              </button>
            </div>

            {errorMessage && (
              <div className="error-box">
                <strong>参数扫描失败：</strong>
                <pre>{errorMessage}</pre>
              </div>
            )}
          </div>

          {curve.length > 0 && (
            <>
              <div className="card">
                <h2>参数敏感性曲线</h2>
                <p>
                  当前主指标：
                  <strong>{primaryMetric}</strong>
                </p>

                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="x" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey={primaryMetric}
                        strokeWidth={2}
                        dot
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <h2>参数扫描明细</h2>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>{dynamicVariable}</th>
                        <th>状态</th>
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
                      {curve.map((item) => (
                        <tr key={item.x}>
                          <td>{item.x}</td>
                          <td>{item.status}</td>

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

              <div className="card">
                <h2>如何解读</h2>
                <p>
                  横轴表示当前被扫描的模型参数，纵轴表示模型评价指标。
                  如果曲线在某个区间明显上升，说明该参数范围更适合当前数据；
                  如果曲线波动很大，说明模型对该参数较敏感，需要交叉验证或更细粒度搜索。
                  如果曲线趋于平稳，说明继续增大该参数的收益有限。
                </p>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default NoiseAnalysis;