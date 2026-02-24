import express from 'express';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../config/db.js';
import { Order, Cafeteria, MenuItem, User, Admin, Payment, AuditLog, SystemSetting, SystemAlert, OrderItem, UserFcmToken, AppFeedback } from '../models/index.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import admin from "../config/firebaseAdmin.js";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import { replaceMenuImage } from "../controllers/menuController.js";
import { clearCafeteriaCache } from "../utils/cache.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage for S3

// ============================================
// SUPERADMIN AUTHENTICATION MIDDLEWARE
// ============================================
export const superadminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Check for superadmin token (starts with 'superadmin_')
    if (authHeader && authHeader.startsWith('Bearer superadmin_')) {
        req.isSuperAdmin = true;
        next();
    } else {
        res.status(401).json({ success: false, message: 'Superadmin access required' });
    }
};

// ============================================
// GET ALL CAFETERIAS (SUPERADMIN)
// ============================================
router.get('/cafeterias', superadminAuth, async (req, res) => {
    try {
        const cafeterias = await Cafeteria.findAll({
            order: [['id', 'ASC']]
        });

        res.json({
            success: true,
            data: cafeterias
        });
    } catch (error) {
        console.error('Superadmin cafeterias error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch cafeterias' });
    }
});

// ============================================
// CREATE CAFETERIA (SUPERADMIN)
// ============================================
router.post('/cafeterias', superadminAuth, async (req, res) => {
    try {
        const { name, latitude, longitude, isOpen, isUserVisible, ownerId } = req.body;

        if (!name || !latitude || !longitude || !ownerId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const staticQrToken = crypto.randomBytes(32).toString('hex');

        const cafeteria = await Cafeteria.create({
            name,
            latitude,
            longitude,
            isOpen: isOpen !== undefined ? isOpen : true,
            isUserVisible: isUserVisible !== undefined ? isUserVisible : false,
            staticQrToken,
            ownerId
        });

        // ✅ Clear cafeteria cache so mobile app sees new restaurant immediately
        await clearCafeteriaCache();

        res.status(201).json({
            success: true,
            data: cafeteria
        });
    } catch (error) {
        console.error('Superadmin create cafeteria error:', error);
        res.status(500).json({ success: false, message: 'Failed to create cafeteria' });
    }
});

// ============================================
// UPDATE CAFETERIA (SUPERADMIN)
// ============================================
router.put('/cafeteria/:id', superadminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isOpen, isUserVisible } = req.body;

        const cafeteria = await Cafeteria.findByPk(id);
        if (!cafeteria) {
            return res.status(404).json({ success: false, message: 'Cafeteria not found' });
        }

        await cafeteria.update({
            ...(name !== undefined && { name }),
            ...(isOpen !== undefined && { isOpen }),
            ...(isUserVisible !== undefined && { isUserVisible }),
        });

        // ✅ Clear cafeteria cache so mobile app sees updates immediately
        await clearCafeteriaCache();

        res.json({
            success: true,
            data: cafeteria
        });
    } catch (error) {
        console.error('Superadmin update cafeteria error:', error);
        res.status(500).json({ success: false, message: 'Failed to update cafeteria' });
    }
});

