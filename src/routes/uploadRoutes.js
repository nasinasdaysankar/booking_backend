import express from "express";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, S3_BUCKET } from "../config/aws_s3.js";
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
      return res.status(400).json({ success: false, message: "Image file required" });
    }

    // Get S3 client - this will initialize if not already done
    const s3 = getS3Client();

    const safeName = slugify(req.file.originalname.split(".")[0], {
      lower: true,
    });

    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
    const s3Key = `images/uploads/${safeName}-${Date.now()}.${ext}`;

    console.log(`📤 Uploading to S3: ${s3Key}`);

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const imageUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    console.log(`✅ Upload successful: ${imageUrl}`);

    res.json({ 
      success: true,
      imageUrl 
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({
      success: false,
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
      return res.status(400).json({ success: false, message: "Images required" });
    }

    // Get S3 client - this will initialize if not already done
    const s3 = getS3Client();

    const uploadedImages = [];

    for (const file of req.files) {
      const safeName = slugify(file.originalname.split(".")[0], {
        lower: true,
      });
      const ext = file.mimetype === "image/png" ? "png" : "jpg";
      const s3Key = `images/uploads/${safeName}-${Date.now()}.${ext}`;

      console.log(`📤 Uploading: ${s3Key}`);

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      const imageUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      uploadedImages.push(imageUrl);

      console.log(`✅ Uploaded: ${imageUrl}`);
    }

    res.json({
      success: true,
      count: uploadedImages.length,
      images: uploadedImages,
    });
  } catch (err) {
    console.error("❌ Bulk upload error:", err);
    res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: err.message,
    });
  }
});

export default router;