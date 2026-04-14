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

/**
 * 📈 GET ADVANCED ANALYTICS (SUPERADMIN)
 */
export const getAdvancedAnalytics = async (req, res) => {
    try {
        const { period = "weekly", cafeteriaId } = req.query; // 'daily', 'weekly', 'monthly', 'yearly'
        
        // Define date filter
        let dateFilter = '';
        if (period === 'daily') {
            dateFilter = `AND "created_at" >= CURRENT_DATE`;
        } else if (period === 'weekly') {
            dateFilter = `AND "created_at" >= CURRENT_DATE - INTERVAL '7 days'`;
        } else if (period === 'monthly') {
            dateFilter = `AND "created_at" >= CURRENT_DATE - INTERVAL '30 days'`;
        } else if (period === 'yearly') {
            dateFilter = `AND "created_at" >= CURRENT_DATE - INTERVAL '365 days'`;
        }
        
        let cafeteriaFilter = '';
        if (cafeteriaId) {
            cafeteriaFilter = `AND "cafeteriaid" = ${parseInt(cafeteriaId)}`;
        }

        const metrics = {};
        
        // Helper to apply table alias to filters
        const applyFilters = (filters, alias) => {
            let res = filters;
            if (alias) {
                res = res.replace(/"created_at"/g, `${alias}."created_at"`)
                         .replace(/"cafeteriaid"/g, `${alias}."cafeteriaid"`)
                         .replace(/"paymentstatus"/g, `${alias}."paymentstatus"`);
            }
            return res;
        };

        // 1. DAU: Daily Active Users
        const dauQuery = await Cafeteria.sequelize.query(`
            SELECT COUNT(DISTINCT ua."userid") as dau
            FROM user_activities ua
            WHERE ua."activitytype" = 'APP_OPEN'
            AND ua."created_at" >= CURRENT_DATE
            ${cafeteriaId ? `AND EXISTS (
                SELECT 1 FROM orders o
                WHERE o."studentid" = ua."userid"
                AND o."cafeteriaid" = ${parseInt(cafeteriaId)}
            )` : ''}
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.dau = parseInt(dauQuery[0]?.dau || 0);

        // 2. MAU: Monthly Active Users
        const mauQuery = await Cafeteria.sequelize.query(`
            SELECT COUNT(DISTINCT ua."userid") as mau
            FROM user_activities ua
            WHERE ua."activitytype" = 'APP_OPEN'
            AND ua."created_at" >= CURRENT_DATE - INTERVAL '30 days'
            ${cafeteriaId ? `AND EXISTS (
                SELECT 1 FROM orders o
                WHERE o."studentid" = ua."userid"
                AND o."cafeteriaid" = ${parseInt(cafeteriaId)}
            )` : ''}
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.mau = parseInt(mauQuery[0]?.mau || 0);

        // 3. User Session Duration (average in seconds for the selected period)
        const sessionQuery = await Cafeteria.sequelize.query(`
            SELECT AVG("durationseconds") as avg_duration
            FROM user_activities ua
            WHERE ua."activitytype" = 'SESSION_END'
            AND ua."durationseconds" IS NOT NULL
            ${applyFilters(dateFilter, 'ua')}
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.avgSessionDuration = parseFloat(sessionQuery[0]?.avg_duration || 0).toFixed(2);

        // 4. Conversion Rate (App Opens vs Successful Orders)
        const appOpensQuery = await Cafeteria.sequelize.query(`
            SELECT COUNT(id) as opens
            FROM user_activities ua
            WHERE ua."activitytype" = 'APP_OPEN'
            ${applyFilters(dateFilter, 'ua')}
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        const appOpens = parseInt(appOpensQuery[0]?.opens || 0);

        const ordersCountQuery = await Cafeteria.sequelize.query(`
            SELECT COUNT(id) as orders
            FROM orders o
            WHERE o."paymentstatus" = 'SUCCESS'
            ${applyFilters(dateFilter, 'o')}
            ${applyFilters(cafeteriaFilter, 'o')}
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        const successfulOrders = parseInt(ordersCountQuery[0]?.orders || 0);

        metrics.conversionRate = appOpens > 0 ? ((successfulOrders / appOpens) * 100).toFixed(2) : 0;

        // 5. Peak Order Time (Hours with most orders)
        const peakTimeQuery = await Cafeteria.sequelize.query(`
            SELECT 
                EXTRACT(HOUR FROM COALESCE(o."created_at" AT TIME ZONE 'Asia/Kolkata', o."created_at"))::INT as hour,
                COUNT(id) as order_count
            FROM orders o
            WHERE o."paymentstatus" = 'SUCCESS'
            ${applyFilters(dateFilter, 'o')}
            ${applyFilters(cafeteriaFilter, 'o')}
            GROUP BY hour
            ORDER BY order_count DESC
            LIMIT 5
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.peakOrderTimes = peakTimeQuery;

        // 6. Orders Per Cafeteria (Performance)
        if (!cafeteriaId) {
            const performanceQuery = await Cafeteria.sequelize.query(`
                SELECT 
                    c.name as cafeteria_name,
                    c.promo_image_url as cafeteria_logo,
                    COUNT(o.id) as order_count,
                    COALESCE(SUM(o."totalamount" - COALESCE(o."platform_fee",0) - COALESCE(o."commission_amount",0)), 0) as revenue
                FROM orders o
                JOIN cafeterias c ON o."cafeteriaid" = c.id
                WHERE o."paymentstatus" = 'SUCCESS'
                ${applyFilters(dateFilter, 'o')}
                GROUP BY c.name, c.promo_image_url
                ORDER BY revenue DESC
            `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
            metrics.cafeteriaPerformance = performanceQuery;
        }

        // 7. Payment Success vs Failed (Using orders table as proxy if no separate payment logs)
        const paymentsQuery = await Cafeteria.sequelize.query(`
            SELECT 
                "paymentstatus",
                COUNT(id) as count
            FROM orders o
            WHERE 1=1
            ${applyFilters(dateFilter, 'o')}
            ${applyFilters(cafeteriaFilter, 'o')}
            GROUP BY o."paymentstatus"
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.paymentStatus = paymentsQuery;

        // 8. Returning vs New Users
        // Users who made their first order in this period (New) vs those who made an order before (Returning)
        const usersQuery = await Cafeteria.sequelize.query(`
            WITH user_first_order AS (
                SELECT "studentid", MIN("created_at") as first_order_date
                FROM orders
                WHERE "paymentstatus" = 'SUCCESS'
                GROUP BY "studentid"
            )
            SELECT 
                COUNT(DISTINCT CASE WHEN ufo.first_order_date >= (CURRENT_DATE - INTERVAL '30 days') THEN o."studentid" END) as new_users,
                COUNT(DISTINCT CASE WHEN ufo.first_order_date < (CURRENT_DATE - INTERVAL '30 days') THEN o."studentid" END) as returning_users
            FROM orders o
            JOIN user_first_order ufo ON o."studentid" = ufo."studentid"
            WHERE o."paymentstatus" = 'SUCCESS'
            ${applyFilters(dateFilter, 'o')}
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.userRetention = usersQuery[0] || { new_users: 0, returning_users: 0 };
        
        // 9. Top Ordered Items
        const topItemsQuery = await Cafeteria.sequelize.query(`
            SELECT 
                oi.name,
                SUM(oi.quantity::INT) as total_qty,
                COUNT(DISTINCT o.id) as order_count
            FROM order_items oi
            JOIN orders o ON oi.orderid = o.id
            WHERE o.paymentstatus = 'SUCCESS'
            ${applyFilters(dateFilter, 'o')}
            ${applyFilters(cafeteriaFilter, 'o')}
            GROUP BY oi.name
            ORDER BY total_qty DESC
            LIMIT 10
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.topSellingItems = topItemsQuery;

        // 10. Daily Trends (Orders and Net Revenue)
        const dailyTrendQuery = await Cafeteria.sequelize.query(`
            SELECT 
                DATE(COALESCE(o."created_at" AT TIME ZONE 'Asia/Kolkata', o."created_at")) as date,
                COUNT(o.id) as order_count,
                COALESCE(SUM(o."totalamount" - COALESCE(o."platform_fee",0) - COALESCE(o."commission_amount",0)), 0) as total_revenue
            FROM orders o
            WHERE o."paymentstatus" = 'SUCCESS'
            ${applyFilters(dateFilter, 'o')}
            ${applyFilters(cafeteriaFilter, 'o')}
            GROUP BY date
            ORDER BY date ASC
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.dailyTrend = dailyTrendQuery;

        const userFilter = cafeteriaId ? `AND EXISTS (
            SELECT 1 FROM orders o2
            WHERE o2."studentid" = ua."userid"
            AND o2."cafeteriaid" = ${parseInt(cafeteriaId)}
        )` : '';

        // 11. Top Active Users (by Session Duration)
        const topUsersQuery = await Cafeteria.sequelize.query(`
            SELECT 
                u.name,
                u.email,
                SUM(ua."durationseconds") as total_session_time,
                COUNT(ua.id) as sessions
            FROM user_activities ua
            JOIN users u ON ua."userid" = u.id
            WHERE ua."activitytype" = 'SESSION_END'
            ${applyFilters(dateFilter, 'ua')}
            ${userFilter}
            GROUP BY u.id, u.name, u.email
            ORDER BY total_session_time DESC
            LIMIT 10
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.topActiveUsers = topUsersQuery;

        // 11.5 Individual Sessions (Recent specific durations)
        const sessionDetailsQuery = await Cafeteria.sequelize.query(`
            SELECT 
                ua.id,
                u.name as user_name,
                ua."durationseconds" as duration,
                ua."created_at" as timestamp,
                ua.metadata->>'platform' as platform
            FROM user_activities ua
            JOIN users u ON ua."userid" = u.id
            WHERE ua."activitytype" = 'SESSION_END'
            AND ua."durationseconds" IS NOT NULL
            ${applyFilters(dateFilter, 'ua')}
            ${userFilter}
            ORDER BY ua."created_at" DESC
            LIMIT 20
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.individualSessions = sessionDetailsQuery;

        // 12. Avg Order Value + Parcel vs Dine-in split + Avg Prep Time
        const orderMetaQuery = await Cafeteria.sequelize.query(`
            SELECT
                ROUND(AVG(o."totalamount" - COALESCE(o."platform_fee",0) - COALESCE(o."commission_amount",0))::numeric, 2) as avg_order_value,
                COUNT(CASE WHEN o."isparcel" = true THEN 1 END) as parcel_count,
                COUNT(CASE WHEN o."isparcel" = false OR o."isparcel" IS NULL THEN 1 END) as dinein_count,
                COUNT(CASE WHEN o.status IN ('CANCELLED','EXPIRED') THEN 1 END) as cancelled_count,
                COUNT(o.id) as total_count,
                ROUND(AVG(EXTRACT(EPOCH FROM (o."picked_up_at" - o."created_at"))/60)::numeric, 1) as avg_prep_time
            FROM orders o
            WHERE 1=1
            AND o."paymentstatus" = 'SUCCESS'
            ${applyFilters(dateFilter, 'o')}
            ${applyFilters(cafeteriaFilter, 'o')}
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.orderMeta = orderMetaQuery[0] || {};

        // 13. Recent Engagement Activities
        const recentActivitiesQuery = await Cafeteria.sequelize.query(`
            SELECT 
                ua.id,
                ua."activitytype" AS "activityType",
                ua."durationseconds" AS "durationSeconds",
                ua.metadata,
                ua."created_at" AS "createdAt",
                u.name as user_name,
                u.email as user_email
            FROM user_activities ua
            LEFT JOIN users u ON ua."userid" = u.id
            WHERE 1=1
            ${applyFilters(dateFilter, 'ua')}
            ${userFilter}
            ORDER BY ua."created_at" DESC
            LIMIT 50
        `, { type: Cafeteria.sequelize.QueryTypes.SELECT });
        metrics.recentActivities = recentActivitiesQuery;

        return res.json({
            success: true,
            data: metrics
        });
    } catch (err) {
        console.error("Advanced analytics error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch advanced analytics",
            error: err.message
        });
    }
};

/**
 * 📍 GET PENDING RADIUS REQUESTS
 */
export const getAllRadiusRequests = async (req, res) => {
    try {
        const requests = await Cafeteria.findAll({
            where: { radiusRequestStatus: "pending" },
            attributes: ["id", "name", "visibilityRadius", "requestedVisibilityRadius", "radiusRequestStatus", "ownerId"]
        });
        return res.json({ success: true, data: requests });
    } catch (err) {
        console.error("Fetch radius requests error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch radius requests" });
    }
};

/**
 * ✅ APPROVE RADIUS REQUEST
 */
export const approveRadiusRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const cafeteria = await Cafeteria.findByPk(id);
        
        if (!cafeteria || cafeteria.radiusRequestStatus !== "pending") {
            return res.status(404).json({ success: false, message: "No pending radius request found" });
        }

        cafeteria.visibilityRadius = cafeteria.requestedVisibilityRadius;
        cafeteria.requestedVisibilityRadius = null;
        cafeteria.radiusRequestStatus = "approved";
        cafeteria.radiusRequestFeedback = null;
        await cafeteria.save();

        await clearCafeteriaCache();

        // Send push notification to Admin
        import("../utils/notificationUtils.js").then(async ({ sendNotification }) => {
            const { AdminFcmToken } = await import("../models/index.js");
            const adminTokens = await AdminFcmToken.findAll({ where: { adminId: cafeteria.ownerId } });
            if (adminTokens.length > 0) {
                for (const tokenRecord of adminTokens) {
                    await sendNotification({
                        token: tokenRecord.fcmToken,
                        notification: {
                            title: "Radius Request Approved ✅",
                            body: `Your request for ${cafeteria.visibilityRadius}km radius for ${cafeteria.name} has been approved.`
                        }
                    }, cafeteria.ownerId, true);
                }
            }
        });

        return res.json({ success: true, message: "Radius request approved", data: cafeteria });
    } catch (err) {
        console.error("Approve radius request error:", err);
        return res.status(500).json({ success: false, message: "Failed to approve request" });
    }
};

/**
 * ❌ REJECT RADIUS REQUEST
 */
export const rejectRadiusRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { feedback } = req.body;
        
        const cafeteria = await Cafeteria.findByPk(id);
        
        if (!cafeteria || cafeteria.radiusRequestStatus !== "pending") {
            return res.status(404).json({ success: false, message: "No pending radius request found" });
        }

        cafeteria.radiusRequestStatus = "rejected";
        cafeteria.radiusRequestFeedback = feedback || "Not approved";
        await cafeteria.save();

        await clearCafeteriaCache();

        // Send push notification to Admin
        import("../utils/notificationUtils.js").then(async ({ sendNotification }) => {
            const { AdminFcmToken } = await import("../models/index.js");
            const adminTokens = await AdminFcmToken.findAll({ where: { adminId: cafeteria.ownerId } });
            if (adminTokens.length > 0) {
                for (const tokenRecord of adminTokens) {
                    await sendNotification({
                        token: tokenRecord.fcmToken,
                        notification: {
                            title: "Radius Request Rejected ❌",
                            body: `Your radius request for ${cafeteria.name} was rejected. Feedback: ${feedback || "None"}.`
                        }
                    }, cafeteria.ownerId, true);
                }
            }
        });

        return res.json({ success: true, message: "Radius request rejected", data: cafeteria });
    } catch (err) {
        console.error("Reject radius request error:", err);
        return res.status(500).json({ success: false, message: "Failed to reject request" });
    }
};
