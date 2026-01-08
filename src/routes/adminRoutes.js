// import express from 'express';
// import { Op } from 'sequelize';
// import { auth, requireRole } from '../middleware/auth.js';
// import { 
//   getAdminOrders, 
//   updateOrderStatus, 
//   getMyCafeteriaQR,
//   getAdminStats 
// } from '../controllers/adminOrderController.js';
// import {
//   getTrendData, getTopItems, getOrdersOverview, getPeakHours
// } from "../controllers/adminAnalyticsController.js";
// import { getCafeteriaDetails} from '../controllers/adminCafeteriaController.js';
// import { getMyCafeterias } from '../controllers/adminCafeteriaController.js';
// import {
//   refundOrder,
//   checkRefundStatus,
//   getRefundHistory
// } from '../controllers/adminRefundController.js';

// const router = express.Router();

// // ============================================
// // DASHBOARD & ORDERS
// // ============================================
// router.get("/stats", auth, requireRole(['admin']), getAdminStats);

// router.get("/orders", auth, requireRole(['admin']), getAdminOrders);

// router.patch("/orders/:id/status", auth, requireRole(['admin']), updateOrderStatus);

// // ============================================
// // CAFETERIA
// // ============================================
// router.get("/cafeteria/qr", auth, requireRole(['admin']), getMyCafeteriaQR);

// router.get("/cafeteria/:id", auth, requireRole(['admin']), getCafeteriaDetails);

// router.get("/cafeterias", auth, requireRole(['admin']), getMyCafeterias);

// // ============================================
// // ANALYTICS
// // ============================================
// router.get("/trend", auth, requireRole(['admin']), getTrendData);

// router.get("/top-items", auth, requireRole(["admin"]), getTopItems);

// router.get("/orders-overview", auth, requireRole(["admin"]), getOrdersOverview);

// router.get("/peak-hours", auth, requireRole(["admin"]), getPeakHours);

// // ============================================
// // REFUND ENDPOINTS ✅ NEW
// // ============================================

// /**
//  * POST /api/admin/orders/:orderId/refund
//  * Decline order and initiate refund
//  * Admin clicks "Decline" button
//  */
// router.post(
//   "/orders/:orderId/refund",
//   auth,
//   requireRole(['admin']),
//   refundOrder
// );

// /**
//  * GET /api/admin/orders/:orderId/refund-status
//  * Check current refund status from Cashfree
//  */
// router.get(
//   "/orders/:orderId/refund-status",
//   auth,
//   requireRole(['admin']),
//   checkRefundStatus
// );

// /**
//  * GET /api/admin/refunds/history
//  * Get all refunds for admin's cafeteria
//  * Query: ?status=REFUND_SUCCESS (optional)
//  */
// router.get(
//   "/refunds/history",
//   auth,
//   requireRole(['admin']),
//   getRefundHistory
// );

// // ============================================
// // QR VERIFICATION
// // ============================================

// /**
//  * POST /api/admin/orders/verify-qr
//  * Admin verifies student scanned QR code
//  */
// router.post("/orders/verify-qr", auth, requireRole(['admin']), async (req, res) => {
//   try {
//     const { qrToken } = req.body;
//     const cafeteriaId = req.user.cafeteriaId;

//     console.log("🔍 Admin verifying QR:", qrToken);
//     console.log("🏪 Admin's Cafeteria ID:", cafeteriaId);
//     console.log("👤 Admin User ID:", req.user.id);

//     if (!cafeteriaId) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Your admin account is not linked to a cafeteria' 
//       });
//     }

//     // Import models dynamically
//     const { CafeteriaQr, Order } = await import('../models/index.js');

//     // Check if this QR belongs to any cafeteria
//     const qr = await CafeteriaQr.findOne({ 
//       where: { qrToken: qrToken?.trim() } 
//     });

//     if (!qr) {
//       console.log("❌ Invalid QR token");
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Invalid QR code' 
//       });
//     }

//     console.log("✅ QR found for cafeteria:", qr.cafeteriaId);

//     // Verify QR belongs to admin's cafeteria
//     if (qr.cafeteriaId !== cafeteriaId) {
//       console.log("❌ QR belongs to cafeteria", qr.cafeteriaId, "but admin manages", cafeteriaId);
//       return res.status(400).json({ 
//         success: false, 
//         message: 'This QR code belongs to a different cafeteria' 
//       });
//     }

