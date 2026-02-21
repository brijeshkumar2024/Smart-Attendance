import axios from "axios";
import { API_BASE_URL } from "../src/config";

const timeoutMs = Number.parseInt(import.meta.env.VITE_API_TIMEOUT_MS, 10);

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export default API;
