import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import http from "http";                     // NEW ⬅
import { Server } from "socket.io";          // NEW ⬅

import { sequelize, Cafeteria } from "./models/index.js";
import uploadRoutes from "./routes/uploadRoutes.js"; 
import foodRoutes from "./routes/foodRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js"; 
import NotificationModel from "./models/notificationModel.js";  // ✔ CORRECT PATH


const PORT = process.env.PORT || 4000;

// ========== Create HTTP server + Bind Socket.IO ========== //
const server = http.createServer(app);       // REPLACED app.listen()
const io = new Server(server, { cors: { origin: "*" } });

app.use((req, res, next) => {
  req.io = io;   // ⬅ allow routes to push notifications
  next();
});

// ============= REAL TIME SOCKET LOGS ================= //
io.on("connection", (socket) => {
  console.log("⚡ User Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ User Disconnected:", socket.id);
  });
});


const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected ✅");

    //================= MENU ROUTES ==========================
    app.use("/api/menu", menuRoutes);
    console.log("Menu Route Mounted ✔ (/api/menu)");

console.log("⚠️ Skipping sequelize.sync() to avoid column conflict");
    console.log("DB synced 🔄");

    //================= BANNER ROUTES ========================
    app.use("/api/banners", bannerRoutes);
    console.log("Banner Route Mounted ✔ (/api/banners)");

    //================= FOOD ROUTES ==========================
    app.use("/api/food", foodRoutes);
    console.log("Food Route Mounted ✔ (/api/food)");

    //================= IMAGE UPLOAD ROUTES ==================
    app.use("/api/upload", uploadRoutes);
    console.log("Upload Route Mounted ✔ (/api/upload)");

    //================= Notification API =====================
    app.use("/api/notify", notificationRoutes);  // NEW ⬅
    console.log("Notification Route Mounted ✔ (/api/notify)");

    // SEED DEFAULT CAFETERIAS
    // SEED ACTUAL CAFETERIAS
    const count = await Cafeteria.count();
    if (count === 0) {
      await Cafeteria.bulkCreate([
        { id: 1, name: "ANANTHA AAHARA", location: "Main Block", staticQrToken: "STATIC_QR_CAFETERIA_1" },
        { id: 2, name: "AROMOS", location: "Block A", staticQrToken: "AROMAS_QR_123" },
        { id: 3, name: "DHANAPANI", location: "Block B", staticQrToken: "NESTLE_QR_789" },
        { id: 4, name: "FOODCLUB", location: "Block C", staticQrToken: "FOODCOURT_QR_456" }
      ]);
      console.log("📌 Actual Cafeterias Inserted ✔");
      
      // Sync the ID sequence so the next manual insert doesn't fail
      await sequelize.query("SELECT setval(pg_get_serial_sequence('cafeterias', 'id'), (SELECT MAX(id) FROM cafeterias))");
    }

    // ============ START SERVER (Socket + Express) ========= //
    server.listen(PORT, () => {
      console.log(`\n🚀 Server running on port: ${PORT}`);
      console.log(`⚡ WebSocket Enabled`);
      console.log(`📄 Swagger → http://localhost:${PORT}/api-docs\n`);
    });

  } catch (err) {
    console.error("Unable to start server ❌", err);
    process.exit(1);
  }
};

start();
