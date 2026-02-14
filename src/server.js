// ⚠️ CRITICAL: dotenv MUST be loaded first, before ANY other imports
import "dotenv/config";

// Now all other imports can use process.env safely
import app from "./app.js";
import http from "http";
import { Server } from "socket.io";

import { sequelize, Cafeteria } from "./models/index.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import logger from "./utils/logger.js"; // ✅ Value Added
import foodRoutes from "./routes/foodRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cafeteriaRoutes from "./routes/cafeteriaRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
import compression from "compression";

import { initSocket } from "./socket.js";
import { initNotificationScheduler } from "./cron/notificationScheduler.js";

const PORT = process.env.PORT || 4000;
const SHOULD_SYNC = process.env.DB_SYNC === "true";

// Debug: Check if env vars are loaded
logger.info("🔍 Environment Check:");
logger.info("✅ NODE_ENV: " + process.env.NODE_ENV);
logger.info("✅ PORT: " + process.env.PORT);
logger.info("✅ AWS_REGION: " + (process.env.AWS_REGION ? "✅ Loaded" : "❌ Missing"));
logger.info("✅ AWS_S3_BUCKET_NAME: " + (process.env.AWS_S3_BUCKET_NAME ? "✅ Loaded" : "❌ Missing"));

// ========== HTTP SERVER ==========
const server = http.createServer(app);

// ========== SOCKET.IO SERVER ==========
const io = new Server(server, {
  cors: { origin: "*" },
});
//uday
// ✅ STORE SOCKET INSTANCE
initSocket(io);

// ========== SOCKET EVENTS ==========
io.on("connection", (socket) => {
  logger.info("⚡ Socket connected: " + socket.id);

  // ===== ADMIN joins cafeteria =====
  socket.on("JOIN_CAFETERIA", (cafeteriaId) => {
    const room = `cafeteria_${cafeteriaId}`;
    socket.join(room);
    logger.info(`🏪 Admin joined room: ${room}`);
  });

  // ===== USER joins personal room =====
  socket.on("JOIN_USER", (userId) => {
    const room = `user_${userId}`;
    socket.join(room);
    logger.info(`👤 User joined room: ${room}`);
  });

  socket.on("disconnect", () => {
    logger.info("❌ Socket disconnected: " + socket.id);
  });
});


// ========== START SERVER ==========
const start = async () => {
  try {
    logger.info("🔗 Connecting to database...");
    await sequelize.authenticate();
    logger.info("✅ Database connected");

    if (SHOULD_SYNC) {
      await sequelize.sync({ alter: false });
      logger.info("🧱 Sequelize sync done");
    } else {
      logger.warn("⚠️ Sequelize sync skipped");
    }

    // ============================================
    // 🔥 COMPRESSION - BEFORE ROUTES FOR EFFICIENCY
    // ============================================
    app.use(compression());
    logger.info("✅ Compression enabled");

    // ========== ROUTES ==========
    app.use("/api/menu", menuRoutes);
    app.use("/api/banners", bannerRoutes);
    app.use("/api/food", foodRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/notify", notificationRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/superadmin", superadminRoutes);
    app.use("/api/cafeterias", cafeteriaRoutes);

    logger.info("✅ Routes mounted");

    // ========== CAFETERIA SEED ==========
    const count = await Cafeteria.count();
    if (count === 0) {
      await Cafeteria.bulkCreate([
        { name: "ANANTHA AAHARA", location: "Main Block", staticQrToken: "STATIC_QR_CAFETERIA_1" },
        { name: "AROMOS", location: "Block A", staticQrToken: "AROMAS_QR_123" },
        { name: "DHANAPANI", location: "Block B", staticQrToken: "NESTLE_QR_789" },
        { name: "FOODCLUB", location: "Block C", staticQrToken: "FOODCOURT_QR_456" },
      ]);
      logger.info("📌 Cafeterias seeded");
    }

    // ========== START LISTENING ==========
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info("⚡ WebSocket enabled");
      logger.info("🔥 Optimized for 700-1000 concurrent users");

      initNotificationScheduler(); // ⏰ Start Cron
    });

  } catch (err) {
    logger.error("❌ Server failed: " + err.message);
    process.exit(1);
  }
};

start();