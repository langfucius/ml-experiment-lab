import axios from "axios";

export const backendApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  timeout: 180000,
});

// =============================
// Health
// =============================

export type HealthResponse = {
  status: string;
  service: string;
};

export async function checkBackendHealth() {
  const response = await backendApi.get<HealthResponse>("/api/health");
  return response.data;
}

// =============================
// DeepSeek API Settings
// =============================

export type DeepSeekTestRequest = {
  api_key: string;
  base_url: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
};

export type DeepSeekTestResponse = {
  ok: boolean;
  message: string;
  model_name: string;
};

export async function testDeepSeekConnection(payload: DeepSeekTestRequest) {
  const response = await backendApi.post<DeepSeekTestResponse>(
    "/api/llm/test",
    payload
  );

  return response.data;
}

// =============================
// Dataset Upload
// =============================

export type DatasetSummary = {
  dataset_id: string;
  filename?: string;
  rows: number;
  columns_count: number;
  columns: string[];
  dtypes: Record<string, string>;
  missing_counts: Record<string, number>;
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns?: string[];
  preview: Record<string, any>[];
  missing_value_summary?: Record<string, any>[];
  dtype_summary?: Record<string, any>[];
};

export async function uploadDataset(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await backendApi.post<DatasetSummary>(
    "/api/data/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
}

// =============================
// Data Cleaning
// =============================

export type DatasetProfile = {
  dataset_id?: string;
  rows: number;
  columns_count: number;
  columns: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns?: string[];
  preview?: Record<string, any>[];

  dtypes?: Record<string, string>;
  missing_counts?: Record<string, number>;

  missing_value_summary?: {
    列名: string;
    缺失值数量: number;
    "缺失比例(%)": number;
  }[];

  dtype_summary?: {
    列名: string;
    数据类型: string;
  }[];
};

export type CleaningRequest = {
  dataset_id?: string;
  selected_columns?: string[];
  drop_duplicates: boolean;
  numeric_missing_method: string;
  categorical_missing_method: string;
  outlier_method: string;
  type_config: Record<string, string>;
};

export type CleaningResponse = {
  original_dataset_id?: string;
  cleaned_dataset_id: string;

  cleaning_summary: Record<string, any>;

  missing_value_summary_before: Record<string, any>[];
  missing_value_summary_after: Record<string, any>[];

  dtype_summary_before: Record<string, any>[];
  dtype_summary_after: Record<string, any>[];

  preview: Record<string, any>[];

  summary: DatasetProfile;
};

export function resolveDatasetId(): string {
  const rawSummary = localStorage.getItem("current_dataset_summary");

  if (rawSummary) {
    try {
      const parsed = JSON.parse(rawSummary);
      if (parsed?.dataset_id) {
        return parsed.dataset_id;
      }
    } catch {
      // ignore
    }
  }

  return localStorage.getItem("current_dataset_id") || "";
}

export function getLocalDatasetProfile(): DatasetProfile | null {
  const rawSummary = localStorage.getItem("current_dataset_summary");

  if (!rawSummary) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSummary);

    return {
      dataset_id: parsed.dataset_id,
      rows: parsed.rows,
      columns_count: parsed.columns_count,
      columns: parsed.columns || [],
      numeric_columns: parsed.numeric_columns || [],
      categorical_columns: parsed.categorical_columns || [],
      datetime_columns: parsed.datetime_columns || [],
      preview: parsed.preview || [],
      dtypes: parsed.dtypes || {},
      missing_counts: parsed.missing_counts || {},
      missing_value_summary:
        parsed.missing_value_summary ||
        Object.entries(parsed.missing_counts || {}).map(([col, count]) => ({
          列名: col,
          缺失值数量: Number(count),
          "缺失比例(%)": 0,
        })),
      dtype_summary:
        parsed.dtype_summary ||
        Object.entries(parsed.dtypes || {}).map(([col, dtype]) => ({
          列名: col,
          数据类型: String(dtype),
        })),
    };
  } catch {
    return null;
  }
}

export async function getCleaningProfile(datasetId: string) {
  const response = await backendApi.post<DatasetProfile>(
    "/api/cleaning/profile",
    {
      dataset_id: datasetId,
    }
  );

  return response.data;
}

export async function runCleaning(payload: CleaningRequest) {
  const response = await backendApi.post<CleaningResponse>(
    "/api/cleaning/run",
    payload
  );

  const data = response.data;

  localStorage.setItem("current_dataset_id", data.cleaned_dataset_id);
  localStorage.setItem("current_dataset_summary", JSON.stringify(data.summary));
  localStorage.setItem("last_cleaning_result", JSON.stringify(data));

  return data;
}

