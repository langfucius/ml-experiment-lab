const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body?.detail || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail);
  }
  return res.json();
}

export type DatasetProfile = {
  dataset_id?: string;
  rows: number;
  columns_count: number;
  columns: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
  missing_value_summary: Record<string, unknown>[];
  dtype_summary: Record<string, unknown>[];
  preview: Record<string, unknown>[];
};

export type CleaningResponse = {
  cleaned_dataset_id: string;
  columns: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
  cleaning_summary: Record<string, unknown>;
  missing_value_summary_before: Record<string, unknown>[];
  missing_value_summary_after: Record<string, unknown>[];
  dtype_summary_before: Record<string, unknown>[];
  dtype_summary_after: Record<string, unknown>[];
  preview: Record<string, unknown>[];
};

export type CleaningPayload = {
  dataset_id?: string;
  data?: Record<string, unknown>[];
  selected_columns?: string[];
  drop_duplicates: boolean;
  numeric_missing_method: string;
  categorical_missing_method: string;
  outlier_method: string;
  type_config: Record<string, string>;
};

export type EdaPlotResponse = {
  chart_type: string;
  image_base64: string;
  mime_type: string;
};

export function getCleaningProfile(datasetId: string) {
  return requestJson<DatasetProfile>("/api/cleaning/profile", {
    method: "POST",
    body: JSON.stringify({ dataset_id: datasetId }),
  });
}

export function runCleaning(payload: CleaningPayload) {
  return requestJson<CleaningResponse>("/api/cleaning/clean", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getEdaProfile(datasetId: string) {
  return requestJson<DatasetProfile>("/api/eda/profile", {
    method: "POST",
    body: JSON.stringify({ dataset_id: datasetId }),
  });
}

export function runEdaPlot(payload: {
  dataset_id?: string;
  chart_type: string;
  column?: string;
  x_col?: string;
  y_col?: string;
  hue_col?: string;
  columns?: string[];
  top_n?: number;
}) {
  return requestJson<EdaPlotResponse>("/api/eda/plot", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolveDatasetId(): string {
  const keys = [
    "cleaned_dataset_id",
    "current_dataset_id",
    "dataset_id",
    "activeDatasetId",
    "uploadedDatasetId",
    "lastDatasetId",
  ];

  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value && value !== "undefined" && value !== "null") return value;
  }

  for (const key of Object.keys(localStorage)) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const found = parsed?.cleaned_dataset_id || parsed?.dataset_id || parsed?.id;
      if (typeof found === "string" && found.trim()) return found;
    } catch {
      // ignore non-json values
    }
  }
  return "";
}
