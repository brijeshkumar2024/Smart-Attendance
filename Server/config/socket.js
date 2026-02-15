const { Server } = require("socket.io");

let ioInstance;

const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

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
