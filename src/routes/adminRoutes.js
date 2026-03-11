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
  getTrendData, getTopItems, getOrdersOverview, getPeakHours, getCommissionStats // ✅ ADDED THIS
} from "../controllers/adminAnalyticsController.js";
import { getCafeteriaDetails, getMyCafeterias, updateCafeteria } from '../controllers/adminCafeteriaController.js';
import {
  refundOrder,
  checkRefundStatus,
  getRefundHistory,
  checkWebhookStatus
} from '../controllers/adminRefundController.js';
import { deleteAdminAccount } from '../controllers/adminAuth.controller.js';  // ✅ ADD THIS

const router = express.Router();

// ============================================
// DASHBOARD & ORDERS
// ============================================
/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 * Response: { totalOrders, totalRevenue, pendingOrders, ... }
 */
router.get("/stats", auth, requireRole(['admin']), getAdminStats);

/**
 * GET /api/admin/orders
 * Get all orders for admin's cafeteria
 * Query: ?status=PAID&limit=10&offset=0
 */
router.get("/orders", auth, requireRole(['admin']), getAdminOrders);

/**
 * PATCH /api/admin/orders/:id/status
 * Update order status (PAID -> PREPARING -> READY -> COMPLETED)
 * Body: { status: "PREPARING" }
 */
router.patch("/orders/:id/status", auth, requireRole(['admin']), updateOrderStatus);

// ============================================
// CAFETERIA MANAGEMENT
// ============================================
/**
 * GET /api/admin/cafeteria/qr
 * Get QR code for current admin's cafeteria
 * Response: { qrToken, qrUrl, cafeteriaId }
 */
router.get("/cafeteria/qr", auth, requireRole(['admin']), getMyCafeteriaQR);

/**
 * GET /api/admin/cafeteria/:id
 * Get detailed cafeteria information
 * Response: { id, name, location, address, ... }
 */
router.get("/cafeteria/:id", auth, requireRole(['admin']), getCafeteriaDetails);

/**
 * GET /api/admin/cafeterias
 * Get all cafeterias managed by admin
 * Response: [{ id, name, location, ... }]
 */
router.get("/cafeterias", auth, requireRole(['admin']), getMyCafeterias);

// ============================================
// ANALYTICS & INSIGHTS
// ============================================
/**
 * GET /api/admin/trend
 * Get sales trend data over time
 * Query: ?days=7 (7, 30, 90)
 * Response: [{ date, orders, revenue }]
 */
router.get("/trend", auth, requireRole(['admin']), getTrendData);

/**
 * GET /api/admin/top-items
 * Get top selling menu items
 * Query: ?limit=10&days=30
 * Response: [{ itemId, itemName, quantity, revenue }]
 */
router.get("/top-items", auth, requireRole(["admin"]), getTopItems);

/**
 * GET /api/admin/orders-overview
 * Get orders overview (status distribution)
 * Response: { PAID: 5, PREPARING: 3, READY: 2, ... }
 */
router.get("/orders-overview", auth, requireRole(["admin"]), getOrdersOverview);

/**
 * GET /api/admin/peak-hours
 * Get peak hours data for cafeteria
 * Response: [{ hour: "12:00", orders: 25 }]
 */
router.get("/peak-hours", auth, requireRole(["admin"]), getPeakHours);

/**
 * GET /api/admin/commission-stats
 * Get platform commission stats
 * Response: { totalTransactions, totalCommission }
 */
router.get("/commission-stats", auth, requireRole(["admin"]), getCommissionStats);

// ============================================
// PAYMENT & REFUND MANAGEMENT
// ============================================
/**
 * POST /api/admin/orders/:orderId/refund
 * Decline order and initiate refund via Cashfree
 * Admin clicks "Decline" button on order
 * Body: { reason?: "Out of stock" }
 * Response: { success, refundId, message }
 */
router.post(
  "/orders/:orderId/refund",
  auth,
  requireRole(['admin']),
  refundOrder
);

/**
 * GET /api/admin/orders/:orderId/webhook-status
 * Check if Cashfree webhook has arrived
 * Used before initiating refund
 * Response: { webhookReceived: true/false, paymentId, waitedSeconds }
 */
router.get(
  "/orders/:orderId/webhook-status",
  auth,
  requireRole(['admin']),
  checkWebhookStatus
);

/**
 * GET /api/admin/orders/:orderId/refund-status
 * Check current refund status from Cashfree
 * Response: { refundStatus, refundId, refundAmount, ... }
 */
router.get(
  "/orders/:orderId/refund-status",
  auth,
  requireRole(['admin']),
  checkRefundStatus
);

/**
 * GET /api/admin/refunds/history
 * Get refund history for admin's cafeteria
 * Query: ?status=REFUND_SUCCESS (optional)
 * Response: { count, data: [{ orderId, billId, refundId, ... }] }
 */
router.get(
  "/refunds/history",
  auth,
  requireRole(['admin']),
  getRefundHistory
);


router.put("/cafeteria/:id", auth, requireRole(['admin']), updateCafeteria);





