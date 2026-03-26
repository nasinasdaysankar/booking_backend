import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { 
  getAdminOrders, 
  updateOrderStatus,
  getAdminStats,
  createManualOrder
} from "../controllers/adminOrderController.js";

const router = express.Router();

// Place manual (cash) order
router.post(
  "/create-manual",
  auth,
  requireRole(['staff', 'admin']),
  createManualOrder
);

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

router.get("/stats", auth, requireRole(['admin']), getAdminStats);

export default router;