// ============================================
// GET SUPERADMIN DASHBOARD STATS
// ============================================
router.get('/stats', superadminAuth, async (req, res) => {
    try {
        const { cafeteriaId, period } = req.query;

        // Get today's date at midnight (IST)
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Calculate period start date
        let periodStart = null;
        if (period === 'daily') {
            periodStart = startOfDay;
        } else if (period === 'weekly') {
            periodStart = new Date(now);
            periodStart.setDate(periodStart.getDate() - 7);
        } else if (period === 'monthly') {
            periodStart = new Date(now);
            periodStart.setMonth(periodStart.getMonth() - 1);
        } else if (period === 'yearly') {
            periodStart = new Date(now);
            periodStart.setFullYear(periodStart.getFullYear() - 1);
        }

        // Base where clause
        const baseWhere = {
            paymentStatus: 'SUCCESS'
        };

        // Add cafeteria filter if provided
        if (cafeteriaId) {
            baseWhere.cafeteriaId = parseInt(cafeteriaId);
        }

        // Add period filter if provided
        if (periodStart) {
            baseWhere.createdAt = { [Op.gte]: periodStart };
        }

        // Total orders (filtered by period)
        const totalOrders = await Order.count({
            where: baseWhere
        });

        // Total revenue (filtered by period)
        const revenueResult = await Order.sum('totalAmount', {
            where: {
                ...baseWhere,
                status: { [Op.in]: ['PAID', 'PREPARING', 'READY', 'PICKED_UP'] }
            }
        });
        const totalRevenue = revenueResult || 0;

        // Pending orders (PAID or PREPARING status — always real-time, not period-filtered)
        const pendingWhere = { paymentStatus: 'SUCCESS', status: { [Op.in]: ['PAID', 'PREPARING'] } };
        if (cafeteriaId) pendingWhere.cafeteriaId = parseInt(cafeteriaId);
        const pendingOrders = await Order.count({ where: pendingWhere });

        // Today's orders
        const todayWhere = { paymentStatus: 'SUCCESS', createdAt: { [Op.gte]: startOfDay } };
        if (cafeteriaId) todayWhere.cafeteriaId = parseInt(cafeteriaId);
        const todayOrders = await Order.count({ where: todayWhere });

        // Today's revenue
        const todayRevenueResult = await Order.sum('totalAmount', {
            where: {
                ...todayWhere,
                status: { [Op.in]: ['PAID', 'PREPARING', 'READY', 'PICKED_UP'] }
            }
        });
        const todayRevenue = todayRevenueResult || 0;

        // Total customers (global - don't filter by cafeteria)
        const totalCustomers = await User.count();

        // Active cafeterias
        const cafeteriaWhere = { isOpen: true };
        if (cafeteriaId) {
            cafeteriaWhere.id = parseInt(cafeteriaId);
        }
        const activeCafeterias = await Cafeteria.count({
            where: cafeteriaWhere
        });

        res.json({
            success: true,
            totalOrders,
            totalRevenue,
            pendingOrders,
            todayOrders,
            todayRevenue,
            totalCustomers,
            activeCafeterias
        });
    } catch (error) {
        console.error('Superadmin stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});

// ============================================
// GET ALL ORDERS (SUPERADMIN)
// ============================================
router.get('/orders', superadminAuth, async (req, res) => {
    try {
        const { status, cafeteriaId, limit = 100, offset = 0, days } = req.query;

        const where = {
            paymentStatus: 'SUCCESS'
        };

        if (status) {
            where.status = status;
        }

        if (cafeteriaId) {
            where.cafeteriaId = cafeteriaId;
        }

        // Build date filter for SQL
        let dateFilter = '';
        if (days) {
            dateFilter = `AND orders."created_at" >= NOW() - INTERVAL '${parseInt(days)} days'`;
        }

        const orders = await sequelize.query(
            `
            SELECT 
                orders.id,
                orders."cashfreeorderid" AS "cashfreeOrderId",
                orders."billid" AS "billId",
                orders."studentid" AS "studentId",
                orders."cafeteriaid" AS "cafeteriaId",
                orders."totalamount" AS "totalAmount",
                orders.status,
                orders."paymentstatus" AS "paymentStatus",
                orders."etaminutes" AS "etaMinutes",
                orders."kotnumber" AS "kotNumber",
                orders."israted" AS "isRated",
                orders."isparcel" AS "isParcel",
                orders."parcelamount" AS "parcelAmount",
                orders."created_at" AS "createdAt",
                orders."updated_at" AS "updatedAt",
                orders."created_at" AT TIME ZONE 'UTC' AS "createdAtUtc",
                cafeterias.name AS "cafeteriaName"
            FROM orders
            LEFT JOIN cafeterias ON orders."cafeteriaid" = cafeterias.id
            WHERE orders."paymentstatus" = 'SUCCESS'
            ${status ? `AND orders.status = :status` : ''}
            ${cafeteriaId ? `AND orders."cafeteriaid" = :cafeteriaId` : ''}
            ${dateFilter}
            ORDER BY orders."created_at" DESC
            LIMIT :limit OFFSET :offset
            `,
            {
                replacements: {
                    status: status || null,
                    cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                },
                type: QueryTypes.SELECT
            }
        );

        // Get order items for each order
        if (orders.length > 0) {
            const orderIds = orders.map(o => o.id);
            const allItems = await sequelize.query(
                `SELECT 
                    id,
                    "orderid" AS "orderId",
                    "name",
                    "imageurl" AS "imageUrl",
                    "quantity",
                    "priceatorder" AS "priceAtOrder",
                    "isparcel" AS "isParcel"
                FROM order_items WHERE "orderid" IN (:ids)`,
                {
                    replacements: { ids: orderIds },
                    type: QueryTypes.SELECT
                }
            );

            // Combine orders with items
            const combinedData = orders.map(order => ({
                ...order,
                items: allItems
                    .filter(item => item.orderId === order.id)
                    .map(item => ({
                        id: item.id,
                        itemName: item.name || item.itemName,
                        quantity: item.quantity,
                        unitPrice: item.priceAtOrder || item.unitPrice,
                        totalPrice: item.quantity * (item.priceAtOrder || item.unitPrice),
                        isParcel: item.isParcel
                    }))
            }));

            return res.json({
                success: true,
                count: combinedData.length,
                data: combinedData
            });
        }

        res.json({
            success: true,
            count: 0,
            data: []
        });
    } catch (error) {
        console.error('Superadmin orders error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    }
});

// ============================================
// GET MENU ITEMS (SUPERADMIN) - ALL CAFETERIAS
// ============================================
router.get('/menu', superadminAuth, async (req, res) => {
    try {
        const { cafeteriaId, category, isAvailable } = req.query;

        const where = {
            isDeleted: false
        };

        if (cafeteriaId) {
            where.cafeteriaId = parseInt(cafeteriaId);
        }

        if (category) {
            where.category = category;
        }

        if (isAvailable !== undefined) {
            where.isAvailable = isAvailable === 'true';
        }

        const items = await MenuItem.findAll({
            where,
            order: [['cafeteriaId', 'ASC'], ['name', 'ASC']]
        });

        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        console.error('Superadmin menu error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch menu' });
    }
});

// ============================================
// CREATE MENU ITEM (SUPERADMIN)
// ============================================
router.post('/menu', superadminAuth, async (req, res) => {
    try {
        const { cafeteriaId, name, price, estPrepTimeMinutes, category, isAvailable, isParcelAvailable, isTodaySpecial, description, imageUrl } = req.body;

        if (!cafeteriaId || !name || !price) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const menuItem = await MenuItem.create({
            cafeteriaId,
            name,
            price,
            estPrepTimeMinutes: estPrepTimeMinutes || 15,
            category,
            isAvailable: isAvailable !== undefined ? isAvailable : true,
            isParcelAvailable: isParcelAvailable !== undefined ? isParcelAvailable : true,
            isTodaySpecial: isTodaySpecial || false,
            imageUrl
        });

        res.status(201).json({ success: true, data: menuItem });
    } catch (error) {
        console.error('Superadmin create menu item error:', error);
        res.status(500).json({ success: false, message: 'Failed to create menu item' });
    }
});

// ============================================
// REPLACE MENU ITEM IMAGE (SUPERADMIN)
// ============================================
router.put('/menu/replace-image/:id', superadminAuth, upload.single('image'), replaceMenuImage);

// ============================================
// UPDATE MENU ITEM (SUPERADMIN)
// ============================================
router.put('/menu/:id', superadminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const menuItem = await MenuItem.findByPk(id);
        if (!menuItem) {
            return res.status(404).json({ success: false, message: 'Menu item not found' });
        }

        await menuItem.update(updates);

        res.json({ success: true, data: menuItem });
    } catch (error) {
        console.error('Superadmin update menu item error:', error);
        res.status(500).json({ success: false, message: 'Failed to update menu item' });
    }
});

// ============================================
// DELETE MENU ITEM (SUPERADMIN)
// ============================================
router.delete('/menu/:id', superadminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const menuItem = await MenuItem.findByPk(id);

        if (!menuItem) {
            return res.status(404).json({ success: false, message: 'Menu item not found' });
        }

        // Soft delete
        await menuItem.update({ isDeleted: true });

        res.json({ success: true, message: 'Menu item deleted successfully' });
    } catch (error) {
        console.error('Superadmin delete menu item error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete menu item' });
    }
});

