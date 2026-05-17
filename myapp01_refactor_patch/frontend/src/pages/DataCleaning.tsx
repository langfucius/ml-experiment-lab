import { useEffect, useMemo, useState } from "react";
import { CleaningResponse, DatasetProfile, getCleaningProfile, resolveDatasetId, runCleaning } from "../api/mlLabApi";

const NUMERIC_METHODS = ["不处理", "删除缺失行", "均值填充", "中位数填充", "0填充", "线性插值", "前向填充", "后向填充"];
const CATEGORICAL_METHODS = ["不处理", "删除缺失行", "众数填充", "Unknown填充"];
const OUTLIER_METHODS = ["不处理", "IQR剔除", "Z-score剔除"];
const TYPE_OPTIONS = ["不转换", "numeric", "category", "datetime", "string"];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function MiniTable({ rows, maxRows = 8 }: { rows: Record<string, unknown>[]; maxRows?: number }) {
  const shown = rows.slice(0, maxRows);
  const columns = useMemo(() => Array.from(new Set(shown.flatMap((row) => Object.keys(row)))), [shown]);
  if (!rows.length) return <p className="text-sm text-slate-500">暂无数据</p>;
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{columns.map((col) => <th key={col} className="whitespace-nowrap px-3 py-2 text-left font-medium">{col}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map((col) => (
                <td key={col} className="max-w-[220px] truncate px-3 py-2 text-slate-700">{String(row[col] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryGrid({ summary }: { summary: Record<string, unknown> }) {
  const entries = Object.entries(summary || {});
  if (!entries.length) return <p className="text-sm text-slate-500">暂无摘要</p>;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">{key}</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

export default function DataCleaning() {
  const [datasetId, setDatasetId] = useState(resolveDatasetId());
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [typeConfig, setTypeConfig] = useState<Record<string, string>>({});
  const [dropDuplicates, setDropDuplicates] = useState(false);
  const [numericMethod, setNumericMethod] = useState("不处理");
  const [categoricalMethod, setCategoricalMethod] = useState("不处理");
  const [outlierMethod, setOutlierMethod] = useState("不处理");
  const [result, setResult] = useState<CleaningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile(id = datasetId) {
    if (!id.trim()) {
      setError("没有找到 dataset_id。请先在数据上传页上传数据，或手动填入 dataset_id。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = await getCleaningProfile(id.trim());
      setProfile(p);
      setSelectedColumns(p.columns);
      setTypeConfig(Object.fromEntries(p.columns.map((c) => [c, "不转换"])));
      localStorage.setItem("current_dataset_id", id.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (datasetId) loadProfile(datasetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleColumn(column: string) {
    setSelectedColumns((prev) => prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]);
  }

  async function handleClean() {
    if (!datasetId.trim()) {
      setError("缺少 dataset_id");
      return;
    }
    if (!selectedColumns.length) {
      setError("至少选择一个字段参与清洗");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const cleanTypeConfig = Object.fromEntries(
        Object.entries(typeConfig).filter(([, v]) => v && v !== "不转换")
      );
      const res = await runCleaning({
        dataset_id: datasetId.trim(),
        selected_columns: selectedColumns,
        drop_duplicates: dropDuplicates,
        numeric_missing_method: numericMethod,
        categorical_missing_method: categoricalMethod,
        outlier_method: outlierMethod,
        type_config: cleanTypeConfig,
      });
      setResult(res);
      localStorage.setItem("cleaned_dataset_id", res.cleaned_dataset_id);
      localStorage.setItem("current_dataset_id", res.cleaned_dataset_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">数据清洗</h1>
        <p className="mt-1 text-sm text-slate-600">覆盖旧版 mini ML Lab 的字段选择、类型转换、缺失值、异常值、重复值与清洗摘要。</p>
      </div>

      <Card title="数据集选择">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            placeholder="dataset_id / cleaned_dataset_id"
          />
          <button onClick={() => loadProfile()} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">读取字段</button>
        </div>
        {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </Card>

      {profile && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card title="字段选择与类型转换">
            <div className="mb-3 flex gap-2">
              <button className="rounded-lg bg-slate-100 px-3 py-1 text-sm" onClick={() => setSelectedColumns(profile.columns)}>全选</button>
              <button className="rounded-lg bg-slate-100 px-3 py-1 text-sm" onClick={() => setSelectedColumns([])}>清空</button>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
              {profile.columns.map((col) => (
                <div key={col} className="grid grid-cols-[auto_1fr_150px] items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <input type="checkbox" checked={selectedColumns.includes(col)} onChange={() => toggleColumn(col)} />
                  <div>
                    <div className="font-medium text-slate-800">{col}</div>
                    <div className="text-xs text-slate-500">{profile.numeric_columns.includes(col) ? "numeric" : profile.datetime_columns.includes(col) ? "datetime" : "categorical/string"}</div>
                  </div>
                  <select className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={typeConfig[col] || "不转换"} onChange={(e) => setTypeConfig((old) => ({ ...old, [col]: e.target.value }))}>
                    {TYPE_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card title="清洗策略">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">数值缺失值策略</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={numericMethod} onChange={(e) => setNumericMethod(e.target.value)}>
                {NUMERIC_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>

              <label className="block text-sm font-medium text-slate-700">类别缺失值策略</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={categoricalMethod} onChange={(e) => setCategoricalMethod(e.target.value)}>
                {CATEGORICAL_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>

              <label className="block text-sm font-medium text-slate-700">异常值策略</label>
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={outlierMethod} onChange={(e) => setOutlierMethod(e.target.value)}>
                {OUTLIER_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>

              <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <input type="checkbox" checked={dropDuplicates} onChange={(e) => setDropDuplicates(e.target.checked)} />
                删除重复值
              </label>

              <button onClick={handleClean} disabled={loading} className="w-full rounded-xl bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">
                {loading ? "处理中..." : "开始清洗并生成 cleaned_dataset_id"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {profile && !result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="原始缺失值摘要"><MiniTable rows={profile.missing_value_summary} /></Card>
          <Card title="原始类型摘要"><MiniTable rows={profile.dtype_summary} /></Card>
          <Card title="原始数据预览"><MiniTable rows={profile.preview} /></Card>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <Card title="清洗结果摘要">
            <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">cleaned_dataset_id：<b>{result.cleaned_dataset_id}</b>（已写入 localStorage，EDA 会优先读取它）</div>
            <SummaryGrid summary={result.cleaning_summary} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="清洗前缺失值摘要"><MiniTable rows={result.missing_value_summary_before} /></Card>
            <Card title="清洗后缺失值摘要"><MiniTable rows={result.missing_value_summary_after} /></Card>
            <Card title="清洗前类型摘要"><MiniTable rows={result.dtype_summary_before} /></Card>
            <Card title="清洗后类型摘要"><MiniTable rows={result.dtype_summary_after} /></Card>
          </div>
          <Card title="清洗后数据预览"><MiniTable rows={result.preview} maxRows={12} /></Card>
        </div>
      )}
    </div>
  );
}
