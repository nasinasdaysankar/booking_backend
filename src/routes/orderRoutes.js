import express from 'express';
import { auth } from '../middleware/auth.js';
import { createOrder, getMyOrders, getOrderById } from '../controllers/orderController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Student order operations
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Place a food order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cafeteriaId, items]
 *             properties:
 *               cafeteriaId: { type: number, example: 2 }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     menuItemId: { type: number, example: 5 }
 *                     quantity:   { type: number, example: 2 }
 *     responses:
 *       201: { description: Order placed successfully }
 */
router.post('/', auth, createOrder);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get logged-in student's past orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Orders returned }
 */
router.get('/', auth, getMyOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID (only own order)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         example: 3
 *     responses:
 *       200: { description: Order details returned }
 */
router.get('/:id', auth, getOrderById);

export default router;
