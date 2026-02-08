// ===================================================================
// FILE: routes/upiRoutes.js
// Auto Collect + UPI Intent Routes
// ===================================================================

import express from "express";
import {
    createUpiPayment,
    handleAutoCollectWebhook,
    verifyPaymentStatus,
    simulatePaymentSuccess,
} from "../controllers/upiController.js";
import { auth } from "../middleware/authenticate.js";

const router = express.Router();

// ✅ Create UPI payment (returns VPA for UPI Intent)
// POST /api/upi/create-payment
// Body: { cafeteriaId, amount, items, isParcel?, parcelAmount? }
router.post("/create-payment", auth, createUpiPayment);

// ✅ Auto Collect Webhook (no auth - Cashfree calls this)
// POST /api/upi/webhook
router.post("/webhook", handleAutoCollectWebhook);

// ✅ Verify payment status (for polling)
// GET /api/upi/verify/:orderId
router.get("/verify/:orderId", auth, verifyPaymentStatus);

// 🧪 Simulate payment success (for testing only)
// POST /api/upi/simulate-success
// Body: { orderId }
router.post("/simulate-success", auth, simulatePaymentSuccess);

export default router;
