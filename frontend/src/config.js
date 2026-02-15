const fallbackApiBaseUrl = "http://localhost:5000/api";

const normalizeUrl = (url) => String(url || "").replace(/\/+$/, "");

const normalizedApiBase = normalizeUrl(
  import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl
);

const API_BASE_URL = normalizedApiBase.endsWith("/api")
  ? normalizedApiBase
  : `${normalizedApiBase}/api`;

const SOCKET_URL = normalizeUrl(
  import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api$/, "")
);

export { API_BASE_URL, SOCKET_URL };
