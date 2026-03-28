import express from 'express';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../config/db.js';
import { Order, Cafeteria, MenuItem, User, Admin, Payment, AuditLog, SystemSetting, OrderItem, UserFcmToken, AdminFcmToken, AppFeedback, SupportTicket } from '../models/index.js';
import { superadminAuth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import admin from "../config/firebaseAdmin.js";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import { replaceMenuImage } from "../controllers/menuController.js";
import { uploadCafeteriaMedia, deleteCafeteriaMedia, getAdvancedAnalytics } from "../controllers/superadminController.js";
import { clearCafeteriaCache } from "../utils/cache.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage for S3

// ============================================
// SUPERADMIN LOGIN
// ============================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Using hardcoded credentials as per existing logic, but checking them properly
        const SUPER_ADMIN_EMAIL = 'super@velish.com';
        const SUPER_ADMIN_PASSWORD = 'admin123'; // In a real app, this would be hashed in DB

        if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
            const token = jwt.sign(
                { id: 0, role: 'superadmin' },
                process.env.SUPERADMIN_JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({
                success: true,
                token,
                user: {
                    id: 0,
                    name: 'Super Admin',
                    email: SUPER_ADMIN_EMAIL,
                    role: 'superadmin'
                }
            });
        }

        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (error) {
        console.error('Superadmin login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

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
        const {
            name,
            latitude,
            longitude,
            isOpen,
            isUserVisible,
            ownerId,
            gstType,
            gstAmount,
            platformFeeType,
            platformFeeAmount,
            commissionType,
            commissionAmount,
            promoVideoUrl,
            promoImageUrl,
            showGst,
            showPlatformFee,
            showCommission
        } = req.body;

        if (!name || !latitude || !longitude || !ownerId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }



        const cafeteria = await Cafeteria.create({
            name,
            latitude,
            longitude,
            isOpen: isOpen !== undefined ? isOpen : true,
            isUserVisible: isUserVisible !== undefined ? isUserVisible : false,

            ownerId,
            gstType: gstType || 'percentage',
            gstAmount: gstAmount !== undefined ? gstAmount : 5.0,
            platformFeeType: platformFeeType || 'fixed',
            platformFeeAmount: platformFeeAmount !== undefined ? platformFeeAmount : 1.0,
            commissionType: commissionType || 'fixed',
            commissionAmount: commissionAmount !== undefined ? commissionAmount : 1.0,
            promoVideoUrl,
            promoImageUrl,
            showGst: showGst !== undefined ? showGst : true,
            showPlatformFee: showPlatformFee !== undefined ? showPlatformFee : true,
            showCommission: showCommission !== undefined ? showCommission : true,
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
        const {
            name,
            isOpen,
            isUserVisible,
            gstType,
            gstAmount,
            platformFeeType,
            platformFeeAmount,
            commissionType,
            commissionAmount,
            promoVideoUrl,
            promoImageUrl,
            showGst,
            showPlatformFee,
            showCommission
        } = req.body;

        const cafeteria = await Cafeteria.findByPk(id);
        if (!cafeteria) {
            return res.status(404).json({ success: false, message: 'Cafeteria not found' });
        }

        await cafeteria.update({
            ...(name !== undefined && { name }),
            ...(isOpen !== undefined && { isOpen }),
            ...(isUserVisible !== undefined && { isUserVisible }),
            ...(gstType !== undefined && { gstType }),
            ...(gstAmount !== undefined && { gstAmount }),
            ...(platformFeeType !== undefined && { platformFeeType }),
            ...(platformFeeAmount !== undefined && { platformFeeAmount }),
            ...(commissionType !== undefined && { commissionType }),
            ...(commissionAmount !== undefined && { commissionAmount }),
            ...(promoVideoUrl !== undefined && { promoVideoUrl }),
            ...(promoImageUrl !== undefined && { promoImageUrl }),
            ...(showGst !== undefined && { showGst }),
            ...(showPlatformFee !== undefined && { showPlatformFee }),
            ...(showCommission !== undefined && { showCommission }),
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
// UPLOAD CAFETERIA MEDIA (SUPERADMIN)
// ============================================
router.post('/cafeterias/upload-media/:id', superadminAuth, upload.single('file'), uploadCafeteriaMedia);

// ============================================
// DELETE CAFETERIA MEDIA (SUPERADMIN)
// ============================================
router.post('/cafeterias/delete-media/:id', superadminAuth, deleteCafeteriaMedia);

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
        // Total revenue (filtered by period)
        const revenueResult = await Order.findAll({
            attributes: [
                [sequelize.literal('COALESCE(SUM("totalamount" - "platform_fee" - "commission_amount"), 0)'), 'netRevenue']
            ],
            where: {
                ...baseWhere,
                status: { [Op.in]: ['PAID', 'PREPARING', 'READY', 'PICKED_UP'] }
            }
        });
        const totalRevenue = parseFloat(revenueResult[0].dataValues.netRevenue) || 0;

        // Pending orders (PAID or PREPARING status — always real-time, not period-filtered)
        const pendingWhere = { paymentStatus: 'SUCCESS', status: { [Op.in]: ['PAID', 'PREPARING'] } };
        if (cafeteriaId) pendingWhere.cafeteriaId = parseInt(cafeteriaId);
        const pendingOrders = await Order.count({ where: pendingWhere });

        // Today's orders
        const todayWhere = { paymentStatus: 'SUCCESS', createdAt: { [Op.gte]: startOfDay } };
        if (cafeteriaId) todayWhere.cafeteriaId = parseInt(cafeteriaId);
        const todayOrders = await Order.count({ where: todayWhere });

        // Today's revenue
        // Today's revenue
        const todayRevenueResult = await Order.findAll({
            attributes: [
                [sequelize.literal('COALESCE(SUM("totalamount" - "platform_fee" - "commission_amount"), 0)'), 'netRevenue']
            ],
            where: {
                ...todayWhere,
                status: { [Op.in]: ['PAID', 'PREPARING', 'READY', 'PICKED_UP'] }
            }
        });
        const todayRevenue = parseFloat(todayRevenueResult[0].dataValues.netRevenue) || 0;

        // Total customers (global - don't filter by cafeteria)
        const totalCustomers = await User.count();

        // Total users who have placed at least one successful order
        const usersWithOrdersResult = await sequelize.query(
            `SELECT COUNT(DISTINCT studentid) as count FROM orders WHERE paymentstatus = 'SUCCESS'`,
            { type: QueryTypes.SELECT }
        );
        const totalUsersWithOrders = parseInt(usersWithOrdersResult[0].count) || 0;

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
            totalUsersWithOrders,
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
                orders."platform_fee" AS "platformFee",
                orders."commission_amount" AS "commissionAmount",
                orders."gst_amount" AS "gstAmount",
                orders.status,
                orders."paymentstatus" AS "paymentStatus",
                orders."etaminutes" AS "etaMinutes",
                orders."kotnumber" AS "kotNumber",
                orders."israted" AS "isRated",
                orders."isparcel" AS "isParcel",
                orders."parcelamount" AS "parcelAmount",
                orders."created_at" AS "createdAt",
                orders."updated_at" AS "updatedAt",
                cafeterias.name AS "cafeteriaName",
                users.name AS "userName",
                users.email AS "userEmail"
            FROM orders
            LEFT JOIN cafeterias ON orders."cafeteriaid" = cafeterias.id
            LEFT JOIN users ON orders."studentid" = users.id
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
                COALESCE(SUM("totalamount" - "platform_fee" - "commission_amount"), 0) as revenue
            FROM orders
            WHERE orders."paymentstatus" = 'SUCCESS'
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
// GET ADVANCED ANALYTICS (SUPERADMIN)
// ============================================
router.get('/advanced-analytics', superadminAuth, getAdvancedAnalytics);

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
                SELECT 
                    u.id,
                    u.name,
                    u.email,
                    u.phone,
                    u."created_at" AS "createdAt",
                    u."updated_at" AS "updatedAt",
                    (SELECT COUNT(*) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS' AND o.cafeteriaid = :cafeteriaId) as "orderCount",
                    (SELECT COALESCE(SUM(totalamount), 0) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS' AND o.cafeteriaid = :cafeteriaId) as "totalSpent",
                    (SELECT COALESCE(SUM(durationseconds), 0) FROM user_activities ua WHERE ua.userid = u.id AND ua.activitytype = 'SESSION_END') as "totalUsageSeconds"
                FROM users u
                WHERE EXISTS (SELECT 1 FROM orders o WHERE o.studentid = u.id AND o.cafeteriaid = :cafeteriaId)
                ${search ? `AND (u.name ILIKE :search OR u.email ILIKE :search OR u.phone ILIKE :search)` : ''}
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
                (SELECT COUNT(*) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS') as "orderCount",
                (SELECT COALESCE(SUM(totalamount), 0) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS') as "totalSpent",
                (SELECT COALESCE(SUM(durationseconds), 0) FROM user_activities ua WHERE ua.userid = u.id AND ua.activitytype = 'SESSION_END') as "totalUsageSeconds"
            FROM users u
            ${search ? `WHERE (u.name ILIKE :search OR u.email ILIKE :search OR u.phone ILIKE :search)` : ''}
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
        const { limit = 50, page, cafeteriaId, status, search } = req.query;

        const finalLimit = parseInt(limit) || 50;
        const finalPage = parseInt(page) || 1;
        const finalOffset = (finalPage - 1) * finalLimit;

        const where = {};
        if (cafeteriaId) where.cafeteriaId = parseInt(cafeteriaId);

        if (status && status !== 'ALL') {
            if (status === 'REFUNDED') {
                where[Op.or] = [
                    { status: { [Op.in]: ['REFUND_SUCCESS', 'REFUND_INITIATED'] } },
                    { refundamount: { [Op.gt]: 0 } }
                ];
            } else if (status === 'COMPLETED') {
                where.status = 'SUCCESS';
            } else if (status === 'FAILED') {
                where.status = 'FAILED';
            } else if (status === 'PENDING') {
                where.status = 'PENDING';
                where.refundamount = { [Op.or]: [0, null] }; // 🔴 Exclude already refunded but stuck as PENDING
            } else {
                where.status = status;
            }
        }

        if (search) {
            where[Op.or] = [
                { transactionId: { [Op.iLike]: `%${search}%` } },
                { paymentId: { [Op.iLike]: `%${search}%` } },
                { billId: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const payments = await Payment.findAndCountAll({
            where,
            limit: finalLimit,
            offset: finalOffset,
            order: [['createdAt', 'DESC']],
            include: [{
                model: Order,
                required: false,
                include: [
                    { model: User, required: false, attributes: ['name', 'email'] },
                    { model: OrderItem, as: 'items', required: false, attributes: ['name', 'quantity'] }
                ]
            }]
        });

        const rows = payments.rows.map(p => {
            const data = p.toJSON();
            // 🔄 Aggressive Logic: If there's a refund id or amount, it's a refund!
            const hasRefund = data.refundid || (data.refundamount && parseFloat(data.refundamount) > 0);

            if (hasRefund) {
                data.status = 'REFUNDED';
            }
            return data;
        });

        res.json({
            success: true,
            count: payments.count,
            rows: rows
        });
    } catch (error) {
        console.error('Payments detailed error:', error);
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
                    channelId: "high_importance_channel",
                    body: body,
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                        alert: {
                            title: title,
                            body: body,
                        },
                    }
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
                    resp.error.code === 'messaging/registration-token-not-registered' ||
                    resp.error.code === 'messaging/third-party-auth-error'
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
// WEEKLY QUOTE SCHEDULER
// ============================================

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper: get today's day number 1=Mon … 7=Sun
const getTodayDayNum = () => {
    const jsDay = new Date().getDay(); // 0=Sun
    return jsDay === 0 ? 7 : jsDay;
};

// GET /settings/quotes/weekly  →  return all 7 day slots
router.get('/settings/quotes/weekly', superadminAuth, async (req, res) => {
    try {
        const days = await Promise.all(
            [1, 2, 3, 4, 5, 6, 7].map(async (day) => {
                const [textSetting, imageSetting] = await Promise.all([
                    SystemSetting.findOne({ where: { key: `QUOTE_DAY_${day}` } }),
                    SystemSetting.findOne({ where: { key: `QUOTE_IMAGE_DAY_${day}` } }),
                ]);
                return {
                    day,
                    dayName: DAY_NAMES[day - 1],
                    quote: textSetting ? textSetting.value : '',
                    imageUrl: imageSetting ? imageSetting.value : '',
                };
            })
        );
        res.json({ success: true, data: days });
    } catch (error) {
        console.error('Fetch weekly quotes error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch weekly quotes' });
    }
});

// POST /settings/quotes/day/:day  →  update a single day's quote + image
router.post('/settings/quotes/day/:day', superadminAuth, upload.single('image'), async (req, res) => {
    try {
        const day = parseInt(req.params.day);
        if (!day || day < 1 || day > 7) {
            return res.status(400).json({ success: false, message: 'Day must be 1 (Mon) to 7 (Sun)' });
        }
        const { quote } = req.body;
        if (quote === undefined) {
            return res.status(400).json({ success: false, message: 'Quote is required' });
        }

        let imageUrl = null;

        // 1. Upload image to S3 if provided
        if (req.file) {
            const s3 = getS3Client();
            const bucket = getS3Bucket();
            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `images/quotes/day-${day}-${Date.now()}.${fileExt}`;
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            }));
            imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        }

        // 2. Upsert quote text
        const [textSetting] = await SystemSetting.findOrCreate({
            where: { key: `QUOTE_DAY_${day}` },
            defaults: {
                value: quote,
                type: 'STRING',
                group: 'QUOTES',
                isPublic: false,
                description: `Quote for ${DAY_NAMES[day - 1]}`,
            },
        });
        textSetting.value = quote;
        await textSetting.save();

        // 3. Upsert image URL (only if a new file was uploaded)
        if (imageUrl) {
            const [imageSetting] = await SystemSetting.findOrCreate({
                where: { key: `QUOTE_IMAGE_DAY_${day}` },
                defaults: {
                    value: imageUrl,
                    type: 'STRING',
                    group: 'QUOTES',
                    isPublic: false,
                    description: `Image for ${DAY_NAMES[day - 1]} quote`,
                },
            });
            imageSetting.value = imageUrl;
            await imageSetting.save();
        }

        const finalImage = await SystemSetting.findOne({ where: { key: `QUOTE_IMAGE_DAY_${day}` } });
        res.json({
            success: true,
            message: `${DAY_NAMES[day - 1]} quote updated successfully`,
            data: {
                day,
                dayName: DAY_NAMES[day - 1],
                quote,
                imageUrl: finalImage ? finalImage.value : imageUrl,
            },
        });
    } catch (error) {
        console.error('Update day quote error:', error);
        res.status(500).json({ success: false, message: 'Failed to update day quote' });
    }
});

// Legacy GET /settings/quote  →  returns today's scheduled quote (backward-compat for any old callers)
router.get('/settings/quote', superadminAuth, async (req, res) => {
    try {
        const day = getTodayDayNum();
        const [textSetting, imageSetting] = await Promise.all([
            SystemSetting.findOne({ where: { key: `QUOTE_DAY_${day}` } }),
            SystemSetting.findOne({ where: { key: `QUOTE_IMAGE_DAY_${day}` } }),
        ]);
        res.json({
            success: true,
            data: {
                quote: textSetting ? textSetting.value : '',
                imageUrl: imageSetting ? imageSetting.value : '',
            },
        });
    } catch (error) {
        console.error('Fetch today quote error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch today quote' });
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

// ============================================
// GET ADVANCED ANALYTICS (SUPERADMIN)
// ============================================
router.get('/analytics/advanced', superadminAuth, async (req, res) => {
    try {
        const { cafeteriaId, days = 30 } = req.query;
        const periodDays = parseInt(days);

        const now = new Date();
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - periodDays);

        const cafeteriaFilter = cafeteriaId ? `AND "cafeteriaid" = :cafeteriaId` : '';
        const orderCafeteriaFilter = cafeteriaId ? `AND o."cafeteriaid" = :cafeteriaId` : '';

        // 1. DAU (Daily Active Users) - Trend for the period
        const dauTrend = await sequelize.query(
            `
            SELECT 
                DATE(created_at) as date,
                COUNT(DISTINCT userid) as count
            FROM user_activities
            WHERE activitytype = 'APP_OPEN'
            AND created_at >= NOW() - INTERVAL '${periodDays} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
            `,
            { type: QueryTypes.SELECT }
        );

        // 2. MAU (Monthly Active Users) - Single value for last 30 days
        const mauResult = await sequelize.query(
            `
            SELECT COUNT(DISTINCT userid) as count
            FROM user_activities
            WHERE activitytype = 'APP_OPEN'
            AND created_at >= NOW() - INTERVAL '30 days'
            `,
            { type: QueryTypes.SELECT }
        );
        const mau = parseInt(mauResult[0].count) || 0;

        // 3. Peak Order Times
        const peakTimes = await sequelize.query(
            `
            SELECT 
                EXTRACT(HOUR FROM created_at) as hour,
                COUNT(*) as count
            FROM orders
            WHERE paymentstatus = 'SUCCESS'
            AND created_at >= NOW() - INTERVAL '${periodDays} days'
            ${cafeteriaFilter}
            GROUP BY hour
            ORDER BY count DESC
            `,
            {
                replacements: { cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null },
                type: QueryTypes.SELECT
            }
        );

        // 4. Conversion Rate (Opens vs Success Orders)
        const totalOpensResult = await sequelize.query(
            `
            SELECT COUNT(*) as count
            FROM user_activities
            WHERE activitytype = 'APP_OPEN'
            AND created_at >= NOW() - INTERVAL '${periodDays} days'
            `,
            { type: QueryTypes.SELECT }
        );
        const totalOpens = parseInt(totalOpensResult[0].count) || 1; // Avoid division by zero

        const totalOrdersResult = await sequelize.query(
            `
            SELECT COUNT(*) as count
            FROM orders
            WHERE paymentstatus = 'SUCCESS'
            AND created_at >= NOW() - INTERVAL '${periodDays} days'
            ${cafeteriaFilter}
            `,
            {
                replacements: { cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null },
                type: QueryTypes.SELECT
            }
        );
        const totalOrders = parseInt(totalOrdersResult[0].count) || 0;
        const conversionRate = (totalOrders / totalOpens) * 100;

        // 5. Returning vs New Users
        // New users in this period
        const newUsersCount = await User.count({
            where: {
                createdAt: { [Op.gte]: periodStart }
            }
        });

        // Returning users (Users who ordered in this period and also had orders before this period)
        const returningUsersResult = await sequelize.query(
            `
            SELECT COUNT(DISTINCT o_current.studentid) as count
            FROM orders o_current
            WHERE o_current.paymentstatus = 'SUCCESS'
            AND o_current.created_at >= :periodStart
            AND EXISTS (
                SELECT 1 FROM orders o_past
                WHERE o_past.studentid = o_current.studentid
                AND o_past.paymentstatus = 'SUCCESS'
                AND o_past.created_at < :periodStart
            )
            `,
            {
                replacements: { periodStart },
                type: QueryTypes.SELECT
            }
        );
        const returningUsers = parseInt(returningUsersResult[0].count) || 0;

        // 6. Payment Success vs Failed
        const paymentStats = await sequelize.query(
            `
            SELECT 
                paymentstatus,
                COUNT(*) as count
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '${periodDays} days'
            ${cafeteriaFilter}
            GROUP BY paymentstatus
            `,
            {
                replacements: { cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null },
                type: QueryTypes.SELECT
            }
        );

        // 7. Orders & Revenue per Cafeteria
        const cafeteriaStats = await sequelize.query(
            `
            SELECT 
                c.id,
                c.name,
                COUNT(o.id) as orders,
                COALESCE(SUM(o.totalamount), 0) as revenue
            FROM cafeterias c
            LEFT JOIN orders o ON c.id = o.cafeteriaid AND o.paymentstatus = 'SUCCESS' AND o.created_at >= NOW() - INTERVAL '${periodDays} days'
            GROUP BY c.id, c.name
            ORDER BY revenue DESC
            `,
            { type: QueryTypes.SELECT }
        );

        // 8. User Session Duration (Average)
        const avgSessionDurationResult = await sequelize.query(
            `
            SELECT AVG(durationseconds) as avg_duration
            FROM user_activities
            WHERE activitytype = 'SESSION_END'
            AND created_at >= NOW() - INTERVAL '${periodDays} days'
            `,
            { type: QueryTypes.SELECT }
        );
        const avgSessionDuration = parseFloat(avgSessionDurationResult[0].avg_duration) || 0;

        res.json({
            success: true,
            data: {
                dauTrend,
                mau,
                peakTimes,
                conversionRate: parseFloat(conversionRate.toFixed(2)),
                userStats: {
                    newUsers: newUsersCount,
                    returningUsers
                },
                paymentStats,
                cafeteriaStats,
                avgSessionDuration: Math.round(avgSessionDuration)
            }
        });

    } catch (error) {
        console.error('Advanced analytics error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch advanced analytics' });
    }
});

// ============================================
// GET ALL SUPPORT TICKETS (SUPERADMIN) - User tickets only
// ============================================
router.get('/support-tickets', superadminAuth, async (req, res) => {
    try {
        const { status, category } = req.query;

        const where = { source: 'user' };
        if (status) where.status = status;
        if (category) where.category = category;

        const tickets = await SupportTicket.findAll({
            where,
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "name", "email", "phone"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            success: true,
            count: tickets.length,
            data: tickets,
        });
    } catch (error) {
        console.error("❌ getSupportTickets ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ============================================
// GET ADMIN SUPPORT TICKETS (SUPERADMIN) - Admin app tickets
// ============================================
router.get('/admin-support-tickets', superadminAuth, async (req, res) => {
    try {
        const { status, category } = req.query;

        const where = { source: 'admin' };
        if (status) where.status = status;
        if (category) where.category = category;

        const tickets = await SupportTicket.findAll({
            where,
            order: [["createdAt", "DESC"]],
            raw: true,
        });

        // Fetch admin details for each ticket
        const ticketsWithAdmin = await Promise.all(
            tickets.map(async (ticket) => {
                try {
                    const admin = await Admin.findByPk(ticket.userId, {
                        attributes: ["id", "name", "staffId", "role"],
                        raw: true,
                    });
                    return {
                        ...ticket,
                        admin: admin || { id: ticket.userId, name: "Unknown Admin", staffId: "N/A", role: "N/A" },
                    };
                } catch {
                    return {
                        ...ticket,
                        admin: { id: ticket.userId, name: "Unknown Admin", staffId: "N/A", role: "N/A" },
                    };
                }
            })
        );

        return res.json({
            success: true,
            count: ticketsWithAdmin.length,
            data: ticketsWithAdmin,
        });
    } catch (error) {
        console.error("❌ getAdminSupportTickets ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ============================================
// RESOLVE SUPPORT TICKET (SUPERADMIN)
// ============================================
router.put('/support-tickets/:id/resolve', superadminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { adminResponse, status } = req.body;

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Ticket not found",
            });
        }

        ticket.adminResponse = adminResponse || ticket.adminResponse;
        ticket.status = status || "resolved";
        if (status === "resolved" || (!status && adminResponse)) {
            ticket.resolvedAt = new Date();
            ticket.status = "resolved";
        }
        await ticket.save();

        console.log(`✅ Support ticket #${id} ${ticket.status} by superadmin`);

        // 🔔 SEND PUSH NOTIFICATION TO USER OR ADMIN
        (async () => {
            try {
                const ticketSource = ticket.source || 'user';
                const notifTitle = ticket.status === 'resolved'
                    ? '✅ Support Ticket Resolved'
                    : '💬 Support Ticket Update';
                const notifBody = `Your ticket "${ticket.category}" has been updated: ${(adminResponse || '').substring(0, 100)}`;

                let tokens = [];

                if (ticketSource === 'admin') {
                    // Send to admin FCM tokens
                    const adminTokens = await AdminFcmToken.findAll({
                        where: { adminId: ticket.userId },
                    });
                    tokens = adminTokens.map(t => t.fcmToken);
                    console.log(`🔔 Sending notification to admin ${ticket.userId} (${tokens.length} tokens)`);
                } else {
                    // Send to user FCM tokens
                    const userTokens = await UserFcmToken.findAll({
                        where: { userId: ticket.userId },
                    });
                    tokens = userTokens.map(t => t.fcmToken);
                    console.log(`🔔 Sending notification to user ${ticket.userId} (${tokens.length} tokens)`);
                }

                if (tokens.length > 0) {
                    const uniqueTokens = [...new Set(tokens)];
                    await admin.messaging().sendEachForMulticast({
                        tokens: uniqueTokens,
                        notification: {
                            title: notifTitle,
                            body: notifBody,
                        },
                        data: {
                            type: 'SUPPORT_TICKET_UPDATE',
                            ticketId: String(ticket.id),
                            ticketStatus: ticket.status,
                            click_action: 'FLUTTER_NOTIFICATION_CLICK',
                        },
                        android: {
                            priority: 'high',
                            notification: {
                                channelId: 'high_importance_channel',
                                sound: 'default',
                                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                            },
                        },
                        apns: {
                            payload: {
                                aps: {
                                    sound: 'default',
                                    badge: 1,
                                    alert: {
                                        title: notifTitle,
                                        body: notifBody,
                                    },
                                },
                            },
                        },
                    });
                    console.log(`✅ Support ticket notification sent to ${ticketSource} ${ticket.userId}`);
                } else {
                    console.log(`⚠️ No FCM tokens found for ${ticketSource} ${ticket.userId}`);
                }
            } catch (notifErr) {
                console.error('⚠️ Failed to send support ticket notification:', notifErr.message);
            }
        })();

        return res.json({
            success: true,
            message: `Ticket ${ticket.status} successfully`,
            ticket,
        });
    } catch (error) {
        console.error("❌ resolveTicket ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
