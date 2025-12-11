import express from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Image Upload
 *   description: Cloudinary image upload APIs
 */

/**
 * @swagger
 * /api/upload/upload-image:
 *   post:
 *     summary: Upload a single image to Cloudinary
 *     tags: [Image Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Choose one image file
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             example:
 *               imageUrl: "https://res.cloudinary.com/yourcloud/image.png"
 *       500:
 *         description: Upload failed
 */


/**
 * @swagger
 * /api/upload/upload-multiple:
 *   post:
 *     summary: Upload multiple images to Cloudinary
 *     tags: [Image Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Select multiple files
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               count: 3
 *               images:
 *                 - "https://res.cloudinary.com/.../img1.png"
 *                 - "https://res.cloudinary.com/.../img2.png"
 *                 - "https://res.cloudinary.com/.../img3.png"
 *       500:
 *         description: Upload failed
 */


// Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "restaurant_images",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

const upload = multer({ storage });

/** ===========================
 *  📍 SINGLE IMAGE UPLOAD
 *  /api/upload/upload-image
 * ===========================*/
router.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    res.json({ imageUrl: req.file.path });
  } catch (err) {
    res.status(500).json({ message: "Upload failed" });
  }
});


/** ===========================
 *  📍 MULTIPLE IMAGE UPLOAD
 *  /api/upload/upload-multiple
 * ===========================*/
router.post("/upload-multiple", upload.array("images", 10), async (req, res) => {
  try {
    const uploadedImages = req.files.map(file => file.path);

    res.json({
      success: true,
      count: uploadedImages.length,
      images: uploadedImages,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Bulk Upload failed", error: err.message });
  }
});

export default router;
