import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes.js";
import cafeteriaRoutes from "./routes/cafeteriaRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminOrdersRoutes from "./routes/adminOrders.js";
import adminAuthRoutes from "./routes/adminAuth.routes.js";
import userRoutes from "./routes/userRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import userNotificationRoutes from "./routes/userNotificationRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js"; // ✅ ADDED






import "./models/index.js";

// Swagger
import { swaggerUiServe, swaggerUiSetup } from "./swagger.js";

const app = express();

// ============================================
// 🔥 TRUST PROXY - Required for Railway/Heroku
// ============================================
app.set('trust proxy', 1);

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ============================================
// 🔥 RATE LIMITING - Protect against abuse
// ============================================
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 1000,            // ✅ Increased to 1000 requests per IP per minute
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,             // ✅ Increased to 100 payment requests per minute per IP
  message: { success: false, message: "Payment rate limit exceeded. Please wait." },
});

// Apply general rate limit to all API routes
app.use("/api/", generalLimiter);

// Apply stricter limit to payment routes
app.use("/api/payments", paymentLimiter);

// ================= SWAGGER =================
app.use("/api-docs", swaggerUiServe, swaggerUiSetup);

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({
    message: "Cafeteria API running. Visit /api-docs for docs.",
  });
});

// ================= PUBLIC ROUTES =================
// 🔓 PUBLIC AUTH (LOGIN / REGISTER)
app.use("/api/auth", authRoutes);

// ================= USER ROUTES =================
app.use("/api/user", userRoutes);

// ================= CAFETERIA =================
app.use("/api/cafeterias", cafeteriaRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

// ================= ADMIN ROUTES =================
// 🔐 ADMIN AUTH (ADMIN LOGIN ONLY)
app.use("/api/auth/admin", adminAuthRoutes);

// 🔐 ADMIN FEATURES
app.use("/api/admin", adminRoutes);
// app.use("/api/admin", adminOrdersRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/notify", notificationRoutes);
app.use("/api/user/notify", userNotificationRoutes);
app.use("/api/cafeterias", cafeteriaRoutes); // ✅ ADD THIS LINE


console.log("🔔 Notification routes mounted");

app.use("/api/upload", uploadRoutes); // ✅ MOUNTED HERE BEFORE 404




// ================= FALLBACK =================
app.use((req, res) => {
  res.status(404).json({ message: "API route not found" });
});

export default app;



