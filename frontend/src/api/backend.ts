import axios from "axios";

export const backendApi = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 30000,
});

export type HealthResponse = {
  status: string;
  service: string;
};

export async function checkBackendHealth() {
  const response = await backendApi.get<HealthResponse>("/api/health");
  return response.data;
}