import express from "express";
import { createMenuItem } from "../controllers/foodController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Food
 *   description: Food menu upload & management APIs
 */

/**
 * @swagger
 * /api/food/create:
 *   post:
 *     summary: Add menu item with Cloudinary image URL
 *     tags: [Food]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cafeteriaId, name, price, imageUrl]
 *             properties:
 *               cafeteriaId: { type: number, example: 1 }
 *               name: { type: string, example: "Cold Coffee" }
 *               price: { type: number, example: 120 }
 *               imageUrl: 
 *                 type: string
 *                 example: "https://res.cloudinary.com/xxxx/menu/coffee.jpg"
 *     responses:
 *       200: 
 *         description: Menu Item Created Successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               item:
 *                 id: 1
 *                 name: "Cold Coffee"
 *                 price: 120
 *                 imageUrl: "https://cloudinary.com/image.jpg"
 *       500:
 *         description: Server Error
 */
//uday
router.post("/create", createMenuItem);  // save food + imageUrl

export default router;
