import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { 
  getAdminOrders, 
  updateOrderStatus, 
  getMyCafeteriaQR,
  getAdminStats
} from "../controllers/adminOrderController.js";

const router = express.Router();

// Fetch orders for the cafeteria
router.get(
  "/orders", 
  auth, 
  requireRole(['staff', 'admin']), 
  getAdminOrders
);

// Update status (PAID -> PREPARING -> READY)
router.patch(
  "/orders/:id/status", 
  auth, 
  requireRole(['staff', 'admin']), 
  updateOrderStatus
);

// Display the Static QR code for scanning
router.get(
  "/cafeteria/qr", 
  auth, 
  requireRole(['staff', 'admin']), 
  getMyCafeteriaQR
);

router.get("/stats", auth, requireRole(['admin']), getAdminStats);


export default router;