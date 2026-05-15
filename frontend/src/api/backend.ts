import axios from "axios";

export const backendApi = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 60000,
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