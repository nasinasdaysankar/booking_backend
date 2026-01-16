import express from "express";
const router = express.Router();

import { auth } from "../middleware/auth.js";

import {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrderByBillId, // ✅ ADDED
} from "../controllers/orderController.js";

import {
  scanStaticCafeteriaQR,
  confirmOrderPickup,
  submitOrderFeedback,
  checkFeedbackStatus,  // ✅ ADD THIS IMPORT
} from "../controllers/userOrderController.js";

import { getActiveOrders } from "../controllers/orderStatusController.js";

// ================= USER ORDER ROUTES =================

// 🔥 ACTIVE ORDER MUST COME BEFORE :id
router.get("/active", auth, getActiveOrders);

// 🔥 GET ORDER BY BILL ID (MUST BE ABOVE :id)
router.get("/by-bill/:billId", auth, getOrderByBillId);

// Place order
router.post("/", auth, createOrder);

// Get my orders
router.get("/", auth, getMyOrders);

// QR flow
router.post("/scan-qr", auth, scanStaticCafeteriaQR);
router.post("/confirm-pickup", auth, confirmOrderPickup);

// Feedback routes
router.post("/feedback", auth, submitOrderFeedback);
router.get("/:orderId/feedback-status", auth, checkFeedbackStatus);  // ✅ ADD THIS ROUTE

// Get order by ID (KEEP THIS LAST - catches all remaining /:id patterns)
router.get("/:id", auth, getOrderById);

export default router;