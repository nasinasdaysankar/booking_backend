import express from "express";
import { 
  scanStaticCafeteriaQR, 
  confirmOrderPickup 
} from "../controllers/userOrderController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// // 🔍 Route for scanning the cafeteria QR code
router.post("/orders/scan-qr", auth, scanStaticCafeteriaQR);

// // ✅ Route for confirming the order has been picked up
router.post("/orders/confirm-pickup", auth, confirmOrderPickup);

export default router;