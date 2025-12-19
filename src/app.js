import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes.js';
import cafeteriaRoutes from './routes/cafeteriaRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import paymentRoutes from "./routes/paymentRoutes.js";
import adminOrdersRoutes from "./routes/adminOrders.js";
import adminAuthRoutes from "./routes/adminAuth.routes.js";
import userRoutes from "./routes/userRoutes.js";
import "./models/index.js";



// Swagger
import { swaggerUiServe, swaggerUiSetup } from "./swagger.js";

const app = express();

app.use(cors());
app.use(express.json());

// Swagger UI
app.use("/api-docs", swaggerUiServe, swaggerUiSetup);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Cafeteria API running. Visit /api-docs for docs.' });
});

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/cafeterias', cafeteriaRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/menu', menuRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminOrdersRoutes);
app.use("/api/auth/admin", adminAuthRoutes);
app.use("/api/user", userRoutes); // 🔥 REQUIRED
app.use("/api/admin", adminOrdersRoutes); // or whatever your admin router is


export default app;
