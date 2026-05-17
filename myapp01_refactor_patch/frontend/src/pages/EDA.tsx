import { useEffect, useState } from "react";
import { DatasetProfile, getEdaProfile, resolveDatasetId, runEdaPlot } from "../api/mlLabApi";

const CHART_TYPES = [
  { value: "histogram", label: "Histogram / 直方图" },
  { value: "boxplot", label: "Boxplot / 箱线图" },
  { value: "bar", label: "Bar chart / 类别条形图" },
  { value: "scatter", label: "Scatter / 散点图" },
  { value: "line", label: "Line chart / 折线图" },
  { value: "grouped_boxplot", label: "Grouped boxplot / 分组箱线图" },
  { value: "correlation_heatmap", label: "Correlation heatmap / 相关性热力图" },
  { value: "missing_values", label: "Missing values / 缺失值图" },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function SelectBox({ label, value, onChange, options, allowEmpty = true }: { label: string; value: string; onChange: (v: string) => void; options: string[]; allowEmpty?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">不选择</option>}
        {options.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>
    </label>
  );
}

export default function EDA() {
  const [datasetId, setDatasetId] = useState(resolveDatasetId());
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [chartType, setChartType] = useState("histogram");
  const [column, setColumn] = useState("");
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [hueCol, setHueCol] = useState("");
  const [heatmapColumns, setHeatmapColumns] = useState<string[]>([]);
  const [topN, setTopN] = useState(10);
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile(id = datasetId) {
    if (!id.trim()) {
      setError("没有找到 dataset_id。建议先完成数据上传或清洗。清洗后会自动优先使用 cleaned_dataset_id。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = await getEdaProfile(id.trim());
      setProfile(p);
      setColumn(p.numeric_columns[0] || p.columns[0] || "");
      setXCol(p.columns[0] || "");
      setYCol(p.numeric_columns[0] || p.columns[1] || "");
      setHueCol("");
      setHeatmapColumns(p.numeric_columns.slice(0, Math.min(6, p.numeric_columns.length)));
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

  function toggleHeatmapColumn(c: string) {
    setHeatmapColumns((old) => old.includes(c) ? old.filter((x) => x !== c) : [...old, c]);
  }

  async function draw() {
    if (!datasetId.trim()) return setError("缺少 dataset_id");
    setLoading(true);
    setError("");
    setImage("");
    try {
      const res = await runEdaPlot({
        dataset_id: datasetId.trim(),
        chart_type: chartType,
        column: column || undefined,
        x_col: xCol || undefined,
        y_col: yCol || undefined,
        hue_col: hueCol || undefined,
        columns: heatmapColumns,
        top_n: topN,
      });
      setImage(`data:${res.mime_type};base64,${res.image_base64}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const columns = profile?.columns || [];
  const numericColumns = profile?.numeric_columns || [];
  const categoricalColumns = profile?.categorical_columns || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">EDA 探索性分析</h1>
        <p className="mt-1 text-sm text-slate-600">覆盖旧版 histogram、boxplot、bar、scatter、line、grouped boxplot、correlation heatmap、missing values。</p>
      </div>

      <Card title="数据集选择">
        <div className="flex flex-col gap-3 md:flex-row">
          <input className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" value={datasetId} onChange={(e) => setDatasetId(e.target.value)} placeholder="dataset_id / cleaned_dataset_id" />
          <button onClick={() => loadProfile()} disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">读取字段</button>
        </div>
        {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </Card>

      {profile && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card title="图表配置">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">图表类型</span>
                <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                  {CHART_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>

              {["histogram", "boxplot"].includes(chartType) && <SelectBox label="字段" value={column} onChange={setColumn} options={numericColumns.length ? numericColumns : columns} allowEmpty={false} />}
              {chartType === "bar" && <><SelectBox label="类别字段" value={column} onChange={setColumn} options={columns} allowEmpty={false} /><label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Top N</span><input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="number" min={1} max={50} value={topN} onChange={(e) => setTopN(Number(e.target.value))} /></label></>}
              {chartType === "scatter" && <><SelectBox label="X 字段" value={xCol} onChange={setXCol} options={numericColumns.length ? numericColumns : columns} allowEmpty={false} /><SelectBox label="Y 字段" value={yCol} onChange={setYCol} options={numericColumns.length ? numericColumns : columns} allowEmpty={false} /><SelectBox label="颜色分组字段（可选）" value={hueCol} onChange={setHueCol} options={categoricalColumns.length ? categoricalColumns : columns} /></>}
              {chartType === "line" && <><SelectBox label="X 字段" value={xCol} onChange={setXCol} options={columns} allowEmpty={false} /><SelectBox label="Y 字段" value={yCol} onChange={setYCol} options={numericColumns.length ? numericColumns : columns} allowEmpty={false} /></>}
              {chartType === "grouped_boxplot" && <><SelectBox label="分组字段 X" value={xCol} onChange={setXCol} options={categoricalColumns.length ? categoricalColumns : columns} allowEmpty={false} /><SelectBox label="数值字段 Y" value={yCol} onChange={setYCol} options={numericColumns.length ? numericColumns : columns} allowEmpty={false} /></>}
              {chartType === "correlation_heatmap" && (
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-700">热力图字段（至少 2 个数值字段）</div>
                  <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
                    {(numericColumns.length ? numericColumns : columns).map((c) => (
                      <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={heatmapColumns.includes(c)} onChange={() => toggleHeatmapColumn(c)} />{c}</label>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={draw} disabled={loading} className="w-full rounded-xl bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">{loading ? "绘图中..." : "生成图表"}</button>
            </div>
          </Card>

          <Card title="图表结果">
            {!image && <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">请选择图表类型并生成</div>}
            {image && <img src={image} alt="EDA chart" className="max-h-[760px] w-full rounded-xl object-contain" />}
          </Card>
        </div>
      )}
    </div>
  );
}
