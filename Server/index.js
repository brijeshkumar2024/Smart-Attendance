require("dotenv").config();


const cors = require("cors");
const http = require("http");


const express = require("express");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const classRoutes = require("./routes/classRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const semesterRoutes = require("./routes/semesterRoutes");
const errorHandler = require("./config/errorMiddleware");
const { initSocket } = require("./config/socket");





const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());
app.use("/api/users", userRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/semesters", semesterRoutes);
app.use(errorHandler);




// Connect Database
connectDB();

app.get("/", (req, res) => {
  res.send("Smart Attendance Backend Running");
});

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

