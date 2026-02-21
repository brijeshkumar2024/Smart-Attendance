const fallbackApiBaseUrl = import.meta.env.DEV
  ? "http://localhost:5000/api"
  : "https://smart-attendance-na5m.onrender.com/api";

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

if (!import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
  console.warn(
    "VITE_API_BASE_URL is not set. Frontend is using the default production API."
  );
}

export { API_BASE_URL, SOCKET_URL };
