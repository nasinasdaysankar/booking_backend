import express from "express";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import slugify from "slugify";
import axios from "axios";

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
      return res.status(400).json({ 
        success: false, 
        message: "Image file required" 
      });
    }

    console.log(`📤 Starting upload for: ${req.file.originalname}`);

    // Get S3 client (initializes on first call)
    let s3;
    try {
      s3 = getS3Client();
    } catch (err) {
      console.error("❌ S3 initialization failed:", err.message);
      return res.status(500).json({
        success: false,
        message: "S3 not configured. Contact administrator.",
        error: err.message,
      });
    }

    const bucket = getS3Bucket();
    if (!bucket) {
      return res.status(500).json({
        success: false,
        message: "S3 bucket not configured",
      });
    }

    const safeName = slugify(req.file.originalname.split(".")[0], {
      lower: true,
    });

    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
    const s3Key = `images/uploads/${safeName}-${Date.now()}.${ext}`;

    console.log(`📊 S3 Details:
      - Bucket: ${bucket}
      - Region: ${process.env.AWS_REGION}
      - Key: ${s3Key}
      - Size: ${req.file.size} bytes
    `);

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    console.log(`✅ Upload successful: ${imageUrl}`);

    res.json({
      success: true,
      imageUrl,
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
      return res.status(400).json({ 
        success: false, 
        message: "Images required" 
      });
    }

    console.log(`📤 Starting bulk upload for ${req.files.length} images`);

    // Get S3 client (initializes on first call)
    let s3;
    try {
      s3 = getS3Client();
    } catch (err) {
      console.error("❌ S3 initialization failed:", err.message);
      return res.status(500).json({
        success: false,
        message: "S3 not configured",
        error: err.message,
      });
    }

    const bucket = getS3Bucket();
    if (!bucket) {
      return res.status(500).json({
        success: false,
        message: "S3 bucket not configured",
      });
    }

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
          Bucket: bucket,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      uploadedImages.push(imageUrl);

      console.log(`✅ Uploaded: ${imageUrl}`);
    }

    console.log(`✅ Bulk upload complete: ${uploadedImages.length} images`);

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

/** ===========================
 *  📍 HEADER MEDIA UPLOAD (S3)
 *  /api/upload/upload-header-media
 * ===========================*/
router.post("/upload-header-media", upload.single("media"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Media file required" });
    }

    const s3 = getS3Client();
    const bucket = getS3Bucket();

    // Preserve original extension
    const originalName = req.file.originalname;
    const ext = originalName.substring(originalName.lastIndexOf("."));
    const safeName = slugify(originalName.split(".")[0], { lower: true });
    const s3Key = `header/media/${safeName}-${Date.now()}${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const mediaUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    
    // Detect media type: image, video, or lottie
    let mediaType = "image";
    if (req.file.mimetype.startsWith("video")) mediaType = "video";
    else if (req.file.mimetype === "application/json" || req.file.originalname.endsWith(".json")) mediaType = "lottie";

    res.json({
      success: true,
      mediaUrl,
      mediaType
    });
  } catch (err) {
    console.error("❌ Header media upload error:", err);
    res.status(500).json({ success: false, message: "Upload failed", error: err.message });
  }
});

/** ===========================
 *  📍 IMAGE PROXY (FOR CORS)
 *  /api/upload/proxy-image?url=...
 * ===========================*/
router.get("/proxy-image", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL is required");

    // Fetch the image as a buffer
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // Set headers to allow the browser to read the pixels (CORS)
    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.send(response.data);
  } catch (error) {
    console.error("❌ Proxy error:", error);
    res.status(500).send("Failed to proxy image");
  }
});

export default router;