import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import http from "http";
import { Server } from "socket.io";

import { sequelize, Cafeteria } from "./models/index.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import foodRoutes from "./routes/foodRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import { initSocket } from "./socket.js";

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

  socket.on("JOIN_CAFETERIA", (cafeteriaId) => {
    const room = `cafeteria_${cafeteriaId}`;
    socket.join(room);
    console.log(`🏪 Joined room: ${room}`);
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

    // ========== ROUTES ==========
    app.use("/api/menu", menuRoutes);
    app.use("/api/banners", bannerRoutes);
    app.use("/api/food", foodRoutes);
    app.use("/api/upload", uploadRoutes);
    app.use("/api/notify", notificationRoutes);

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

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log("⚡ WebSocket enabled");
    });
  } catch (err) {
    console.error("❌ Server failed:", err);
    process.exit(1);
  }
};

start();
