import express from "express";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../config/aws_s3.js";
import slugify from "slugify";

const router = express.Router();

// Multer memory storage (required for S3)
const upload = multer({ storage: multer.memoryStorage() });

/** ===========================
 *  📍 SINGLE IMAGE UPLOAD (S3)
 *  /api/upload/upload-image
 * ===========================*/
router.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image file required" });
    }

    const safeName = slugify(req.file.originalname.split(".")[0], {
      lower: true,
    });

    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
    const s3Key = `images/uploads/${safeName}-${Date.now()}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({
      message: "Upload failed",
      error: err.message,
    });
  }
});

/** ===========================
 *  📍 MULTIPLE IMAGE UPLOAD (S3)
 *  /api/upload/upload-multiple
 * ===========================*/
router.post("/upload-multiple", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Images required" });
    }

    const uploadedImages = [];

    for (const file of req.files) {
      const safeName = slugify(file.originalname.split(".")[0], {
        lower: true,
      });
      const ext = file.mimetype === "image/png" ? "png" : "jpg";
      const s3Key = `images/uploads/${safeName}-${Date.now()}.${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      uploadedImages.push(
        `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
      );
    }

    res.json({
      success: true,
      count: uploadedImages.length,
      images: uploadedImages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: err.message,
    });
  }
});

export default router;
