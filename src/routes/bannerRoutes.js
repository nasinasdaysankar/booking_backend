import express from "express";
import multer from "multer";
import { uploadBanner, getBanners } from "../controllers/bannerController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/banners/upload:
 *   post:
 *     summary: Upload new banner with image
 *     tags: [Banners]
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
router.post("/upload", upload.single("image"), uploadBanner);
router.get("/", getBanners);

export default router;
