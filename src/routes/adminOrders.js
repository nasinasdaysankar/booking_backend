import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { 
  getAdminOrders, 
  updateOrderStatus,
  getAdminStats,
  createManualOrder,
  getAdminFeedback
} from "../controllers/adminOrderController.js";
import { assignPartner } from "../controllers/deliveryWorkflowController.js";
import { DeliveryPartner } from "../models/index.js";

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

// ✅ ASSIGN DELIVERY PARTNER TO AN ORDER
router.post(
  "/orders/assign",
  auth,
  requireRole(['staff', 'admin']),
  assignPartner
);

// ✅ GET DELIVERY PARTNERS FOR ASSIGNMENT DIALOG
router.get(
  "/delivery-partners",
  auth,
  requireRole(['staff', 'admin']),
  async (req, res) => {
    try {
      const partners = await DeliveryPartner.findAll({
        where: { cafeteriaId: req.user.cafeteriaId, isActive: true },
        attributes: ['id', 'partnerId', 'name', 'phone', 'isOnline', 'averageRating'],
      });
      res.json(partners);
    } catch (err) {
      console.error("GET PARTNERS ERROR:", err);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  }
);

router.get("/stats", auth, requireRole(['admin']), getAdminStats);
router.get("/feedback", auth, requireRole(['staff', 'admin']), getAdminFeedback);

export default router;
