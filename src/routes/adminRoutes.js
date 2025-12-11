import express from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { getCafeteriaOrders, updateOrderStatus, verifyOrderPickup } from '../controllers/adminController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Cafeteria staff/admin management
 */

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Get all orders for a cafeteria (Staff/Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: List returned }
 */
router.get(
  '/orders',
  auth,
  requireRole(['staff', 'admin']),
  getCafeteriaOrders
);

/**
 * @swagger
 * /api/admin/orders/{id}/status:
 *   patch:
 *     summary: Update order status (PREPARING / READY / COMPLETED / CANCELLED)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         example: 4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "READY"
 *     responses:
 *       200: { description: Status updated }
 */
router.patch(
  '/orders/:id/status',
  auth,
  requireRole(['staff', 'admin']),
  updateOrderStatus
);

/**
 * @swagger
 * /api/admin/cafeterias/{cafeteriaId}/verify-order:
 *   post:
 *     summary: Verify order pickup after student scans QR
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: cafeteriaId
 *         in: path
 *         required: true
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               billId: { type: string, example: "BILL-7A99C230" }
 *     responses:
 *       200: { description: Order pickup verified }
 */
router.post(
  '/cafeterias/:cafeteriaId/verify-order',
  auth,
  verifyOrderPickup
);

export default router;
