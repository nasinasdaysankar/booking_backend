import "dotenv/config";

import app from "./app.js";
import http from "http";
import { Server } from "socket.io";

import { sequelize, Cafeteria } from "./models/index.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import foodRoutes from "./routes/foodRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cafeteriaRoutes from "./routes/cafeteriaRoutes.js";
import compression from "compression";

import { initSocket } from "./socket.js";
import { initNotificationScheduler } from "./cron/notificationScheduler.js";

const PORT = process.env.PORT || 4000;
const SHOULD_SYNC = process.env.DB_SYNC === "true";

// ========== HTTP SERVER ==========
const server = http.createServer(app);

// ========== SOCKET.IO SERVER ==========
const io = new Server(server, {
  cors: { origin: "*" },
});

// ✅ STORE SOCKET INSTANCE
initSocket(io);

// ========== SOCKET EVENTS ==========
io.on("connection", (socket) => {
  console.log("⚡ Socket connected:", socket.id);

  // ===== ADMIN joins cafeteria =====
  socket.on("JOIN_CAFETERIA", (cafeteriaId) => {
    const room = `cafeteria_${cafeteriaId}`;
    socket.join(room);
    console.log(`🏪 Admin joined room: ${room}`);
  });

  // ===== USER joins personal room =====
  socket.on("JOIN_USER", (userId) => {
    const room = `user_${userId}`;
    socket.join(room);
    console.log(`👤 User joined room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});


// ========== START SERVER ==========
const start = async () => {
  try {
    console.log("🔗 Connecting to database...");
    await sequelize.authenticate();
    console.log("✅ Database connected");

    if (SHOULD_SYNC) {
      await sequelize.sync({ alter: false });
      console.log("🧱 Sequelize sync done");
    } else {
      console.log("⚠️ Sequelize sync skipped");
    }

    // ============================================
    // 🔥 COMPRESSION - BEFORE ROUTES FOR EFFICIENCY
    // ============================================
    app.use(compression());
    console.log("✅ Compression enabled");

    // ========== ROUTES ==========
    app.use("/api/menu", menuRoutes);
    app.use("/api/banners", bannerRoutes);
    app.use("/api/food", foodRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/notify", notificationRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/cafeterias", cafeteriaRoutes);

    console.log("✅ Routes mounted");

    // ========== CAFETERIA SEED ==========
    const count = await Cafeteria.count();
    if (count === 0) {
      await Cafeteria.bulkCreate([
        { name: "ANANTHA AAHARA", location: "Main Block", staticQrToken: "STATIC_QR_CAFETERIA_1" },
        { name: "AROMOS", location: "Block A", staticQrToken: "AROMAS_QR_123" },
        { name: "DHANAPANI", location: "Block B", staticQrToken: "NESTLE_QR_789" },
        { name: "FOODCLUB", location: "Block C", staticQrToken: "FOODCOURT_QR_456" },
      ]);
      console.log("📌 Cafeterias seeded");
    }

    // ========== START LISTENING ==========
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log("⚡ WebSocket enabled");
      console.log("🔥 Optimized for 700-1000 concurrent users");

      initNotificationScheduler(); // ⏰ Start Cron
    });

  } catch (err) {
    console.error("❌ Server failed:", err);
    process.exit(1);
  }
};

start();


