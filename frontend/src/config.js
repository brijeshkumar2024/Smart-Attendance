const fallbackApiBaseUrl = import.meta.env.DEV
  ? "http://localhost:5000/api"
  : "https://smart-attendance-1-q3wu.onrender.com/api";

const deprecatedApiHosts = {
  "smart-attendance-api.onrender.com": "https://smart-attendance-1-q3wu.onrender.com",
};

const normalizeUrl = (url) => String(url || "").replace(/\/+$/, "");

const resolveApiBaseUrl = (rawUrl) => {
  const normalized = normalizeUrl(rawUrl);
  try {
    const parsed = new URL(normalized);
    const migrated = deprecatedApiHosts[parsed.host];
    if (!migrated) {
      return normalized;
    }
    const migratedPath = parsed.pathname.replace(/\/+$/, "");
    return `${normalizeUrl(migrated)}${migratedPath}`;
  } catch {
    return normalized;
  }
};

const normalizedApiBase = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl
);

const API_BASE_URL = normalizedApiBase.endsWith("/api")
  ? normalizedApiBase
  : `${normalizedApiBase}/api`;

const SOCKET_URL = normalizeUrl(
  import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api$/, "")
);

export { API_BASE_URL, SOCKET_URL };
