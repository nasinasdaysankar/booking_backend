import express from "express";
const router = express.Router();

import { auth } from "../middleware/auth.js";

import {
  createOrder,
  getMyOrders,
  getOrderById,
} from "../controllers/orderController.js";

import {
  scanStaticCafeteriaQR,
  confirmOrderPickup,
} from "../controllers/userOrderController.js";

import { getActiveOrders } from "../controllers/orderStatusController.js";

// ================= USER ORDER ROUTES =================

// ✅ Active orders
router.get("/active", auth, getActiveOrders);

// ✅ QR routes MUST be before :id
router.post("/scan-qr", auth, scanStaticCafeteriaQR);
router.post("/confirm-pickup", auth, confirmOrderPickup);

// Place order
router.post("/", auth, createOrder);

// Get my orders
router.get("/", auth, getMyOrders);

// ❗ KEEP THIS LAST
router.get("/:id", auth, getOrderById);

export default router;