// ============================================
// QR CODE VERIFICATION
// ============================================
/**
 * POST /api/admin/orders/verify-qr
 * Admin scans student's QR code to verify order collection
 * Body: { qrToken: "xxx_xxx_xxx" }
 * Response: { success, orderId, status, message }
 */
router.post(
  "/orders/verify-qr",
  auth,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { qrToken } = req.body;
      const cafeteriaId = req.user.cafeteriaId;

      console.log("🔍 [VERIFY QR] Admin verifying QR:", qrToken);
      console.log("🏪 [VERIFY QR] Admin's Cafeteria ID:", cafeteriaId);
      console.log("👤 [VERIFY QR] Admin User ID:", req.user.id);

      // ====================================
      // VALIDATION
      // ====================================
      if (!cafeteriaId) {
        console.error("❌ [VERIFY QR] Admin account not linked to cafeteria");
        return res.status(400).json({
          success: false,
          message: 'Your admin account is not linked to a cafeteria'
        });
      }

      if (!qrToken || typeof qrToken !== 'string') {
        console.error("❌ [VERIFY QR] Invalid QR token format");
        return res.status(400).json({
          success: false,
          message: 'Invalid QR token'
        });
      }

      // ====================================
      // IMPORT MODELS
      // ====================================
      const { CafeteriaQr, Order } = await import('../models/index.js');

      // ====================================
      // CHECK QR EXISTS
      // ====================================
      const qr = await CafeteriaQr.findOne({
        where: { qrToken: qrToken.trim() }
      });

      if (!qr) {
        console.log("❌ [VERIFY QR] Invalid QR token - not found in database");
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code - not found'
        });
      }

      console.log("✅ [VERIFY QR] QR found for cafeteria:", qr.cafeteriaId);

      // ====================================
      // VERIFY QR BELONGS TO ADMIN'S CAFETERIA
      // ====================================
      if (qr.cafeteriaId !== cafeteriaId) {
        console.error(
          `❌ [VERIFY QR] QR belongs to cafeteria ${qr.cafeteriaId}, but admin manages ${cafeteriaId}`
        );
        return res.status(403).json({
          success: false,
          message: 'This QR code belongs to a different cafeteria'
        });
      }

      // ====================================
      // FIND LATEST ORDER FOR COLLECTION
      // ====================================
      const order = await Order.findOne({
        where: {
          cafeteriaId,
          status: { [Op.in]: ['PAID', 'PREPARING', 'READY'] }
        },
        order: [['createdAt', 'DESC']]
      });

      if (!order) {
        console.log(`❌ [VERIFY QR] No active orders for cafeteria ${cafeteriaId}`);
        return res.status(404).json({
          success: false,
          message: 'No active orders to collect at this cafeteria'
        });
      }

      console.log("✅ [VERIFY QR] Order verified");
      console.log(`   Order ID: ${order.id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Amount: ₹${order.totalAmount}`);

      // ====================================
      // RETURN SUCCESS
      // ====================================
      return res.json({
        success: true,
        orderId: order.id,
        dailyOrderNumber: order.dailyOrderNumber,
        billId: order.billId,
        status: order.status,
        totalAmount: order.totalAmount,
        kotNumber: order.kotNumber,
        message: `Order #${order.dailyOrderNumber ?? order.id} verified - Status: ${order.status}`
      });

    } catch (error) {
      console.error('❌ [VERIFY QR] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Verification failed: ' + error.message
      });
    }
  }
);

// ============================================
// ROUTE SUMMARY
// ============================================
/**
 * ADMIN ROUTES SUMMARY
 * 
 * DASHBOARD:
 *   GET  /stats                          - Dashboard statistics
 *   GET  /orders                         - List cafeteria orders
 *   PATCH /orders/:id/status             - Update order status
 * 
 * CAFETERIA:
 *   GET  /cafeteria/qr                   - Get cafeteria QR
 *   GET  /cafeteria/:id                  - Cafeteria details
 *   GET  /cafeterias                     - List admin's cafeterias
 * 
 * ANALYTICS:
 *   GET  /trend                          - Sales trends
 *   GET  /top-items                      - Top menu items
 *   GET  /orders-overview                - Order status distribution
 *   GET  /peak-hours                     - Peak hours analysis
 * 
 * PAYMENTS & REFUNDS:
 *   POST /orders/:orderId/refund         - Initiate refund
 *   GET  /orders/:orderId/webhook-status - Check webhook arrival
 *   GET  /orders/:orderId/refund-status  - Check refund status
 *   GET  /refunds/history                - Refund history
 * 
 * QR VERIFICATION:
 *   POST /orders/verify-qr               - Verify QR for order collection
 * 
 * ACCOUNT MANAGEMENT:
 *   DELETE /delete-account               - Delete admin account (App Store/Play Store required)
 */

// ============================================
// 🗑️ ACCOUNT DELETION (Required by App Store / Play Store)
// ============================================
/**
 * DELETE /api/admin/delete-account
 * Permanently delete admin account
 * Required for App Store and Play Store compliance
 */
router.delete("/delete-account", auth, requireRole(['admin']), deleteAdminAccount);

export default router;