import express from 'express';
import { Op } from 'sequelize';
import { auth, requireRole } from '../middleware/auth.js';
import { 
  getAdminOrders, 
  updateOrderStatus, 
  getMyCafeteriaQR,
  getAdminStats 
} from '../controllers/adminOrderController.js';
import {
  getTrendData
} from "../controllers/adminAnalyticsController.js"; // ✅ correct


const router = express.Router();

// Dashboard stats
router.get("/stats", auth, requireRole(['admin']), getAdminStats);

// Get orders for admin's cafeteria
router.get("/orders", auth, requireRole(['admin']), getAdminOrders);

// Update order status
router.patch("/orders/:id/status", auth, requireRole(['admin']), updateOrderStatus);

// Get cafeteria's static QR
router.get("/cafeteria/qr", auth, requireRole(['admin']), getMyCafeteriaQR);

router.get("/trend", auth, requireRole(['admin']), getTrendData);


// 🔥 NEW: Admin verifies student scanned QR
router.post("/orders/verify-qr", auth, requireRole(['admin']), async (req, res) => {
  try {
    const { qrToken } = req.body;
    const cafeteriaId = req.user.cafeteriaId;

    console.log("🔍 Admin verifying QR:", qrToken);
    console.log("🏪 Admin's Cafeteria ID:", cafeteriaId);
    console.log("👤 Admin User ID:", req.user.id);

    if (!cafeteriaId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Your admin account is not linked to a cafeteria' 
      });
    }

    // Import models dynamically
    const { CafeteriaQr, Order } = await import('../models/index.js');

    // Check if this QR belongs to any cafeteria
    const qr = await CafeteriaQr.findOne({ 
      where: { qrToken: qrToken?.trim() } 
    });

    if (!qr) {
      console.log("❌ Invalid QR token");
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid QR code' 
      });
    }

    console.log("✅ QR found for cafeteria:", qr.cafeteriaId);

    // Verify QR belongs to admin's cafeteria
    if (qr.cafeteriaId !== cafeteriaId) {
      console.log("❌ QR belongs to cafeteria", qr.cafeteriaId, "but admin manages", cafeteriaId);
      return res.status(400).json({ 
        success: false, 
        message: 'This QR code belongs to a different cafeteria' 
      });
    }

    // Find latest order for this cafeteria in collectible states
    const order = await Order.findOne({
      where: {
        cafeteriaId,
        status: { [Op.in]: ['PAID', 'PREPARING', 'READY'] }
      },
      order: [['createdAt', 'DESC']]
    });

    if (!order) {
      console.log("❌ No active orders for cafeteria", cafeteriaId);
      return res.status(404).json({ 
        success: false, 
        message: 'No active orders to collect at this cafeteria' 
      });
    }

    console.log("✅ Order verified - ID:", order.id, "Status:", order.status);

    res.json({ 
      success: true, 
      orderId: order.id,
      status: order.status,
      message: `Order #${order.id} verified - Status: ${order.status}`
    });

  } catch (error) {
    console.error('❌ Admin verify-qr error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Verification failed: ' + error.message 
    });
  }
});

export default router;