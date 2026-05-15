import axios from "axios";

export const backendApi = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 120000,
});

export type HealthResponse = {
  status: string;
  service: string;
};

export async function checkBackendHealth() {
  const response = await backendApi.get<HealthResponse>("/api/health");
  return response.data;
}

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
  preview: Record<string, any>[];
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
  train_rows: number;
  test_rows: number;
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