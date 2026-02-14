import { Banner } from "../models/index.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../config/aws_s3.js";
import slugify from "slugify";
import { bannerCacheGet, bannerCacheSet, CACHE_KEYS, clearBannerCache } from "../utils/cache.js";

// ==================== GET ALL BANNERS (REDIS CACHED) ====================
export const getBanners = async (req, res) => {
  try {
    const cacheKey = CACHE_KEYS.BANNERS_ALL;

    // ✅ CHECK REDIS CACHE
    const cached = await bannerCacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, data: cached });
    }

    const banners = await Banner.findAll();

    // ✅ SAVE TO REDIS
    await bannerCacheSet(cacheKey, banners);

    res.json({ success: true, cached: false, data: banners });
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

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
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