// ============================================
// GET TREND DATA (SUPERADMIN)
// ============================================
router.get('/trend', superadminAuth, async (req, res) => {
    try {
        const { days = 7, cafeteriaId } = req.query;

        const trendData = await sequelize.query(
            `
            SELECT 
                DATE("created_at") as date,
                COUNT(*) as orders,
                COALESCE(SUM("totalamount"), 0) as revenue
            FROM orders
            WHERE "paymentstatus" = 'SUCCESS'
            AND "created_at" >= NOW() - INTERVAL '${parseInt(days)} days'
            ${cafeteriaId ? `AND "cafeteriaid" = :cafeteriaId` : ''}
            GROUP BY DATE("created_at")
            ORDER BY date ASC
            `,
            {
                replacements: {
                    cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null
                },
                type: QueryTypes.SELECT
            }
        );

        res.json({
            success: true,
            data: trendData
        });
    } catch (error) {
        console.error('Superadmin trend error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trend' });
    }
});

// ============================================
// GET TOP SELLING ITEMS (SUPERADMIN)
// ============================================
router.get('/top-items', superadminAuth, async (req, res) => {
    try {
        const { limit = 10, days = 30, cafeteriaId } = req.query;

        const topItems = await sequelize.query(
            `
            SELECT 
                oi."name" as "itemName",
                SUM(oi.quantity) as quantity,
                SUM(oi.quantity * oi."priceatorder") as revenue
            FROM order_items oi
            JOIN orders o ON oi."orderid" = o.id
            WHERE o."paymentstatus" = 'SUCCESS'
            AND o."created_at" >= NOW() - INTERVAL '${parseInt(days)} days'
            ${cafeteriaId ? `AND o."cafeteriaid" = :cafeteriaId` : ''}
            GROUP BY oi."name"
            ORDER BY quantity DESC
            LIMIT :limit
            `,
            {
                replacements: {
                    limit: parseInt(limit),
                    cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null
                },
                type: QueryTypes.SELECT
            }
        );

        res.json({
            success: true,
            data: topItems.map(item => ({
                itemName: item.itemName,
                quantity: parseInt(item.quantity),
                revenue: parseFloat(item.revenue)
            }))
        });
    } catch (error) {
        console.error('Superadmin top-items error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch top items' });
    }
});

