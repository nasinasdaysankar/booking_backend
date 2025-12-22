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

const PORT = process.env.PORT || 4000;
const SHOULD_SYNC = process.env.DB_SYNC === "true";

// ========== Create HTTP server + Socket.IO ==========
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use((req, res, next) => {
  req.io = io;
  next();
});

// ========== SOCKET LOGS ==========
io.on("connection", (socket) => {
  console.log("⚡ User Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ User Disconnected:", socket.id);
  });
});

// ========== START SERVER ==========
const start = async () => {
  try {
    console.log("🔗 Attempting to connect to database...");
    await sequelize.authenticate();
    console.log("✅ Database connected successfully!");

    // ========== OPTIONAL ONE-TIME TABLE CREATION ==========
    if (SHOULD_SYNC) {
      await sequelize.sync({ alter: false });
      console.log("🧱 Tables created from Sequelize models");
    } else {
      console.log("⚠️ Skipping sequelize.sync() (production mode)");
    }

    // ========== ROUTES ==========
    app.use("/api/menu", menuRoutes);
    console.log("Menu Route Mounted ✔ (/api/menu)");

    app.use("/api/banners", bannerRoutes);
    console.log("Banner Route Mounted ✔ (/api/banners)");

    app.use("/api/food", foodRoutes);
    console.log("Food Route Mounted ✔ (/api/food)");

    app.use("/api/upload", uploadRoutes);
    console.log("Upload Route Mounted ✔ (/api/upload)");

    app.use("/api/notify", notificationRoutes);
    console.log("Notification Route Mounted ✔ (/api/notify)");

    // ========== SAFE CAFETERIA SEED ==========
    let count = 0;
    try {
      count = await Cafeteria.count();
    } catch {
      console.log("ℹ️ cafeterias table not ready yet");
    }

    if (count === 0) {
      await Cafeteria.bulkCreate([
        { name: "ANANTHA AAHARA", location: "Main Block", staticQrToken: "STATIC_QR_CAFETERIA_1" },
        { name: "AROMOS", location: "Block A", staticQrToken: "AROMAS_QR_123" },
        { name: "DHANAPANI", location: "Block B", staticQrToken: "NESTLE_QR_789" },
        { name: "FOODCLUB", location: "Block C", staticQrToken: "FOODCOURT_QR_456" }
      ]);
      console.log("📌 Cafeterias seeded successfully");
    }

    // ========== START LISTENING ==========
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port: ${PORT}`);
      console.log("⚡ WebSocket Enabled");
    });

  } catch (err) {
    console.error("❌ Unable to start server:", err);
    process.exit(1);
  }
};

start();
