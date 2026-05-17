import { useEffect, useMemo, useState } from "react";
import {
  getCleaningProfile,
  getLocalDatasetProfile,
  resolveDatasetId,
  runCleaning,
} from "../api/backend";
import type { CleaningResponse, DatasetProfile } from "../api/backend";

const numericMissingMethods = [
  "不处理",
  "删除缺失行",
  "均值填充",
  "中位数填充",
  "0填充",
  "线性插值",
  "前向填充",
  "后向填充",
];

const categoricalMissingMethods = [
  "不处理",
  "删除缺失行",
  "众数填充",
  "Unknown填充",
];

const outlierMethods = ["不处理", "IQR剔除", "Z-score剔除"];

const typeOptions = ["不转换", "numeric", "category", "datetime", "string", "bool"];

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

function DataCleaning() {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [datasetId, setDatasetId] = useState("");

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [numericMissingMethod, setNumericMissingMethod] =
    useState("中位数填充");
  const [categoricalMissingMethod, setCategoricalMissingMethod] =
    useState("众数填充");
  const [outlierMethod, setOutlierMethod] = useState("不处理");
  const [typeConfig, setTypeConfig] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [result, setResult] = useState<CleaningResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const localProfile = getLocalDatasetProfile();
    const id = resolveDatasetId();

    setDatasetId(id);

    if (localProfile) {
      setProfile(localProfile);
      setSelectedColumns(localProfile.columns || []);

      const initTypes: Record<string, string> = {};
      (localProfile.columns || []).forEach((col) => {
        initTypes[col] = "不转换";
      });
      setTypeConfig(initTypes);
    }
  }, []);

  const allColumnsSelected = useMemo(() => {
    if (!profile) return false;
    return selectedColumns.length === profile.columns.length;
  }, [profile, selectedColumns]);

  const handleLoadProfile = async () => {
    if (!datasetId) {
      setErrorMessage("没有检测到 dataset_id，请先上传数据。");
      return;
    }

    setProfileLoading(true);
    setErrorMessage("");

    try {
      const data = await getCleaningProfile(datasetId);
      setProfile(data);
      setSelectedColumns(data.columns || []);

      const initTypes: Record<string, string> = {};
      (data.columns || []).forEach((col) => {
        initTypes[col] = "不转换";
      });
      setTypeConfig(initTypes);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(
        error?.response?.data?.detail ||
          error?.message ||
          "加载数据 profile 失败。"
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        return prev.filter((item) => item !== column);
      }

      return [...prev, column];
    });
  };

  const toggleAllColumns = () => {
    if (!profile) return;

    if (allColumnsSelected) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(profile.columns);
    }
  };

  const handleTypeChange = (column: string, value: string) => {
    setTypeConfig((prev) => ({
      ...prev,
      [column]: value,
    }));
  };

  const handleRunCleaning = async () => {
    if (!datasetId) {
      setErrorMessage("没有检测到 dataset_id，请先上传数据。");
      return;
    }

    if (selectedColumns.length === 0) {
      setErrorMessage("请至少选择一个字段。");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const cleanedTypeConfig: Record<string, string> = {};

      Object.entries(typeConfig).forEach(([col, value]) => {
        if (value && value !== "不转换") {
          cleanedTypeConfig[col] = value;
        }
      });

      const data = await runCleaning({
        dataset_id: datasetId,
        selected_columns: selectedColumns,
        drop_duplicates: dropDuplicates,
        numeric_missing_method: numericMissingMethod,
        categorical_missing_method: categoricalMissingMethod,
        outlier_method: outlierMethod,
        type_config: cleanedTypeConfig,
      });

      setResult(data);
      setDatasetId(data.cleaned_dataset_id);
      setProfile(data.summary);
      setSelectedColumns(data.summary.columns || []);

      const initTypes: Record<string, string> = {};
      (data.summary.columns || []).forEach((col) => {
        initTypes[col] = "不转换";
      });
      setTypeConfig(initTypes);
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "数据清洗失败，请检查后端日志。";

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h1>数据清洗</h1>

      <p className="page-description">
        对当前数据集进行字段选择、类型转换、缺失值处理、重复值删除和异常值处理。
        当前版本对齐旧 Streamlit 项目的 data_cleaning.py 能力。
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
                </>
              )}
            </div>

            <div className="button-row">
              <button
                className="secondary-button"
                onClick={handleLoadProfile}
                disabled={profileLoading}
              >
                {profileLoading ? "正在加载..." : "重新加载数据 Profile"}
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
            <div className="form-card">
              <h2>字段选择</h2>

              <p>
                只保留选中的字段进入清洗结果。目标变量也要保留，否则后续建模会找不到目标列。
              </p>

              <div className="button-row">
                <button className="secondary-button" onClick={toggleAllColumns}>
                  {allColumnsSelected ? "取消全选" : "全选字段"}
                </button>
              </div>

              <div className="checkbox-grid">
                {profile.columns.map((col) => (
                  <label key={col} className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                    />
                    {col}
                  </label>
                ))}
              </div>
            </div>
          )}

          {profile && (
            <div className="form-card">
              <h2>字段类型转换</h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>字段名</th>
                      <th>当前类型</th>
                      <th>缺失值</th>
                      <th>转换为</th>
                    </tr>
                  </thead>

                  <tbody>
                    {profile.columns.map((col) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td>{getDtype(profile, col)}</td>
                        <td>{getMissingCount(profile, col)}</td>
                        <td>
                          <select
                            value={typeConfig[col] || "不转换"}
                            onChange={(e) =>
                              handleTypeChange(col, e.target.value)
                            }
                          >
                            {typeOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="form-card">
            <h2>清洗策略</h2>

            <div className="checkbox-grid">
              <label className="checkbox-card">
                <input
                  type="checkbox"
                  checked={dropDuplicates}
                  onChange={(e) => setDropDuplicates(e.target.checked)}
                />
                删除重复行
              </label>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>数值缺失值处理</label>
                <select
                  value={numericMissingMethod}
                  onChange={(e) => setNumericMissingMethod(e.target.value)}
                >
                  {numericMissingMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>类别缺失值处理</label>
                <select
                  value={categoricalMissingMethod}
                  onChange={(e) => setCategoricalMissingMethod(e.target.value)}
                >
                  {categoricalMissingMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>异常值处理</label>
              <select
                value={outlierMethod}
                onChange={(e) => setOutlierMethod(e.target.value)}
              >
                {outlierMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="button-row">
              <button onClick={handleRunCleaning} disabled={loading}>
                {loading ? "正在清洗..." : "运行数据清洗"}
              </button>
            </div>
          </div>

          {result && (
            <>
              <div className="card">
                <h2>清洗摘要</h2>

                <div className="table-wrapper">
                  <table>
                    <tbody>
                      {Object.entries(result.cleaning_summary).map(
                        ([key, value]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td>{String(value)}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card-grid">
                <div className="card">
                  <h2>清洗前缺失值</h2>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>字段</th>
                          <th>缺失数量</th>
                          <th>缺失比例(%)</th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.missing_value_summary_before.map((item) => (
                          <tr key={item["列名"]}>
                            <td>{item["列名"]}</td>
                            <td>{item["缺失值数量"]}</td>
                            <td>{item["缺失比例(%)"]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <h2>清洗后缺失值</h2>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>字段</th>
                          <th>缺失数量</th>
                          <th>缺失比例(%)</th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.missing_value_summary_after.map((item) => (
                          <tr key={item["列名"]}>
                            <td>{item["列名"]}</td>
                            <td>{item["缺失值数量"]}</td>
                            <td>{item["缺失比例(%)"]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card-grid">
                <div className="card">
                  <h2>清洗前字段类型</h2>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>字段</th>
                          <th>类型</th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.dtype_summary_before.map((item) => (
                          <tr key={item["列名"]}>
                            <td>{item["列名"]}</td>
                            <td>{item["数据类型"]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <h2>清洗后字段类型</h2>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>字段</th>
                          <th>类型</th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.dtype_summary_after.map((item) => (
                          <tr key={item["列名"]}>
                            <td>{item["列名"]}</td>
                            <td>{item["数据类型"]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>清洗后数据预览</h2>

                {result.preview.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          {Object.keys(result.preview[0]).map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {result.preview.slice(0, 20).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {Object.keys(result.preview[0]).map((col) => (
                              <td key={col}>
                                {row[col] === null || row[col] === undefined
                                  ? "NA"
                                  : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>暂无预览数据。</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default DataCleaning;