// ============================================
// GET ALL CUSTOMERS (SUPERADMIN)
// ============================================
router.get('/customers', superadminAuth, async (req, res) => {
    try {
        const { limit = 100, offset = 0, search, cafeteriaId } = req.query;

        // If cafeteriaId is provided, get customers who have ordered from that cafeteria
        if (cafeteriaId) {
            const customers = await sequelize.query(
                `
                SELECT DISTINCT 
                    u.id,
                    u.name,
                    u.email,
                    u.phone,
                    u."created_at" AS "createdAt",
                    u."updated_at" AS "updatedAt",
                    COUNT(DISTINCT o.id) as "orderCount",
                    COALESCE(SUM(o."totalamount"), 0) as "totalSpent"
                FROM users u
                INNER JOIN orders o ON u.id = o."studentid"
                WHERE o."cafeteriaid" = :cafeteriaId
                AND o."paymentstatus" = 'SUCCESS'
                ${search ? `AND (u.name ILIKE :search OR u.email ILIKE :search OR u.phone ILIKE :search)` : ''}
                GROUP BY u.id, u.name, u.email, u.phone, u."created_at", u."updated_at"
                ORDER BY u."created_at" DESC
                LIMIT :limit OFFSET :offset
                `,
                {
                    replacements: {
                        cafeteriaId: parseInt(cafeteriaId),
                        search: search ? `%${search}%` : null,
                        limit: parseInt(limit),
                        offset: parseInt(offset)
                    },
                    type: QueryTypes.SELECT
                }
            );

            // Get total count for the cafeteria
            const countResult = await sequelize.query(
                `
                SELECT COUNT(DISTINCT u.id) as count
                FROM users u
                INNER JOIN orders o ON u.id = o."studentid"
                WHERE o."cafeteriaid" = :cafeteriaId
                AND o."paymentstatus" = 'SUCCESS'
                ${search ? `AND (u.name ILIKE :search OR u.email ILIKE :search OR u.phone ILIKE :search)` : ''}
                `,
                {
                    replacements: {
                        cafeteriaId: parseInt(cafeteriaId),
                        search: search ? `%${search}%` : null
                    },
                    type: QueryTypes.SELECT
                }
            );

            return res.json({
                success: true,
                count: parseInt(countResult[0].count),
                data: customers
            });
        }

        // Global mode - get all customers with order stats
        const customers = await sequelize.query(
            `
            SELECT 
                u.id,
                u.name,
                u.email,
                u.phone,
                u."created_at" AS "createdAt",
                u."updated_at" AS "updatedAt",
                COUNT(DISTINCT o.id) as "orderCount",
                COALESCE(SUM(CASE WHEN o."paymentstatus" = 'SUCCESS' THEN o."totalamount" ELSE 0 END), 0) as "totalSpent"
            FROM users u
            LEFT JOIN orders o ON u.id = o."studentid" AND o."paymentstatus" = 'SUCCESS'
            ${search ? `WHERE (u.name ILIKE :search OR u.email ILIKE :search OR u.phone ILIKE :search)` : ''}
            GROUP BY u.id, u.name, u.email, u.phone, u."created_at", u."updated_at"
            ORDER BY u."created_at" DESC
            LIMIT :limit OFFSET :offset
            `,
            {
                replacements: {
                    search: search ? `%${search}%` : null,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                },
                type: QueryTypes.SELECT
            }
        );

        // Get total count
        const countResult = await sequelize.query(
            `
            SELECT COUNT(*) as count FROM users
            ${search ? `WHERE (name ILIKE :search OR email ILIKE :search OR phone ILIKE :search)` : ''}
            `,
            {
                replacements: {
                    search: search ? `%${search}%` : null
                },
                type: QueryTypes.SELECT
            }
        );

        res.json({
            success: true,
            count: parseInt(countResult[0].count),
            data: customers
        });
    } catch (error) {
        console.error('Superadmin customers error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customers' });
    }
});

