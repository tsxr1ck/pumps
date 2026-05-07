import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./lib/env.js";
import { verifyAccessToken } from "./lib/tokens.js";

// Routes
import authRoutes from "./routes/auth.js";
import pumpRoutes from "./routes/pumps.js";
import shiftRoutes from "./routes/shifts.js";
import readingRoutes from "./routes/readings.js";
import transactionRoutes from "./routes/transactions.js";
import withdrawalRoutes from "./routes/withdrawals.js";
import priceRoutes from "./routes/prices.js";
import creditRoutes from "./routes/credits.js";
import userRoutes from "./routes/users.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";

// Realtime
import { startSubscriber } from "./realtime/subscriber.js";

// env is validated and loaded via ./lib/env.ts

const app = express();
const server = createServer(app);
const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim());
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/pumps", pumpRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/readings", readingRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    next(new Error("Authentication required"));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    socket.data.user = payload;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user;
  console.log(`Socket connected: ${user?.name || "unknown"} (${socket.id})`);

  if (user?.role === "Manager") {
    socket.join("managers");
  }
  if (user?.role === "Dispatcher") {
    socket.join("dispatchers");
  }

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Redis subscriber
startSubscriber(io);

// Start server
server.listen(env.PORT, () => {
  console.log(`Pumps API server listening on port ${env.PORT}`);
});