// =============================
// EDA Plot Image API
// =============================

export type EDAPlotRequest = {
  dataset_id?: string;
  chart_type: string;
  column?: string;
  x_col?: string;
  y_col?: string;
  hue_col?: string;
  columns?: string[];
  top_n?: number;
};

export type EDAPlotResponse = {
  chart_type: string;
  image_base64: string;
  mime_type: string;
};

export async function getEDAProfile(datasetId: string) {
  const response = await backendApi.post<DatasetProfile>("/api/eda/profile", {
    dataset_id: datasetId,
  });

  return response.data;
}

export async function generateEDAPlot(payload: EDAPlotRequest) {
  const response = await backendApi.post<EDAPlotResponse>(
    "/api/eda/plot",
    payload
  );

  return response.data;
}

// =============================
// Basic Experiment
// =============================

export type TaskType = "classification" | "regression";

export type ExperimentRunRequest = {
  dataset_id: string;
  target_column: string;
  task_type: TaskType;
  model_names: string[];
  test_size: number;
  random_state: number;
};

export type ExperimentMetricResult = {
  model_name: string;
  task_type: TaskType;
  accuracy?: number | null;
  f1_macro?: number | null;
  roc_auc?: number | null;
  mae?: number | null;
  rmse?: number | null;
  r2?: number | null;
  train_rows?: number;
  test_rows?: number;
  status: string;
  error?: string | null;
};

export type ExperimentRunResponse = {
  dataset_id: string;
  target_column: string;
  task_type: TaskType;
  test_size: number;
  random_state: number;
  results: ExperimentMetricResult[];
};

export async function runExperiment(payload: ExperimentRunRequest) {
  const response = await backendApi.post<ExperimentRunResponse>(
    "/api/experiment/run",
    payload
  );

  return response.data;
}

// =============================
// Dynamic Experiment
// =============================

export type DynamicExperimentRequest = {
  dataset_id: string;
  target_column: string;
  task_type: TaskType;
  model_name: string;
  dynamic_variable: string;
  start: number;
  end: number;
  steps: number;
  test_size: number;
  random_state: number;
};

export type DynamicExperimentPoint = ExperimentMetricResult & {
  x: number;
  dynamic_variable: string;
  label_noise_rate?: number;
  feature_noise_std?: number;
  missing_rate?: number;
  model_params?: Record<string, any>;
};

export type DynamicExperimentResponse = {
  dataset_id: string;
  target_column: string;
  task_type: TaskType;
  model_name: string;
  dynamic_variable: string;
  values: number[];
  curve: DynamicExperimentPoint[];
};

export async function runDynamicExperiment(payload: DynamicExperimentRequest) {
  const response = await backendApi.post<DynamicExperimentResponse>(
    "/api/experiment/dynamic",
    payload
  );

  return response.data;
}

// =============================
// Bradley-Terry
// =============================

export type BradleyTerryRunRequest = {
  dataset_id: string;
  target_column: string;
  task_type: TaskType;
  model_names: string[];
  metric: string;
  dynamic_variable: string;
  start: number;
  end: number;
  steps: number;
  test_size: number;
  random_state: number;
};

export type BradleyTerryRankingItem = {
  model_name: string;
  bt_score: number;
  strength: number;
  wins: number;
  losses: number;
  total_games: number;
  win_rate: number | null;
  rank: number;
};

export type BradleyTerryRunResponse = {
  dataset_id: string;
  target_column: string;
  task_type: TaskType;
  model_names: string[];
  metric: string;
  dynamic_variable: string;
  values: number[];
  win_matrix: Record<string, Record<string, number>>;
  ranking: BradleyTerryRankingItem[];
  experiment_rows: Record<string, any>[];
};

export async function runBradleyTerry(payload: BradleyTerryRunRequest) {
  const response = await backendApi.post<BradleyTerryRunResponse>(
    "/api/bradley-terry/run",
    payload
  );

  return response.data;
}

// =============================
// AI Report
// =============================

export type ReportGenerateRequest = {
  api_key: string;
  base_url: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  dataset_summary?: Record<string, any> | null;
  cleaning_result?: Record<string, any> | null;
  experiment_result?: Record<string, any> | null;
  dynamic_result?: Record<string, any> | null;
  bradley_terry_result?: Record<string, any> | null;
  report_language: string;
  report_style: string;
};

export type ReportGenerateResponse = {
  ok: boolean;
  report_markdown: string;
  model_name: string;
};

export async function generateReport(payload: ReportGenerateRequest) {
  const response = await backendApi.post<ReportGenerateResponse>(
    "/api/report/generate",
    payload
  );

  return response.data;
}
