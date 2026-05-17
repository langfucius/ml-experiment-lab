import { useEffect, useMemo, useState } from "react";
import {
  generateEDAPlot,
  getEDAProfile,
  getLocalDatasetProfile,
  resolveDatasetId,
} from "../api/backend";
import type { DatasetProfile, EDAPlotResponse } from "../api/backend";

const chartTypes = [
  { value: "histogram", label: "直方图 Histogram", need: "single" },
  { value: "boxplot", label: "箱线图 Boxplot", need: "single" },
  { value: "bar", label: "类别频数图 Bar Chart", need: "single" },
  { value: "scatter", label: "散点图 Scatter", need: "xy" },
  { value: "line", label: "折线图 Line Chart", need: "xy" },
  { value: "grouped_boxplot", label: "分组箱线图 Grouped Boxplot", need: "xy" },
  {
    value: "correlation_heatmap",
    label: "相关性热力图 Correlation Heatmap",
    need: "multi",
  },
  { value: "missing_values", label: "缺失值图 Missing Values", need: "none" },
];

function getDtype(profile: DatasetProfile | null, col: string) {
  if (!profile) return "-";

  if (profile.dtypes?.[col]) {
    return profile.dtypes[col];
  }

  const found = profile.dtype_summary?.find((item) => item["列名"] === col);
  return found?.["数据类型"] || "-";
}

function getMissingCount(profile: DatasetProfile | null, col: string) {
  if (!profile) return 0;

  if (profile.missing_counts?.[col] !== undefined) {
    return profile.missing_counts[col];
  }

  const found = profile.missing_value_summary?.find(
    (item) => item["列名"] === col
  );

  return Number(found?.["缺失值数量"] || 0);
}

