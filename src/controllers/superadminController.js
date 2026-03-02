import { Cafeteria } from "../models/index.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import { clearCafeteriaCache } from "../utils/cache.js";
import slugify from "slugify";

/**
 * 🚀 UPLOAD CAFETERIA MEDIA (S3)
 * Handles both images and videos
 */
export const uploadCafeteriaMedia = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'video' or 'image'

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file provided" });
        }

        if (!type || (type !== 'video' && type !== 'image')) {
            return res.status(400).json({ success: false, message: "Invalid type. Must be 'video' or 'image'" });
        }

        const cafeteria = await Cafeteria.findByPk(id);
        if (!cafeteria) {
            return res.status(404).json({ success: false, message: "Cafeteria not found" });
        }

        const s3 = getS3Client();
        const bucket = getS3Bucket();

        // 1. DELETE OLD FILE FROM S3 (if it was an S3 file)
        const oldUrl = type === 'video' ? cafeteria.promoVideoUrl : cafeteria.promoImageUrl;
        if (oldUrl && oldUrl.includes(".amazonaws.com/")) {
            try {
                const urlParts = oldUrl.split(".amazonaws.com/");
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
                console.error(`Failed to delete old ${type} from S3:`, s3DelErr.message);
            }
        }

        // 2. UPLOAD NEW FILE
        const safeName = slugify(cafeteria.name, { lower: true });
        const ext = req.file.originalname.split('.').pop();
        const folder = type === 'video' ? 'videos/cafeterias' : 'images/cafeterias';
        const newS3Key = `${folder}/${safeName}-${type}-${Date.now()}.${ext}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: newS3Key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            })
        );

        const url = `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${newS3Key}`;

        // 3. UPDATE DB
        if (type === 'video') {
            cafeteria.promoVideoUrl = url;
        } else {
            cafeteria.promoImageUrl = url;
        }
        await cafeteria.save();

        // 4. CLEAR CACHE
        await clearCafeteriaCache();

        return res.json({
            success: true,
            message: `${type === 'video' ? 'Video' : 'Image'} uploaded successfully ✨`,
            url
        });

    } catch (err) {
        console.error("uploadCafeteriaMedia error:", err);
        return res.status(500).json({
            success: false,
            message: "Upload failed",
            error: err.message
        });
    }
};

/**
 * 🗑️ DELETE CAFETERIA MEDIA (S3)
 */
export const deleteCafeteriaMedia = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'video' or 'image'

        if (!type || (type !== 'video' && type !== 'image')) {
            return res.status(400).json({ success: false, message: "Invalid type. Must be 'video' or 'image'" });
        }

        const cafeteria = await Cafeteria.findByPk(id);
        if (!cafeteria) {
            return res.status(404).json({ success: false, message: "Cafeteria not found" });
        }

        const s3 = getS3Client();
        const bucket = getS3Bucket();

        // 1. DELETE FROM S3
        const mediaUrl = type === 'video' ? cafeteria.promoVideoUrl : cafeteria.promoImageUrl;
        if (mediaUrl && mediaUrl.includes(".amazonaws.com/")) {
            try {
                const urlParts = mediaUrl.split(".amazonaws.com/");
                if (urlParts.length > 1) {
                    const s3Key = urlParts[1];
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: bucket,
                            Key: s3Key,
                        })
                    );
                }
            } catch (s3DelErr) {
                console.error(`Failed to delete ${type} from S3:`, s3DelErr.message);
            }
        }

        // 2. UPDATE DB
        if (type === 'video') {
            cafeteria.promoVideoUrl = null;
        } else {
            cafeteria.promoImageUrl = null;
        }
        await cafeteria.save();

        // 3. CLEAR CACHE
        await clearCafeteriaCache();

        return res.json({
            success: true,
            message: `${type === 'video' ? 'Video' : 'Image'} deleted successfully ✨`
        });

    } catch (err) {
        console.error("deleteCafeteriaMedia error:", err);
        return res.status(500).json({
            success: false,
            message: "Deletion failed",
            error: err.message
        });
    }
};
