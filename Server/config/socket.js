const { Server } = require("socket.io");
const { isOriginAllowed, allowedOrigins } = require("./env");

let ioInstance;

const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Socket origin blocked by CORS policy"));
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  if (allowedOrigins.length === 0) {
    console.warn(
      "Socket CORS allows only non-browser/no-origin requests. Set CORS_ORIGINS for browser clients."
    );
  }

  ioInstance.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

module.exports = { initSocket, getIO };
