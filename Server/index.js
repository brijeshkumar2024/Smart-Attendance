require("dotenv").config();

const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
const express = require("express");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const classRoutes = require("./routes/classRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const semesterRoutes = require("./routes/semesterRoutes");
const adminAcademicRoutes = require("./routes/adminAcademicRoutes");
const errorHandler = require("./config/errorMiddleware");
const { initSocket } = require("./config/socket");
const { nodeEnv, allowedOrigins, isOriginAllowed } = require("./config/env");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const DB_STATE = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      const corsError = new Error("Origin blocked by CORS policy");
      corsError.status = 403;
      return callback(corsError);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (allowedOrigins.length === 0) {
  console.warn(
    "CORS allows only non-browser/no-origin requests. Set CORS_ORIGINS for browser clients."
  );
}

app.get("/", (req, res) => {
  res.send("Smart Attendance Backend Running");
});

app.get("/health", (req, res) => {
  const dbReadyState = mongoose.connection.readyState;
  res.status(dbReadyState === 1 ? 200 : 503).json({
    status: dbReadyState === 1 ? "ok" : "degraded",
    environment: nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    database: DB_STATE[dbReadyState] || "unknown",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/users", userRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/admin/academic", adminAcademicRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

let shuttingDown = false;
const gracefulShutdown = (signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    try {
      await mongoose.connection.close(false);
      console.log("HTTP server and MongoDB connection closed.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Forcing shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
};

const startServer = async () => {
  await connectDB();
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`[${nodeEnv}] Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  gracefulShutdown("unhandledRejection");
});
