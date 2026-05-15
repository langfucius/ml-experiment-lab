import { useState } from "react";
import { uploadDataset } from "../api/backend";
import type { DatasetSummary } from "../api/backend";

function DataUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("请先选择一个 CSV 或 Excel 文件。");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setDataset(null);

    try {
      const result = await uploadDataset(selectedFile);
      setDataset(result);

      localStorage.setItem("current_dataset_id", result.dataset_id);
      localStorage.setItem("current_dataset_summary", JSON.stringify(result));
    } catch (error: any) {
      console.error(error);

      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "上传失败，请检查文件格式或后端服务。";

      setErrorMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  const missingEntries = dataset
    ? Object.entries(dataset.missing_counts).filter(([, count]) => count > 0)
    : [];

  return (
    <section>
      <h1>数据上传</h1>

      <p className="page-description">
        上传 CSV / Excel 数据集。后端会使用 pandas 读取数据，并返回字段名、数据类型、
        缺失值统计和前 10 行预览。上传成功后会生成 dataset_id，供后续实验模块使用。
      </p>

      <div className="form-card">
        <h2>上传数据集</h2>

        <div className="form-group">
          <label>选择文件</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setSelectedFile(file);
              setErrorMessage("");
            }}
          />
          <small>支持 CSV、XLSX、XLS。建议先使用中小型数据集测试。</small>
        </div>

        {selectedFile && (
          <div className="info-box">
            <strong>已选择文件：</strong>
            {selectedFile.name}；大小：
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </div>
        )}

        <div className="button-row">
          <button onClick={handleUpload} disabled={loading}>
            {loading ? "正在上传并解析..." : "上传并解析"}
          </button>
        </div>

        {errorMessage && (
          <div className="error-box">
            <strong>上传失败：</strong>
            <pre>{errorMessage}</pre>
          </div>
        )}
      </div>

      {dataset && (
        <>
          <div className="card-grid">
            <div className="card">
              <h2>数据集概览</h2>
              <p>
                文件名：<strong>{dataset.filename || "未命名"}</strong>
              </p>
              <p>
                dataset_id：<code>{dataset.dataset_id}</code>
              </p>
              <p>
                行数：<strong>{dataset.rows}</strong>
              </p>
              <p>
                列数：<strong>{dataset.columns_count}</strong>
              </p>
            </div>

            <div className="card">
              <h2>字段类型概览</h2>
              <p>
                数值字段：<strong>{dataset.numeric_columns.length}</strong>
              </p>
              <p>
                类别字段：<strong>{dataset.categorical_columns.length}</strong>
              </p>
              <p>
                有缺失值字段：
                <strong>{missingEntries.length}</strong>
              </p>
            </div>
          </div>

          <div className="card">
            <h2>字段信息</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>字段名</th>
                    <th>数据类型</th>
                    <th>缺失值数量</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.columns.map((col) => (
                    <tr key={col}>
                      <td>{col}</td>
                      <td>{dataset.dtypes[col]}</td>
                      <td>{dataset.missing_counts[col] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>数据预览</h2>

            {dataset.preview.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(dataset.preview[0]).map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {dataset.preview.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {Object.keys(dataset.preview[0]).map((col) => (
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

          <div className="card">
            <h2>后续可以做什么</h2>
            <p>
              当前数据集已经上传到后端内存，并生成 dataset_id。后续的实验中心、
              噪声鲁棒性分析和 Bradley-Terry 测评模块都会基于这个 dataset_id 调用后端数据。
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export default DataUpload;