function EDA() {
  const [datasetId, setDatasetId] = useState("");
  const [profile, setProfile] = useState<DatasetProfile | null>(null);

  const [chartType, setChartType] = useState("histogram");
  const [column, setColumn] = useState("");
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [hueCol, setHueCol] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [topN, setTopN] = useState(10);

  const [plot, setPlot] = useState<EDAPlotResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPlot, setLoadingPlot] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const id = resolveDatasetId();
    const localProfile = getLocalDatasetProfile();

    setDatasetId(id);

    if (localProfile) {
      setProfile(localProfile);

      const firstCol = localProfile.columns?.[0] || "";
      const firstNumeric =
        localProfile.numeric_columns?.[0] || localProfile.columns?.[0] || "";
      const secondNumeric =
        localProfile.numeric_columns?.[1] ||
        localProfile.numeric_columns?.[0] ||
        localProfile.columns?.[1] ||
        localProfile.columns?.[0] ||
        "";

      setColumn(firstNumeric || firstCol);
      setXCol(firstNumeric || firstCol);
      setYCol(secondNumeric || firstCol);
      setSelectedColumns(localProfile.numeric_columns?.slice(0, 6) || []);
    }
  }, []);

  const currentChart = useMemo(() => {
    return chartTypes.find((item) => item.value === chartType) || chartTypes[0];
  }, [chartType]);

  const allColumns = profile?.columns || [];
  const numericColumns = profile?.numeric_columns || [];
  const categoricalColumns = profile?.categorical_columns || [];

  const selectableColumnsForSingle = useMemo(() => {
    if (chartType === "histogram" || chartType === "boxplot") {
      return numericColumns.length > 0 ? numericColumns : allColumns;
    }

    if (chartType === "bar") {
      return allColumns;
    }

    return allColumns;
  }, [chartType, numericColumns, allColumns]);

  const handleLoadProfile = async () => {
    if (!datasetId) {
      setErrorMessage("没有检测到 dataset_id，请先上传数据。");
      return;
    }

    setLoadingProfile(true);
    setErrorMessage("");

    try {
      const data = await getEDAProfile(datasetId);
      setProfile(data);

      const firstCol = data.columns?.[0] || "";
      const firstNumeric = data.numeric_columns?.[0] || firstCol;
      const secondNumeric = data.numeric_columns?.[1] || firstNumeric;

      setColumn(firstNumeric);
      setXCol(firstNumeric);
      setYCol(secondNumeric);
      setSelectedColumns(data.numeric_columns?.slice(0, 6) || []);
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "加载 EDA Profile 失败。";

      setErrorMessage(detail);
    } finally {
      setLoadingProfile(false);
    }
  };

  const toggleCorrelationColumn = (col: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(col)) {
        return prev.filter((item) => item !== col);
      }

      return [...prev, col];
    });
  };

  const handleGeneratePlot = async () => {
    if (!datasetId) {
      setErrorMessage("没有检测到 dataset_id，请先上传数据。");
      return;
    }

    setLoadingPlot(true);
    setErrorMessage("");
    setPlot(null);

    try {
      const result = await generateEDAPlot({
        dataset_id: datasetId,
        chart_type: chartType,
        column:
          currentChart.need === "single" && column
            ? column
            : undefined,
        x_col:
          currentChart.need === "xy" && xCol
            ? xCol
            : undefined,
        y_col:
          currentChart.need === "xy" && yCol
            ? yCol
            : undefined,
        hue_col: hueCol || undefined,
        columns:
          currentChart.need === "multi"
            ? selectedColumns
            : undefined,
        top_n: topN,
      });

      setPlot(result);
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "生成图表失败，请检查字段类型或后端日志。";

      setErrorMessage(detail);
    } finally {
      setLoadingPlot(false);
    }
  };

  return (
    <section>
      <h1>EDA 可视化分析</h1>

      <p className="page-description">
        这里对齐旧版 Streamlit 可视化能力，使用后端 matplotlib / seaborn 生成图表，
        前端展示 PNG 图片。当前支持直方图、箱线图、频数图、散点图、折线图、分组箱线图、
        相关性热力图和缺失值图。
      </p>

      {!datasetId && (
        <div className="error-box">
          还没有检测到数据集。请先进入“数据上传”页面上传 CSV 或 Excel。
        </div>
      )}

      {datasetId && (
        <>
          <div className="form-card">
            <h2>当前数据集</h2>

            <div className="info-box">
              <strong>dataset_id：</strong>
              <code>{datasetId}</code>
              {profile && (
                <>
                  <br />
                  行数：{profile.rows}；列数：{profile.columns_count}
                  <br />
                  数值字段：{numericColumns.length}；类别字段：
                  {categoricalColumns.length}
                </>
              )}
            </div>

            <div className="button-row">
              <button
                className="secondary-button"
                onClick={handleLoadProfile}
                disabled={loadingProfile}
              >
                {loadingProfile ? "正在加载..." : "重新加载 EDA Profile"}
              </button>
            </div>

            {errorMessage && (
              <div className="error-box">
                <strong>错误：</strong>
                <pre>{errorMessage}</pre>
              </div>
            )}
          </div>

          {profile && (
            <div className="card">
              <h2>字段信息</h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>类型</th>
                      <th>缺失值</th>
                    </tr>
                  </thead>

                  <tbody>
                    {allColumns.map((col) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td>{getDtype(profile, col)}</td>
                        <td>{getMissingCount(profile, col)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {profile && (
            <div className="form-card">
              <h2>图表配置</h2>

              <div className="form-group">
                <label>图表类型</label>
                <select
                  value={chartType}
                  onChange={(e) => {
                    setChartType(e.target.value);
                    setPlot(null);
                    setErrorMessage("");
                  }}
                >
                  {chartTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {currentChart.need === "single" && (
                <>
                  <div className="form-group">
                    <label>字段</label>
                    <select
                      value={column}
                      onChange={(e) => setColumn(e.target.value)}
                    >
                      {selectableColumnsForSingle.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  {chartType === "bar" && (
                    <div className="form-group">
                      <label>Top N：{topN}</label>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={topN}
                        onChange={(e) => setTopN(Number(e.target.value))}
                      />
                    </div>
                  )}
                </>
              )}

              {currentChart.need === "xy" && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>X 字段</label>
                      <select
                        value={xCol}
                        onChange={(e) => setXCol(e.target.value)}
                      >
                        {allColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Y 字段</label>
                      <select
                        value={yCol}
                        onChange={(e) => setYCol(e.target.value)}
                      >
                        {allColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {chartType === "scatter" && (
                    <div className="form-group">
                      <label>颜色分组字段 hue，可选</label>
                      <select
                        value={hueCol}
                        onChange={(e) => setHueCol(e.target.value)}
                      >
                        <option value="">不使用分组</option>
                        {allColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {chartType === "grouped_boxplot" && (
                    <div className="info-box">
                      分组箱线图建议：X 字段选择类别变量，Y 字段选择数值变量。
                    </div>
                  )}

                  {chartType === "line" && (
                    <div className="info-box">
                      折线图建议：X 字段选择时间或有序变量，Y 字段选择数值变量。
                    </div>
                  )}
                </>
              )}

              {currentChart.need === "multi" && (
                <>
                  <p>
                    请选择至少两个数值字段用于相关性热力图。默认优先显示数值字段。
                  </p>

                  <div className="checkbox-grid">
                    {(numericColumns.length > 0 ? numericColumns : allColumns).map(
                      (col) => (
                        <label key={col} className="checkbox-card">
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(col)}
                            onChange={() => toggleCorrelationColumn(col)}
                          />
                          {col}
                        </label>
                      )
                    )}
                  </div>
                </>
              )}

              {currentChart.need === "none" && (
                <div className="info-box">
                  缺失值图不需要选择字段，会自动统计所有列的缺失值数量。
                </div>
              )}

              <div className="button-row">
                <button onClick={handleGeneratePlot} disabled={loadingPlot}>
                  {loadingPlot ? "正在生成图表..." : "生成图表"}
                </button>
              </div>
            </div>
          )}

          {plot && (
            <div className="card">
              <h2>图表结果</h2>

              <div className="plot-image-wrapper">
                <img
                  className="plot-image"
                  src={`data:${plot.mime_type};base64,${plot.image_base64}`}
                  alt={plot.chart_type}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default EDA;