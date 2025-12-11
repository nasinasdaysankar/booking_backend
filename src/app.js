import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import cafeteriaRoutes from './routes/cafeteriaRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import menuRoutes from "./routes/menuRoutes.js";


// 🔥 SWAGGER IMPORT
import { swaggerUiServe, swaggerUiSetup } from "./swagger.js";

const app = express();

app.use(cors());
app.use(express.json());

// 📌 SWAGGER UI ROUTE
app.use("/api-docs", swaggerUiServe, swaggerUiSetup);

app.get('/', (req, res) => {
  res.json({ message: 'Cafeteria API running. Visit /api-docs for docs.' });
});

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/cafeterias', cafeteriaRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/menu", menuRoutes);

export default app;
