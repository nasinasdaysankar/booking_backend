import { Banner } from "../models/index.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import slugify from "slugify";
import { bannerCacheGet, bannerCacheSet, CACHE_KEYS, clearBannerCache } from "../utils/cache.js";

// ==================== GET ALL BANNERS (REDIS CACHED) ====================
export const getBanners = async (req, res) => {
  try {
    const cacheKey = CACHE_KEYS.BANNERS_ALL;

    // ✅ CHECK REDIS CACHE
    const cached = await bannerCacheGet(cacheKey);
    if (cached) {
      return res.json(cached);  // Return raw array (Flutter expects List<dynamic>)
    }

    const banners = await Banner.findAll();

    // ✅ SAVE TO REDIS
    await bannerCacheSet(cacheKey, banners);

    res.json(banners);  // Return raw array (same format as before Redis)
  } catch (err) {
    res.status(500).json({
      message: "Unable to fetch banners",
      error: err.message,
    });
  }
};

// ==================== UPLOAD + SAVE BANNER (S3) ====================
export const uploadBanner = async (req, res) => {
  try {
    const { name, cafeteriaId } = req.body;

    if (!name) return res.status(400).json({ message: "Banner name required" });
    if (!cafeteriaId)
      return res.status(400).json({ message: "cafeteriaId required" });
    if (!req.file)
      return res.status(400).json({ message: "Banner image required" });

    const safeName = slugify(name, { lower: true });
    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";

    const s3Key = `images/banners/${safeName}.${ext}`;

    const s3 = getS3Client();
    const bucket = getS3Bucket();

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    const banner = await Banner.create({
      name,
      cafeteriaId,
      imageUrl,
    });

    // 🗑️ INVALIDATE BANNER CACHE
    await clearBannerCache();

    return res.json({
      success: true,
      message: "Banner uploaded successfully 🎉",
      data: banner,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Banner upload failed",
      error: err.message,
    });
  }
};

// ==================== DELETE BANNER ====================
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findByPk(id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    // 🗑️ DELETE FROM S3
    try {
      const s3 = getS3Client();
      const bucket = getS3Bucket();

      // Extract S3 key from URL: https://bucket.s3.region.amazonaws.com/images/banners/name.jpg
      const urlParts = banner.imageUrl.split(".amazonaws.com/");
      if (urlParts.length > 1) {
        const s3Key = urlParts[1];
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: s3Key,
          })
        );
      }
    } catch (s3Err) {
      console.error("Failed to delete banner from S3:", s3Err.message);
      // Continue with DB deletion even if S3 delete fails
    }

    // 🗑️ DELETE FROM DB
    await banner.destroy();

    // 🗑️ INVALIDATE BANNER CACHE
    await clearBannerCache();

    return res.json({
      success: true,
      message: "Banner deleted successfully 🗑️",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Banner deletion failed",
      error: err.message,
    });
  }
};

// ==================== UPDATE / REPLACE BANNER ====================
export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cafeteriaId } = req.body;

    const banner = await Banner.findByPk(id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    // Update basic fields if provided
    if (name) banner.name = name;
    if (cafeteriaId) banner.cafeteriaId = cafeteriaId;

    // Handle Image Replacement if a new file is uploaded
    if (req.file) {
      // 1. DELETE OLD IMAGE FROM S3
      try {
        const s3 = getS3Client();
        const bucket = getS3Bucket();

        const urlParts = banner.imageUrl.split(".amazonaws.com/");
        if (urlParts.length > 1) {
          const oldS3Key = urlParts[1];
          await s3.send(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: oldS3Key,
            })
          );
        }
      } catch (s3DelErr) {
        console.error("Failed to delete old banner from S3 during replacement:", s3DelErr.message);
      }

      // 2. UPLOAD NEW IMAGE
      const safeName = slugify(name || banner.name, { lower: true });
      const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
      const newS3Key = `images/banners/${safeName}-${Date.now()}.${ext}`;

      const s3 = getS3Client();
      const bucket = getS3Bucket();

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: newS3Key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      banner.imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${newS3Key}`;
    }

    await banner.save();

    // 🗑️ INVALIDATE BANNER CACHE
    await clearBannerCache();

    return res.json({
      success: true,
      message: "Banner updated successfully 🔄",
      data: banner,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Banner update failed",
      error: err.message,
    });
  }
};