// ============================================
// GET ALL ADMINS (SUPERADMIN)
// ============================================
router.get('/admins', superadminAuth, async (req, res) => {
    try {
        const admins = await sequelize.query(
            `
            SELECT 
                a.id,
                a.name,
                a."staffid" AS "staffId",
                a.role,
                a."cafeteriaid" AS "cafeteriaId",
                a."created_at" AS "createdAt",
                c.name as "cafeteriaName"
            FROM admins a
            LEFT JOIN cafeterias c ON a."cafeteriaid" = c.id
            ORDER BY a.id ASC
            `,
            { type: QueryTypes.SELECT }
        );

        res.json({
            success: true,
            data: admins
        });
    } catch (error) {
        console.error('Superadmin admins error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch admins' });
    }
});

// ============================================
// CREATE ADMIN (SUPERADMIN)
// ============================================
router.post('/admins', superadminAuth, async (req, res) => {
    try {
        const { name, staffId, password, cafeteriaId, role } = req.body;

        if (!name || !staffId || !password || !cafeteriaId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Check if staffId exists
        const existingAdmin = await Admin.findOne({ where: { staffId } });
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'Staff ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await Admin.create({
            name,
            staffId,
            password: hashedPassword,
            cafeteriaId,
            role: role || 'staff'
        });

        const { password: _, ...adminData } = newAdmin.toJSON();

        res.status(201).json({
            success: true,
            data: adminData
        });
    } catch (error) {
        console.error('Superadmin create admin error:', error);
        res.status(500).json({ success: false, message: 'Failed to create admin' });
    }
});

// ============================================
// PAYMENTS
// ============================================
router.get('/payments', superadminAuth, async (req, res) => {
    try {
        const { limit = 50, offset = 0, cafeteriaId, status, search } = req.query;
        const where = {};
        if (cafeteriaId) where.cafeteriaId = parseInt(cafeteriaId);
        if (status) where.status = status;
        if (search) {
            where[Op.or] = [
                { transactionId: { [Op.iLike]: `%${search}%` } },
                { paymentId: { [Op.iLike]: `%${search}%` } },
                { billId: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const payments = await Payment.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            include: [{
                model: Order,
                include: [
                    { model: User, attributes: ['name', 'email'] },
                    { model: OrderItem, as: 'items', attributes: ['name', 'quantity'] }
                ]
            }]
        });

        res.json({ success: true, ...payments });
    } catch (error) {
        console.error('Payments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
});

// ============================================
// BROADCAST NOTIFICATION (SUPERADMIN)
// ============================================
router.post('/notifications/broadcast', superadminAuth, async (req, res) => {
    try {
        const { title, body, data } = req.body;

        if (!title || !body) {
            return res.status(400).json({ success: false, message: 'Title and body are required' });
        }

        // Fetch all user tokens
        const userTokens = await UserFcmToken.findAll({
            attributes: ['fcmToken']
        });

        if (userTokens.length === 0) {
            return res.json({ success: true, message: 'No registered users with FCM tokens', sentCount: 0 });
        }

        const tokens = [...new Set(userTokens.map(t => t.fcmToken))];
        console.log(`📣 Broadcasting to ${tokens.length} unique tokens`);

        // Multicast notification
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title,
                body,
            },
            data: data || {
                type: 'BROADCAST',
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            android: {
                priority: "high",
                notification: {
                    channelId: "high_importance_channel"
                }
            }
        });

        console.log(`✅ Broadcast successful. Success: ${response.successCount}, Failure: ${response.failureCount}`);

        // Cleanup invalid tokens if any failures occurred
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && (
                    resp.error.code === 'messaging/invalid-registration-token' ||
                    resp.error.code === 'messaging/registration-token-not-registered'
                )) {
                    invalidTokens.push(tokens[idx]);
                }
            });

            if (invalidTokens.length > 0) {
                console.log(`🧹 Removing ${invalidTokens.length} invalid tokens`);
                await UserFcmToken.destroy({
                    where: { fcmToken: invalidTokens }
                });
            }
        }

        res.json({
            success: true,
            sentCount: response.successCount,
            failureCount: response.failureCount
        });
    } catch (error) {
        console.error('Broadcast notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to send broadcast' });
    }
});

