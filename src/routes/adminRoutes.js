import express from 'express';
import { Op } from 'sequelize';
import { auth, requireRole } from '../middleware/auth.js';
import {
  getAdminOrders,
  updateOrderStatus,

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