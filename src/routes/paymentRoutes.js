import express from "express";
import {
  confirmPayment,
  syncFromWebhook,
  getPaymentByOrderId,
  verifyPaymentStatus,
  createCashfreeOrder
} from "../controllers/paymentController.js";
import { auth, verifyWebhookKey } from "../middleware/auth.js";

const router = express.Router();

// ✅ Create Cashfree order (via Finance Backend proxy)
router.post("/create", auth, createCashfreeOrder);

// ✅ User confirms payment after Cashfree SDK
router.post("/confirm", auth, confirmPayment);

// ✅ Verify actual Cashfree payment status (before confirming order)
router.post("/verify-status", auth, verifyPaymentStatus);

// ✅ Webhook syncs real paymentId from Cashfree (Protected)
router.post("/sync-from-webhook", verifyWebhookKey, syncFromWebhook);

// ✅ Get payment details by Cashfree order ID
router.get("/order/:orderId", auth, getPaymentByOrderId);

export default router;