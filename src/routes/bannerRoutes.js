import express from "express";
import multer from "multer";
import { uploadBanner, getBanners, deleteBanner, updateBanner } from "../controllers/bannerController.js";
import { superadminAuth, auth, requireRole, eitherAdminAuth } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/banners/upload:
 *   post:
 *     summary: Upload new banner with image
 *     tags: [Banners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 */
router.post("/upload", eitherAdminAuth, upload.single("image"), uploadBanner);

/**
 * @swagger
 * /api/banners/{id}:
 *   put:
 *     summary: Update an existing banner (replace image/name)
 *     tags: [Banners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               cafeteriaId:
 *                 type: integer
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Banner updated
 */
router.put("/:id", eitherAdminAuth, upload.single("image"), updateBanner);

/**
 * @swagger
 * /api/banners/{id}:
 *   delete:
 *     summary: Delete a banner
 *     tags: [Banners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Banner deleted
 */
router.delete("/:id", eitherAdminAuth, deleteBanner);

router.get("/", getBanners);

export default router;
