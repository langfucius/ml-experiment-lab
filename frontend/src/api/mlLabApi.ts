import { backendApi } from "./backend";
import type { DatasetSummary } from "./backend";

export type DatasetProfile = {
  dataset_id: string;
  rows: number;
  columns_count: number;
  columns: string[];
  dtypes: Record<string, string>;
  missing_counts: Record<string, number>;
  numeric_columns: string[];
  categorical_columns: string[];
  preview?: Record<string, any>[];
};

export type CleaningRequest = {
  dataset_id: string;
  selected_columns?: string[];
  drop_duplicates?: boolean;

  numeric_missing_method?: string;
  categorical_missing_method?: string;
  outlier_method?: string;

  type_config?: Record<string, string>;

  remove_duplicates?: boolean;
  fill_missing?: boolean;
  numeric_strategy?: string;
  categorical_strategy?: string;
  drop_high_missing?: boolean;
  missing_threshold?: number;
  iqr_factor?: number;
  zscore_threshold?: number;
  try_numeric_conversion?: boolean;
  try_datetime_conversion?: boolean;
};

export type CleaningResponse = {
  original_dataset_id: string;
  cleaned_dataset_id: string;
  before: Record<string, any>;
  after: Record<string, any>;
  steps: string[];
  summary: DatasetSummary | DatasetProfile;
  missing_summary?: any[];
  dtype_summary?: any[];
};

function getStoredDatasetSummary(): DatasetProfile | null {
  const raw = localStorage.getItem("current_dataset_summary");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DatasetProfile;
  } catch {
    return null;
  }
}

export function resolveDatasetId(): string {
  const summary = getStoredDatasetSummary();

  if (summary?.dataset_id) {
    return summary.dataset_id;
  }

  return localStorage.getItem("current_dataset_id") || "";
}

export async function getCleaningProfile(datasetId?: string): Promise<DatasetProfile> {
  const stored = getStoredDatasetSummary();

  if (stored) {
    return stored;
  }

  const finalDatasetId = datasetId || resolveDatasetId();

  if (!finalDatasetId) {
    throw new Error("没有检测到 dataset_id，请先上传数据。");
  }

  // 如果后端暂时没有 profile 接口，就用 datasets 接口兜底。
  const response = await backendApi.get("/api/data/datasets");
  const datasets = response.data?.datasets || [];
  const matched = datasets.find((item: any) => item.dataset_id === finalDatasetId);

  if (!matched) {
    throw new Error("无法获取数据集信息，请重新上传数据。");
  }

  return {
    dataset_id: matched.dataset_id,
    rows: matched.rows,
    columns_count: matched.columns_count,
    columns: matched.columns || [],
    dtypes: {},
    missing_counts: {},
    numeric_columns: [],
    categorical_columns: [],
    preview: [],
  };
}

function normalizeCleaningPayload(payload: CleaningRequest) {
  return {
    dataset_id: payload.dataset_id,

    // 兼容旧版增强清洗字段
    selected_columns: payload.selected_columns,
    type_config: payload.type_config,
    numeric_missing_method: payload.numeric_missing_method,
    categorical_missing_method: payload.categorical_missing_method,

    // 兼容当前后端 cleaning.py 字段
    remove_duplicates:
      payload.remove_duplicates ?? payload.drop_duplicates ?? true,

    fill_missing:
      payload.fill_missing ??
      Boolean(payload.numeric_missing_method || payload.categorical_missing_method),

    numeric_strategy:
      payload.numeric_strategy ??
      mapNumericMissingMethod(payload.numeric_missing_method),

    categorical_strategy:
      payload.categorical_strategy ??
      mapCategoricalMissingMethod(payload.categorical_missing_method),

    drop_high_missing: payload.drop_high_missing ?? false,
    missing_threshold: payload.missing_threshold ?? 0.5,

    outlier_method:
      payload.outlier_method ? mapOutlierMethod(payload.outlier_method) : "none",

    iqr_factor: payload.iqr_factor ?? 1.5,
    zscore_threshold: payload.zscore_threshold ?? 3.0,

    try_numeric_conversion: payload.try_numeric_conversion ?? true,
    try_datetime_conversion: payload.try_datetime_conversion ?? false,
  };
}

function mapNumericMissingMethod(method?: string) {
  if (!method) return "median";

  const mapping: Record<string, string> = {
    不处理: "none",
    删除缺失行: "drop",
    均值填充: "mean",
    中位数填充: "median",
    "0填充": "zero",
    线性插值: "interpolate",
    前向填充: "ffill",
    后向填充: "bfill",
    mean: "mean",
    median: "median",
    zero: "zero",
    drop: "drop",
    none: "none",
    interpolate: "interpolate",
    ffill: "ffill",
    bfill: "bfill",
  };

  return mapping[method] || method;
}

function mapCategoricalMissingMethod(method?: string) {
  if (!method) return "mode";

  const mapping: Record<string, string> = {
    不处理: "none",
    删除缺失行: "drop",
    众数填充: "mode",
    Unknown填充: "unknown",
    mode: "mode",
    unknown: "unknown",
    drop: "drop",
    none: "none",
  };

  return mapping[method] || method;
}

function mapOutlierMethod(method?: string) {
  if (!method) return "none";

  const mapping: Record<string, string> = {
    不处理: "none",
    IQR剔除: "iqr",
    "Z-score剔除": "zscore",
    none: "none",
    iqr: "iqr",
    zscore: "zscore",
  };

  return mapping[method] || method;
}

export async function runCleaning(payload: CleaningRequest): Promise<CleaningResponse> {
  const normalizedPayload = normalizeCleaningPayload(payload);

  const response = await backendApi.post<CleaningResponse>(
    "/api/cleaning/run",
    normalizedPayload
  );

  const data = response.data;

  if (data.cleaned_dataset_id) {
    localStorage.setItem("current_dataset_id", data.cleaned_dataset_id);
  }

  if (data.summary) {
    localStorage.setItem("current_dataset_summary", JSON.stringify(data.summary));
  }

  return data;
}