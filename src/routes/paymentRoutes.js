import express from "express";
import { 
  confirmPayment, 
  syncFromWebhook, 
  getPaymentByOrderId,
  updatePaymentIdFromWebhook 
} from "../controllers/paymentController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ✅ User confirms payment after Cashfree SDK
router.post("/confirm", auth, confirmPayment);

// ✅ Webhook syncs real paymentId from Cashfree
router.post("/sync-from-webhook", syncFromWebhook);

// ✅ Get payment details by Cashfree order ID
router.get("/order/:orderId", auth, getPaymentByOrderId);

// ✅ Legacy webhook update
router.post("/update-from-webhook", updatePaymentIdFromWebhook);

export default router;