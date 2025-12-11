import { Banner } from "../models/index.js";
import cloudinary from "../config/cloudinary.js";


// ==================== GET ALL BANNERS ====================
export const getBanners = async (req, res) => {
  try {
    const banners = await Banner.findAll();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: "Unable to fetch banners", error: err.message });
  }
};


// ==================== UPLOAD + SAVE BANNER ====================
export const uploadBanner = async (req, res) => {
  try {
    const { name, cafeteriaId } = req.body;

    if (!name) return res.status(400).json({ message: "Banner name required" });
    if (!cafeteriaId) return res.status(400).json({ message: "cafeteriaId required" });
    if (!req.file) return res.status(400).json({ message: "Banner image required" });

    const upload = cloudinary.uploader.upload_stream(
      { folder: "restaurant_banners" },
      async (err, result) => {
        if (err)
          return res.status(500).json({
            message: "Cloudinary Upload Failed",
            error: err.message
          });

        const banner = await Banner.create({
          name,
          cafeteriaId,      // ✅ SAVE cafeteriaId
          imageUrl: result.secure_url
        });

        return res.json({
          success: true,
          message: "Banner uploaded successfully 🎉",
          data: banner
        });
      }
    );

    upload.end(req.file.buffer);
  } catch (err) {
    return res.status(500).json({
      message: "Upload Failed",
      error: err.message
    });
  }
};
