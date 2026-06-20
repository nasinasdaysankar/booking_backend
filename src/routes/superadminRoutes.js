import express from 'express';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../config/db.js';
import { Order, Cafeteria, MenuItem, User, Admin, Payment, AuditLog, SystemSetting, OrderItem, UserFcmToken, AdminFcmToken, AppFeedback, SupportTicket, SupportMessage } from '../models/index.js';

import { superadminAuth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import admin from "../config/firebaseAdmin.js";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "../config/aws_s3.js";
import { replaceMenuImage } from "../controllers/menuController.js";
import { uploadCafeteriaMedia, deleteCafeteriaMedia, getAdvancedAnalytics, getAllRadiusRequests, approveRadiusRequest, rejectRadiusRequest } from "../controllers/superadminController.js";
import { sendNotification, sendBatchNotifications, sendMulticastNotification } from "../utils/notificationUtils.js";
import { clearCafeteriaCache } from "../utils/cache.js";
import { emitCafeteriaUpdate } from "../socket.js";
import { 
    getAllTickets, 
    getAdminSupportTickets, 
    getTicketMessages, 
    addTicketMessage, 
    resolveTicket, 
    toggleMedia 
} from "../controllers/supportTicketController.js";
import { getDeliveryPartners, createDeliveryPartner, updatePartnerStatus } from "../controllers/deliveryController.js";
import { getPendingConfigs, approveConfig, rejectConfig } from "../controllers/deliveryChargeController.js";
import { createOrUpdateCampusBoundary, deleteCampusBoundary, getCampusBoundary } from '../controllers/campusBoundaryController.js';


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
                { expiresIn: '1d' }
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
            showCommission,
            ownerPin,
            isOnlineOrderEnabled,
            isDeliveryEnabled,
            isDeliveryAllowed,
            isDineInEnabled,
            isManualOrderEnabled,
            isInsideCampus,
            isCampusOnly,
            campusName
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
            ownerPin,
            isDeliveryEnabled: isDeliveryEnabled !== undefined ? isDeliveryEnabled : true,
            isDeliveryAllowed: isDeliveryAllowed !== undefined ? isDeliveryAllowed : true,
            isDineInEnabled: isDineInEnabled !== undefined ? isDineInEnabled : true,
            isManualOrderEnabled: isManualOrderEnabled !== undefined ? isManualOrderEnabled : true,
            isInsideCampus: isInsideCampus !== undefined ? isInsideCampus : false,
            isCampusOnly: isCampusOnly !== undefined ? isCampusOnly : false,
            campusName: campusName || null
        });


        // ✅ Emit real-time update
        emitCafeteriaUpdate(cafeteria.id, {
            isOpen: cafeteria.isOpen,
            isOnlineOrderEnabled: cafeteria.isOnlineOrderEnabled,
            isDeliveryEnabled: cafeteria.isDeliveryEnabled, 
            isDeliveryAllowed: cafeteria.isDeliveryAllowed,
            isDineInEnabled: cafeteria.isDineInEnabled,
            isManualOrderEnabled: cafeteria.isManualOrderEnabled,
            isInsideCampus: cafeteria.isInsideCampus,
            isCampusOnly: cafeteria.isCampusOnly
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
            showCommission,
            ownerPin,
            isOnlineOrderEnabled,
            isDeliveryEnabled,
            isDeliveryAllowed,
            isDineInEnabled,
            isManualOrderEnabled,
            isInsideCampus,
            isCampusOnly,
            campusName
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
            ...(ownerPin !== undefined && { ownerPin }),
            ...(isOnlineOrderEnabled !== undefined && { isOnlineOrderEnabled }),
            ...(isDeliveryEnabled !== undefined && { isDeliveryEnabled }),
            ...(isDeliveryAllowed !== undefined && { isDeliveryAllowed }),
            ...(isDineInEnabled !== undefined && { isDineInEnabled }),
            ...(isManualOrderEnabled !== undefined && { isManualOrderEnabled }),
            ...(isInsideCampus !== undefined && { isInsideCampus }),
            ...(isCampusOnly !== undefined && { isCampusOnly }),
            ...(campusName !== undefined && { campusName: campusName || null }),
        });


        // ✅ Emit real-time update
        emitCafeteriaUpdate(cafeteria.id, {
            isOpen: cafeteria.isOpen,
            isOnlineOrderEnabled: cafeteria.isOnlineOrderEnabled,
            isDeliveryEnabled: cafeteria.isDeliveryEnabled, 
            isDeliveryAllowed: cafeteria.isDeliveryAllowed,
            isDineInEnabled: cafeteria.isDineInEnabled,
            isManualOrderEnabled: cafeteria.isManualOrderEnabled,
            isInsideCampus: cafeteria.isInsideCampus,
            isCampusOnly: cafeteria.isCampusOnly
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
// RADIUS REQUEST ROUTES (SUPERADMIN)
// ============================================
router.get('/radius-requests', superadminAuth, getAllRadiusRequests);
router.put('/radius-requests/approve/:id', superadminAuth, approveRadiusRequest);
router.put('/radius-requests/reject/:id', superadminAuth, rejectRadiusRequest);

// ============================================
// DELIVERY CHARGE CONFIGURATION (SUPERADMIN)
// ============================================
router.get('/delivery-charge-configs/pending', superadminAuth, getPendingConfigs);
router.put('/delivery-charge-configs/approve/:id', superadminAuth, approveConfig);
router.put('/delivery-charge-configs/reject/:id', superadminAuth, rejectConfig);


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
        const { status, statusGroup, cafeteriaId, limit = 500, offset = 0, days, search } = req.query;

        // Build date filter for SQL
        let dateFilter = '';
        if (days) {
            dateFilter = `AND orders."created_at" >= NOW() - INTERVAL '${parseInt(days)} days'`;
        }

        // Build search filter for SQL (search by customer name or email)
        let searchFilter = '';
        if (search) {
            searchFilter = `AND (users.name ILIKE :search OR users.email ILIKE :search OR orders."billid" ILIKE :search OR orders."kotnumber" ILIKE :search)`;
        }

        // Build status filter — supports single status OR comma-separated statusGroup
        let statusFilter = '';
        let statusList = [];
        if (statusGroup) {
            // Multi-status group from tab selection (e.g. "PAID,PREPARING,READY")
            statusList = String(statusGroup).split(',').map(s => s.trim()).filter(Boolean);
            if (statusList.length > 0) {
                statusFilter = `AND orders.status IN (:statusList)`;
            }
        } else if (status) {
            // Single status filter
            statusFilter = `AND orders.status = :status`;
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
                orders."delivery_charge" AS "deliveryCharge",

                cafeterias.name AS "cafeteriaName",
                users.name AS "userName",
                users.email AS "userEmail"
            FROM orders
            LEFT JOIN cafeterias ON orders."cafeteriaid" = cafeterias.id
            LEFT JOIN users ON orders."studentid" = users.id
            WHERE 1=1
            ${statusFilter}
            ${cafeteriaId ? `AND orders."cafeteriaid" = :cafeteriaId` : ''}
            ${dateFilter}
            ${searchFilter}
            ORDER BY orders."created_at" DESC
            LIMIT :limit OFFSET :offset
            `,
            {
                replacements: {
                    status: status || null,
                    statusList: statusList.length > 0 ? statusList : null,
                    cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    search: search ? `%${search}%` : null
                },
                type: QueryTypes.SELECT
            }
        );

        // Get total count for the current tab (respects statusFilter)
        const countResult = await sequelize.query(
            `
            SELECT COUNT(*) as count
            FROM orders
            LEFT JOIN users ON orders."studentid" = users.id
            WHERE 1=1
            ${statusFilter}
            ${cafeteriaId ? `AND orders."cafeteriaid" = :cafeteriaId` : ''}
            ${dateFilter}
            ${searchFilter}
            `,
            {
                replacements: {
                    status: status || null,
                    statusList: statusList.length > 0 ? statusList : null,
                    cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null,
                    search: search ? `%${search}%` : null
                },
                type: QueryTypes.SELECT
            }
        );
        const totalCount = parseInt(countResult[0].count) || 0;

        // Get per-status counts (always unfiltered by status, but respects cafeteria/date/search)
        // so the dashboard stats cards show accurate totals regardless of status filter
        const statusCountsResult = await sequelize.query(
            `
            SELECT
                orders.status,
                COUNT(*) as count
            FROM orders
            LEFT JOIN users ON orders."studentid" = users.id
            WHERE 1=1
            ${cafeteriaId ? `AND orders."cafeteriaid" = :cafeteriaId` : ''}
            ${dateFilter}
            ${searchFilter}
            GROUP BY orders.status
            `,
            {
                replacements: {
                    cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null,
                    search: search ? `%${search}%` : null
                },
                type: QueryTypes.SELECT
            }
        );

        // Build a statusCounts map: { PICKED_UP: 1402, PREPARING: 12, ... }
        const statusCounts = {};
        for (const row of statusCountsResult) {
            statusCounts[row.status] = parseInt(row.count) || 0;
        }

        // allOrdersCount = total across ALL statuses (always global, ignores tab filter)
        const allOrdersCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

        // Total revenue from ALL successful payment orders (global, respects cafeteria filter only)
        const revenueResult = await sequelize.query(
            `
            SELECT COALESCE(SUM(totalamount - COALESCE(platform_fee, 0) - COALESCE(commission_amount, 0)), 0) AS "totalRevenue"
            FROM orders
            WHERE paymentstatus = 'SUCCESS'
            ${cafeteriaId ? `AND cafeteriaid = :cafeteriaId` : ''}
            `,
            {
                replacements: { cafeteriaId: cafeteriaId ? parseInt(cafeteriaId) : null },
                type: QueryTypes.SELECT
            }
        );
        const totalRevenue = parseFloat(revenueResult[0]?.totalRevenue || 0);

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
                count: totalCount,        // count for current tab/filter
                allOrdersCount,           // always the real total across all statuses
                totalRevenue,             // always global revenue
                statusCounts,
                data: combinedData
            });
        }

        res.json({
            success: true,
            count: 0,
            allOrdersCount,
            totalRevenue,
            statusCounts,
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
        const { 
            cafeteriaId, name, price, estPrepTimeMinutes, category, 
            isAvailable, isParcelAvailable, isTodaySpecial, description, 
            imageUrl, stock, trackStock, autoStockUpdate, defaultStockQuantity 
        } = req.body;

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
            imageUrl,
            stock: stock || 0,
            trackStock: trackStock || false,
            autoStockUpdate: autoStockUpdate || false,
            defaultStockQuantity: defaultStockQuantity || 0
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
        const { limit = 1000, offset = 0, search, cafeteriaId, type } = req.query;

        // If cafeteriaId is provided, get customers who have ordered from that cafeteria
        if (cafeteriaId) {
            const customers = await sequelize.query(
                `
                SELECT 
                    u.id,
                    u.name,
                    u.email,
                    u.phone,
                    u.role,
                    COALESCE(u.is_blocked, false) AS "isBlocked",
                    COALESCE(u.is_uninstalled, false) AS "isUninstalled",
                    u.uninstalled_at AS "uninstalledAt",
                    COALESCE(u.is_account_deleted, false) AS "isAccountDeleted",
                    u.account_deleted_at AS "accountDeletedAt",
                    u.original_email AS "originalEmail",
                    u."created_at" AS "createdAt",
                    u."updated_at" AS "updatedAt",
                    (SELECT COUNT(*) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS' AND o.cafeteriaid = :cafeteriaId) as "orderCount",
                    (SELECT COALESCE(SUM(totalamount), 0) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS' AND o.cafeteriaid = :cafeteriaId) as "totalSpent",
                    (SELECT COALESCE(SUM(durationseconds), 0) FROM user_activities ua WHERE ua.userid = u.id AND ua.activitytype = 'SESSION_END') as "totalUsageSeconds"
                FROM users u
                WHERE EXISTS (SELECT 1 FROM orders o WHERE o.studentid = u.id AND o.cafeteriaid = :cafeteriaId)
                ${type === 'uninstalled' ? 'AND u.is_uninstalled = true' : ''}
                ${type === 'deleted' ? 'AND u.is_account_deleted = true' : ''}
                ${search ? `AND (u.name ILIKE :search OR u.email ILIKE :search OR u.phone ILIKE :search OR u.original_email ILIKE :search)` : ''}
                ORDER BY ${type === 'uninstalled' ? 'u.uninstalled_at DESC' : type === 'deleted' ? 'u.account_deleted_at DESC' : '"orderCount" DESC, u."created_at" DESC'}
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
                ${type === 'uninstalled' ? 'AND u.is_uninstalled = true' : ''}
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
                u.role,
                COALESCE(u.is_blocked, false) AS "isBlocked",
                COALESCE(u.is_uninstalled, false) AS "isUninstalled",
                u.uninstalled_at AS "uninstalledAt",
                COALESCE(u.is_account_deleted, false) AS "isAccountDeleted",
                u.account_deleted_at AS "accountDeletedAt",
                u.original_email AS "originalEmail",
                u."created_at" AS "createdAt",
                u."updated_at" AS "updatedAt",
                (SELECT COUNT(*) FROM users) as "totalCustomers",
                (SELECT COUNT(*) FROM users WHERE is_uninstalled = true) as "uninstalledCount",
                (SELECT COUNT(*) FROM users WHERE is_account_deleted = true) as "deletedCount",
                (SELECT COUNT(*) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS') as "orderCount",
                (SELECT COALESCE(SUM(totalamount), 0) FROM orders o WHERE o.studentid = u.id AND o.paymentstatus = 'SUCCESS') as "totalSpent",
                (SELECT COALESCE(SUM(durationseconds), 0) FROM user_activities ua WHERE ua.userid = u.id AND ua.activitytype = 'SESSION_END') as "totalUsageSeconds"
            FROM users u
            WHERE 1=1
            ${type === 'uninstalled' ? 'AND u.is_uninstalled = true' : ''}
            ${type === 'deleted' ? 'AND u.is_account_deleted = true' : ''}
            ${search ? `AND (u.name ILIKE :search OR u.email ILIKE :search OR u.phone ILIKE :search OR u.original_email ILIKE :search)` : ''}
            ORDER BY ${type === 'uninstalled' ? 'u.uninstalled_at DESC' : type === 'deleted' ? 'u.account_deleted_at DESC' : '"orderCount" DESC, u."created_at" DESC'}
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

        // Get total count (for the current search filter)
        const countResult = await sequelize.query(
            `
            SELECT COUNT(*) as count FROM users
            WHERE 1=1
            ${type === 'uninstalled' ? 'AND is_uninstalled = true' : ''}
            ${type === 'deleted' ? 'AND is_account_deleted = true' : ''}
            ${search ? `AND (name ILIKE :search OR email ILIKE :search OR phone ILIKE :search OR original_email ILIKE :search)` : ''}
            `,
            {
                replacements: { search: search ? `%${search}%` : null },
                type: QueryTypes.SELECT
            }
        );

        // Get global stats (ignores search filter, always correct)
        const globalStatsResult = await sequelize.query(
            `
            SELECT 
                COUNT(*) as "totalCustomers",
                COUNT(CASE WHEN COALESCE(is_blocked, false) = true THEN 1 END) as "blockedCustomers",
                COUNT(CASE WHEN COALESCE(is_account_deleted, false) = true THEN 1 END) as "deletedCount",
                COUNT(CASE WHEN "created_at" >= date_trunc('month', CURRENT_DATE) THEN 1 END) as "newThisMonth"
            FROM users
            `,
            { type: QueryTypes.SELECT }
        );

        const activeCustomersResult = await sequelize.query(
            `SELECT COUNT(DISTINCT u.id) as "activeCustomers" 
             FROM users u JOIN orders o ON u.id = o.studentid 
             WHERE o.paymentstatus = 'SUCCESS' AND COALESCE(u.is_blocked, false) = false AND COALESCE(u.is_account_deleted, false) = false`,
            { type: QueryTypes.SELECT }
        );

        const globalRevenueResult = await sequelize.query(
            `SELECT COALESCE(SUM(totalamount - COALESCE(platform_fee, 0) - COALESCE(commission_amount, 0)), 0) as "totalRevenue" 
             FROM orders WHERE paymentstatus = 'SUCCESS'`,
            { type: QueryTypes.SELECT }
        );

        res.json({
            success: true,
            count: parseInt(countResult[0].count),
            globalStats: {
                totalCustomers: parseInt(globalStatsResult[0].totalCustomers) || 0,
                blockedCustomers: parseInt(globalStatsResult[0].blockedCustomers) || 0,
                newThisMonth: parseInt(globalStatsResult[0].newThisMonth) || 0,
                activeCustomers: parseInt(activeCustomersResult[0].activeCustomers) || 0,
                totalRevenue: parseFloat(globalRevenueResult[0].totalRevenue) || 0,
            },
            data: customers
        });
    } catch (error) {
        console.error('Superadmin customers error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customers' });
    }
});

// ============================================
// BLOCK / UNBLOCK CUSTOMER (SUPERADMIN)
// ============================================
router.put('/users/:id/block', superadminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { isBlocked } = req.body;

        if (typeof isBlocked !== 'boolean') {
            return res.status(400).json({ success: false, message: 'isBlocked must be a boolean' });
        }

        // Ensure column exists (safe to run multiple times)
        await sequelize.query(
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false`,
            { type: QueryTypes.RAW }
        );

        // Update using raw SQL since User model doesn't have this column yet
        const [, affected] = await sequelize.query(
            `UPDATE users SET is_blocked = :isBlocked WHERE id = :id`,
            {
                replacements: { isBlocked, id: parseInt(id) },
                type: QueryTypes.UPDATE
            }
        );

        if (affected === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
            data: { id: parseInt(id), isBlocked }
        });
    } catch (error) {
        console.error('Block/unblock user error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user block status' });
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
                COALESCE(a.is_active, true) AS "isActive",
                a."created_at" AS "createdAt",
                c.name as "cafeteriaName",
                (
                    SELECT json_agg(json_build_object(
                        'deviceInfo', af."device_info",
                        'lastActive', af."updated_at",
                        'token', af."fcmtoken"
                    ))
                    FROM admin_fcm_tokens af
                    WHERE af.adminid = a.id AND af."fcmtoken" IS NOT NULL
                ) AS "devices"
            FROM admins a
            LEFT JOIN cafeterias c ON a."cafeteriaid" = c.id
            ORDER BY a.id ASC
            `,
            { type: QueryTypes.SELECT }
        );

        const processedAdmins = admins.map(a => ({
            ...a,
            devices: a.devices || []
        }));

        res.json({
            success: true,
            data: processedAdmins
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

        const newAdmin = await Admin.create({
            name,
            staffId,
            password,
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
// UPDATE ADMIN STATUS / SUSPEND (SUPERADMIN)
// ============================================
router.put('/admins/:id/status', superadminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const result = await sequelize.query(
            `UPDATE admins SET is_active = :isActive WHERE id = :id RETURNING id, is_active`,
            {
                replacements: { id, isActive },
                type: QueryTypes.UPDATE
            }
        );

        if (!result || result[1] === 0) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        res.json({ success: true, message: 'Admin status updated successfully' });
    } catch (error) {
        console.error('Superadmin update admin status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update admin status' });
    }
});

// ============================================
// RESET ADMIN PASSWORD (SUPERADMIN)
// ============================================
router.put('/admins/:id/reset-password', superadminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, message: 'New password is required' });
        }

        const admin = await Admin.findByPk(id);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        await admin.update({ password });

        res.json({ success: true, message: 'Password reset successfully' });

    } catch (error) {
        console.error('Superadmin reset admin password error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset password' });
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
router.post('/notifications/broadcast', superadminAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, body, isPremiumUI, accentColor, isGradient, targetScreen, targetId, layoutConfig } = req.body;

        // ✅ Relaxed validation: Allow image-only notifications
        if ((!title || !body) && !req.file) {
            return res.status(400).json({ success: false, message: 'Notification requires either text (title & body) or an image banner.' });
        }

        let imageUrl = null;

        // 1. Upload image to S3 if provided
        if (req.file) {
            try {
                const s3 = getS3Client();
                const bucket = getS3Bucket();
                const fileExt = req.file.originalname.split('.').pop();
                const fileName = `notifications/broadcast-${Date.now()}.${fileExt}`;
                
                await s3.send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: fileName,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype,
                }));
                
                imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
                console.log("📸 Broadcast image uploaded to S3:", imageUrl);
            } catch (s3Error) {
                console.error("❌ S3 Upload failed for broadcast:", s3Error);
                // Continue without image if upload fails
            }
        }

        // Fetch user tokens (Filtered by whitelist in development for safety)
        let userTokens;
        if (process.env.NODE_ENV === 'production') {
            userTokens = await UserFcmToken.findAll({
                attributes: ['fcmToken', 'userId']
            });
        } else {
            console.log("🛡️ [BROADCAST] Local development detected. Filtering by whitelist...");
            const whitelist = (process.env.DEVELOPER_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
            
            userTokens = await UserFcmToken.findAll({
                attributes: ['fcmToken', 'userId'],
                include: [{
                    model: User,
                    where: {
                        [Op.or]: [
                            { email: { [Op.in]: whitelist } },
                            { originalEmail: { [Op.in]: whitelist } }
                        ]
                    },
                    attributes: [] // Don't fetch user data, just filter by it
                }]
            });
        }

        if (userTokens.length === 0) {
            return res.json({ 
                success: true, 
                message: process.env.NODE_ENV === 'production' 
                    ? 'No registered users with FCM tokens' 
                    : 'No whitelisted developers found in database for testing', 
                sentCount: 0 
            });
        }

        const tokens = [...new Set(userTokens.map(t => t.fcmToken))];
        const userTokenMap = userTokens.reduce((map, ut) => {
            map[ut.fcmToken] = ut.userId;
            return map;
        }, {});
        
        console.log(`📣 Broadcasting to ${tokens.length} unique tokens`);

        // Firebase sendEachForMulticast accepts max 500 tokens at a time.
        const chunkSize = 500;
        const batches = [];
        for (let i = 0; i < tokens.length; i += chunkSize) {
            batches.push(tokens.slice(i, i + chunkSize));
        }

        let totalSuccess = 0;
        let totalFailure = 0;

        // Process batches
        for (const batchTokens of batches) {
            const multicastMessage = {
                tokens: batchTokens,
                // 🛑 ONLY include top-level notification for iOS or standard Android notifications.
                // For "Specific UI" on Android, we use a "Data-Only" message to force native interception.
                notification: isPremiumUI === 'true' ? undefined : {
                    title,
                    body,
                    image: imageUrl || undefined
                },
                data: {
                    type: isPremiumUI === 'true' ? 'ORDER_STATUS_UPDATE' : 'BROADCAST',
                    status: 'BROADCAST',
                    title: title, 
                    body: body,
                    imageUrl: imageUrl || "",
                    isPremiumUI: isPremiumUI || "false",
                    accentColor: accentColor || "#9C27B0",
                    isGradient: isGradient || "false",
                    target_screen: targetScreen || "HOME",
                    target_id: targetId || "",
                    layoutConfig: layoutConfig || "{}",
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                android: {
                    priority: "high",
                    // 🛑 Omit notification block for Premium UI to enable data-only handling
                    notification: isPremiumUI === 'true' ? undefined : {
                        channelId: "high_importance_channel",
                        body: body,
                        icon: "stock_ticker_update",
                        color: accentColor || "#9C27B0",
                        sound: "default",
                        image: imageUrl || undefined
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: "default",
                            badge: 1,
                            alert: {
                                title,
                                body
                            },
                            'mutable-content': imageUrl ? 1 : 0
                        }
                    },
                    fcm_options: {
                        image: imageUrl || undefined
                    }
                }
            };

            const response = await sendMulticastNotification(multicastMessage, userTokenMap);
            totalSuccess += response.successCount;
            totalFailure += response.failureCount;
        }

        console.log(`✅ Broadcast successful. Success: ${totalSuccess}, Failure: ${totalFailure}`);

        res.json({
            success: true,
            sentCount: totalSuccess,
            failureCount: totalFailure
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
                const [textSetting, imageSetting, authorSetting] = await Promise.all([
                    SystemSetting.findOne({ where: { key: `QUOTE_DAY_${day}` } }),
                    SystemSetting.findOne({ where: { key: `QUOTE_IMAGE_DAY_${day}` } }),
                    SystemSetting.findOne({ where: { key: `QUOTE_AUTHOR_DAY_${day}` } }),
                ]);
                return {
                    day,
                    dayName: DAY_NAMES[day - 1],
                    quote: textSetting ? textSetting.value : '',
                    imageUrl: imageSetting ? imageSetting.value : '',
                    authorName: authorSetting ? authorSetting.value : '',
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
        const { quote, authorName } = req.body;
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

        // 2.5. Upsert author text
        if (authorName !== undefined) {
            const [authorSetting] = await SystemSetting.findOrCreate({
                where: { key: `QUOTE_AUTHOR_DAY_${day}` },
                defaults: {
                    value: authorName,
                    type: 'STRING',
                    group: 'QUOTES',
                    isPublic: false,
                    description: `Author for ${DAY_NAMES[day - 1]} quote`,
                },
            });
            authorSetting.value = authorName;
            await authorSetting.save();
        }

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
        const finalAuthor = await SystemSetting.findOne({ where: { key: `QUOTE_AUTHOR_DAY_${day}` } });
        res.json({
            success: true,
            message: `${DAY_NAMES[day - 1]} quote updated successfully`,
            data: {
                day,
                dayName: DAY_NAMES[day - 1],
                quote,
                authorName: finalAuthor ? finalAuthor.value : authorName,
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
        const [textSetting, imageSetting, authorSetting] = await Promise.all([
            SystemSetting.findOne({ where: { key: `QUOTE_DAY_${day}` } }),
            SystemSetting.findOne({ where: { key: `QUOTE_IMAGE_DAY_${day}` } }),
            SystemSetting.findOne({ where: { key: `QUOTE_AUTHOR_DAY_${day}` } }),
        ]);
        res.json({
            success: true,
            data: {
                quote: textSetting ? textSetting.value : '',
                imageUrl: imageSetting ? imageSetting.value : '',
                authorName: authorSetting ? authorSetting.value : '',
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
router.get('/support-tickets', superadminAuth, getAllTickets);

// ============================================
// GET ADMIN SUPPORT TICKETS (SUPERADMIN) - Admin app tickets
// ============================================
router.get('/admin-support-tickets', superadminAuth, getAdminSupportTickets);

// ============================================
// CONVERSATION THREADS (SUPERADMIN)
// ============================================

// Get all messages for a ticket
router.get('/support-tickets/:id/messages', superadminAuth, getTicketMessages);

// Add a message to a ticket
router.post('/support-tickets/:id/messages', superadminAuth, addTicketMessage);

// Toggle Media Permission for a ticket
router.put('/support-tickets/:id/toggle-media', superadminAuth, toggleMedia);


// ============================================
// RESOLVE SUPPORT TICKET (SUPERADMIN)
// ============================================
router.put('/support-tickets/:id/resolve', superadminAuth, resolveTicket);


// ============================================
// SYSTEM SETTINGS (SUPERADMIN)
// ============================================

// Get all system settings
router.get('/settings', superadminAuth, async (req, res) => {
    try {
        const settings = await SystemSetting.findAll();
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Fetch settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
});

// Update a specific setting
router.put('/settings/:id', superadminAuth, async (req, res) => {
    try {
        const { value } = req.body;
        const setting = await SystemSetting.findByPk(req.params.id);
        if (!setting) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
        }
        await setting.update({ value });
        res.json({ success: true, data: setting });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ success: false, message: 'Failed to update setting' });
    }
});

// Delete a specific setting
router.delete('/settings/:id', superadminAuth, async (req, res) => {
    try {
        const setting = await SystemSetting.findByPk(req.params.id);
        if (!setting) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
        }
        await setting.destroy();
        res.json({ success: true, message: 'Setting deleted successfully' });
    } catch (error) {
        console.error('Delete setting error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete setting' });
    }
});

// findOrCreate a setting (helper for frontend to ensure keys exist)
router.post('/settings/ensure', superadminAuth, async (req, res) => {
    try {
        const { key, value, type, description, isPublic, group } = req.body;
        const [setting, created] = await SystemSetting.findOrCreate({
            where: { key },
            defaults: { value, type, description, isPublic, group }
        });

        // Ensure isPublic is updated if it exists
        if (!created && isPublic !== undefined && setting.isPublic !== isPublic) {
            await setting.update({ isPublic });
        }

        res.json({ success: true, data: setting, created });
    } catch (error) {
        console.error('Ensure setting error:', error);
        res.status(500).json({ success: false, message: 'Failed to ensure setting' });
    }
});

// ============================================
// 🛵 DELIVERY PARTNER MANAGEMENT (SUPERADMIN)
// ============================================
/**
 * GET /api/superadmin/delivery-partners
 * List all delivery partners across all cafeterias
 */
router.get("/delivery-partners", superadminAuth, getDeliveryPartners);

/**
 * POST /api/superadmin/delivery-partners
 * Create a new delivery partner (global authority)
 */
router.post("/delivery-partners", superadminAuth, createDeliveryPartner);

/**
 * PATCH /api/superadmin/delivery-partners/:id
 * Update status/online status of a partner
 */
router.patch("/delivery-partners/:id", superadminAuth, updatePartnerStatus);

// ==========================================
// CAMPUS BOUNDARY GEOFENCING API
// ==========================================
router.get("/campus-boundaries", superadminAuth, getCampusBoundary);
router.post("/campus-boundary", superadminAuth, createOrUpdateCampusBoundary);
router.delete("/campus-boundary/:name", superadminAuth, deleteCampusBoundary);

export default router;

