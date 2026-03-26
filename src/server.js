// ⚠️ CRITICAL: dotenv MUST be loaded first, before ANY other imports
import "dotenv/config";

// Now all other imports can use process.env safely
import app from "./app.js";
import http from "http";
import { Server } from "socket.io";
import dns from "node:dns";

// ✅ Fix for Railway DNS lookup issues (Node 17+)
dns.setDefaultResultOrder("ipv4first");

import { sequelize, Cafeteria } from "./models/index.js";
import { connectRedis, isRedisReady } from "./config/redis.js";
import logger from "./utils/logger.js";
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
    //Redis
    // ============================================
    // 🔥 REDIS CONNECTION
    // ============================================
    console.log("🔗 Connecting to Redis...");
    await connectRedis();
    console.log(isRedisReady() ? "✅ Redis connected" : "⚠️ Redis unavailable (running without cache)");

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

    logger.info("✅ Routes mounted");

    // ========== CAFETERIA SEED ==========
    const count = await Cafeteria.count();
    if (count === 0) {
      await Cafeteria.bulkCreate([
        { name: "ANANTHA AAHARA", location: "Main Block" },
        { name: "AROMOS", location: "Block A" },
        { name: "DHANAPANI", location: "Block B" },
        { name: "FOODCLUB", location: "Block C" },
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