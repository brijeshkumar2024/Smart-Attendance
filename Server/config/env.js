const parseCsvList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
const missingRequiredEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingRequiredEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingRequiredEnvVars.join(", ")}`
  );
}

const defaultDevOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const configuredOrigins = parseCsvList(process.env.CORS_ORIGINS);
const allowedOrigins =
  configuredOrigins.length > 0 ? configuredOrigins : isProduction ? [] : defaultDevOrigins;

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }
  const normalizedOrigin = String(origin).replace(/\/+$/, "");
  if (allowedOrigins.includes("*")) {
    return true;
  }
  return allowedOrigins.includes(normalizedOrigin);
};

module.exports = {
  nodeEnv,
  isProduction,
  allowedOrigins,
  isOriginAllowed,
};
