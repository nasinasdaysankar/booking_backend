import { PromotionalPoster } from "../models/index.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import slugify from "slugify";
import { posterCacheGet, posterCacheSet, CACHE_KEYS, clearPosterCache } from "../utils/cache.js";

// ==================== GET ALL POSTERS (Admin Only) ====================
export const getAllPosters = async (req, res) => {
  try {
    const cacheKey = CACHE_KEYS.POSTERS_ALL;
    const cached = await posterCacheGet(cacheKey);
    if (cached) return res.json(cached);

    const posters = await PromotionalPoster.findAll({
      order: [["created_at", "DESC"]],
    });

    await posterCacheSet(cacheKey, posters);
    res.json(posters);
  } catch (err) {
    res.status(500).json({ message: "Unable to fetch posters", error: err.message });
  }
};

// ==================== GET ACTIVE POSTERS (Public) ====================
export const getActivePosters = async (req, res) => {
  try {
    const cacheKey = CACHE_KEYS.POSTERS_ACTIVE;
    const cached = await posterCacheGet(cacheKey);
    if (cached) return res.json(cached);

    const posters = await PromotionalPoster.findAll({
      where: { isActive: true },
      order: [["updated_at", "DESC"]],
    });

    await posterCacheSet(cacheKey, posters);
    res.json(posters);
  } catch (err) {
    res.status(500).json({ message: "Unable to fetch active posters", error: err.message });
  }
};

// ==================== UPLOAD POSTER ====================
export const uploadPoster = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Poster name required" });
    if (!req.file) return res.status(400).json({ message: "Poster image required" });

    const safeName = slugify(name, { lower: true });
    const ext = req.file.mimetype === "image/png" ? "png" : "jpg";
    const s3Key = `images/posters/${safeName}-${Date.now()}.${ext}`;

    const s3 = getS3Client();
    const bucket = getS3Bucket();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    const poster = await PromotionalPoster.create({
      name,
      imageUrl,
      isActive: true,
    });

    await clearPosterCache();

    return res.json({
      success: true,
      message: "Poster uploaded successfully 🎉",
      data: poster,
    });
  } catch (err) {
    return res.status(500).json({ message: "Poster upload failed", error: err.message });
  }
};

// ==================== DELETE POSTER ====================
export const deletePoster = async (req, res) => {
  try {
    const { id } = req.params;
    const poster = await PromotionalPoster.findByPk(id);
    if (!poster) return res.status(404).json({ message: "Poster not found" });

    // Delete from S3
    try {
      const s3 = getS3Client();
      const bucket = getS3Bucket();
      const urlParts = poster.imageUrl.split(".amazonaws.com/");
      if (urlParts.length > 1) {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: urlParts[1] }));
      }
    } catch (s3Err) {
      console.error("Failed to delete poster from S3:", s3Err.message);
    }

    await poster.destroy();
    await clearPosterCache();

    return res.json({ success: true, message: "Poster deleted successfully 🗑️" });
  } catch (err) {
    return res.status(500).json({ message: "Poster deletion failed", error: err.message });
  }
};

// ==================== TOGGLE POSTER STATUS ====================
export const togglePosterStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const poster = await PromotionalPoster.findByPk(id);
    if (!poster) return res.status(404).json({ message: "Poster not found" });

    poster.isActive = !poster.isActive;
    await poster.save();
    await clearPosterCache();

    return res.json({
      success: true,
      message: `Poster is now ${poster.isActive ? "active" : "inactive"}`,
      data: poster,
    });
  } catch (err) {
    return res.status(500).json({ message: "Toggle failed", error: err.message });
  }
};