// ============================================
// DAILY QUOTE MANAGEMENT
// ============================================
router.get('/settings/quote', superadminAuth, async (req, res) => {
    try {
        const [textSetting, imageSetting] = await Promise.all([
            SystemSetting.findOne({ where: { key: 'DAILY_QUOTE' } }),
            SystemSetting.findOne({ where: { key: 'DAILY_QUOTE_IMAGE' } })
        ]);

        res.json({
            success: true,
            data: {
                quote: textSetting ? textSetting.value : '',
                imageUrl: imageSetting ? imageSetting.value : ''
            }
        });
    } catch (error) {
        console.error('Fetch daily quote error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch daily quote' });
    }
});

router.post('/settings/quote', superadminAuth, upload.single('image'), async (req, res) => {
    try {
        const { quote } = req.body;
        let imageUrl = null;

        if (quote === undefined) {
            return res.status(400).json({ success: false, message: 'Quote is required' });
        }

        // 1. Handle Image Upload to S3 if file provided
        if (req.file) {
            const s3 = getS3Client();
            const bucket = getS3Bucket();

            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `images/quotes/daily-quote-${Date.now()}.${fileExt}`;

            await s3.send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: fileName,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                })
            );

            imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        }

        // 2. Update Quote Text
        const [textSetting] = await SystemSetting.findOrCreate({
            where: { key: 'DAILY_QUOTE' },
            defaults: {
                value: quote,
                type: 'STRING',
                group: 'GENERAL',
                isPublic: true,
                description: 'Engaging quote displayed on the mobile home screen'
            }
        });
        textSetting.value = quote;
        await textSetting.save();

        // 3. Update Image URL (only if new image uploaded)
        if (imageUrl) {
            const [imageSetting] = await SystemSetting.findOrCreate({
                where: { key: 'DAILY_QUOTE_IMAGE' },
                defaults: {
                    value: imageUrl,
                    type: 'STRING',
                    group: 'GENERAL',
                    isPublic: true,
                    description: 'Image displayed alongside the daily quote'
                }
            });
            imageSetting.value = imageUrl;
            await imageSetting.save();
        }

        const finalImageSetting = await SystemSetting.findOne({ where: { key: 'DAILY_QUOTE_IMAGE' } });

        res.json({
            success: true,
            message: 'Daily quote updated successfully',
            data: {
                quote: quote,
                imageUrl: finalImageSetting ? finalImageSetting.value : imageUrl
            }
        });
    } catch (error) {
        console.error('Update daily quote error:', error);
        res.status(500).json({ success: false, message: 'Failed to update daily quote' });
    }
});

// ============================================
// GET ALL APP FEEDBACK (SUPERADMIN)
// ============================================
router.get('/app-feedback', superadminAuth, async (req, res) => {
    try {
        const feedback = await AppFeedback.findAll({
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'phone'],
                },
            ],
            order: [['created_at', 'DESC']], // Use DB column name for raw SQL ordering or attribute name correctly
        });

        res.json({
            success: true,
            count: feedback.length,
            data: feedback
        });
    } catch (error) {
        console.error('❌ getAllAppFeedback ERROR:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;
