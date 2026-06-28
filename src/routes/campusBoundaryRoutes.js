import express from "express";
import { getCampusBoundary } from "../controllers/campusBoundaryController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: CampusBoundary
 *   description: APIs for campus geofencing boundary
 */

/**
 * @swagger
 * /api/campus-boundary:
 *   get:
 *     summary: Get ordered list of campus boundary points
 *     tags: [CampusBoundary]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: List of boundary points returned }
 */
router.get("/", auth, getCampusBoundary);

export default router;