//     // Find latest order for this cafeteria in collectible states
//     const order = await Order.findOne({
//       where: {
//         cafeteriaId,
//         status: { [Op.in]: ['PAID', 'PREPARING', 'READY'] }
//       },
//       order: [['createdAt', 'DESC']]
//     });

//     if (!order) {
//       console.log("❌ No active orders for cafeteria", cafeteriaId);
//       return res.status(404).json({ 
//         success: false, 
//         message: 'No active orders to collect at this cafeteria' 
//       });
//     }

//     console.log("✅ Order verified - ID:", order.id, "Status:", order.status);

//     res.json({ 
//       success: true, 
//       orderId: order.id,
//       status: order.status,
//       message: `Order #${order.id} verified - Status: ${order.status}`
//     });

//   } catch (error) {
//     console.error('❌ Admin verify-qr error:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Verification failed: ' + error.message 
//     });
//   }
// });

// export default router;

import express from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { 
  getAdminOrders, 
  updateOrderStatus, 
  getMyCafeteriaQR,
  getAdminStats 
} from '../controllers/adminOrderController.js';
import {
  getTrendData, 
  getTopItems, 
  getOrdersOverview, 
  getPeakHours
} from "../controllers/adminAnalyticsController.js";
import { 
  getCafeteriaDetails,
  getMyCafeterias 
} from '../controllers/adminCafeteriaController.js';
import {
  refundOrder,
  checkRefundStatus,
  getRefundHistory
} from '../controllers/adminRefundController.js';

const router = express.Router();

// ============================================
// DASHBOARD & ORDERS
// ============================================
router.get("/stats", auth, requireRole(['admin']), getAdminStats);

router.get("/orders", auth, requireRole(['admin']), getAdminOrders);

router.patch("/orders/:id/status", auth, requireRole(['admin']), updateOrderStatus);

// ============================================
// CAFETERIA
// ============================================
router.get("/cafeteria/qr", auth, requireRole(['admin']), getMyCafeteriaQR);

router.get("/cafeteria/:id", auth, requireRole(['admin']), getCafeteriaDetails);

router.get("/cafeterias", auth, requireRole(['admin']), getMyCafeterias);

// ============================================
// ANALYTICS
// ============================================
router.get("/trend", auth, requireRole(['admin']), getTrendData);

router.get("/top-items", auth, requireRole(['admin']), getTopItems);

router.get("/orders-overview", auth, requireRole(['admin']), getOrdersOverview);

router.get("/peak-hours", auth, requireRole(['admin']), getPeakHours);

// ============================================
// ✅ REFUND ENDPOINTS
// ============================================

/**
 * POST /api/admin/orders/:orderId/refund
 * Decline order and initiate refund
 * Body: {} (empty)
 */
router.post(
  "/orders/:orderId/refund",
  auth,
  requireRole(['admin']),
  refundOrder
);

/**
 * GET /api/admin/orders/:orderId/refund-status
 * Check current refund status from Cashfree
 */
router.get(
  "/orders/:orderId/refund-status",
  auth,
  requireRole(['admin']),
  checkRefundStatus
);

/**
 * GET /api/admin/refunds/history
 * Get all refunds for admin's cafeteria
 * Query: ?cafeteriaId=1&status=REFUND_SUCCESS (optional)
 */
router.get(
  "/refunds/history",
  auth,
  requireRole(['admin']),
  getRefundHistory
);

// ============================================
// QR VERIFICATION
// ============================================
router.post("/orders/verify-qr", auth, requireRole(['admin']), async (req, res) => {
  try {
    const { qrToken } = req.body;
    const cafeteriaId = req.user.cafeteriaId;

    console.log("🔍 Admin verifying QR:", qrToken);
    console.log("🏪 Admin's Cafeteria ID:", cafeteriaId);

    if (!cafeteriaId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Your admin account is not linked to a cafeteria' 
      });
    }

    const { CafeteriaQr, Order } = await import('../models/index.js');
    const { Op } = await import('sequelize');

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

    if (qr.cafeteriaId !== cafeteriaId) {
      console.log("❌ QR belongs to cafeteria", qr.cafeteriaId, "but admin manages", cafeteriaId);
      return res.status(400).json({ 
        success: false, 
        message: 'This QR code belongs to a different cafeteria' 
      });
    }

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