import { DeliveryPartner, Cafeteria, Order, OrderItem, User, PartnerFcmToken, OrderFeedback, MenuItem, sequelize } from "../models/index.js";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import { generateToken, generateRefreshToken } from "../utils/jwt.js";
import { emitPartnerLocationToUser } from "../socket.js";
import { getCache } from "../config/redis.js";

// ==========================================
// 1. DELIVERY PARTNER AUTH
// ==========================================
export const partnerLogin = async (req, res) => {
  try {
    const { partnerId, password } = req.body;
    console.log(`🔑 [LOGIN TRY] ID: ${partnerId}, PWD: ${password}`);

    if (!partnerId || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const partner = await DeliveryPartner.findOne({ 
      where: { partnerId },
      include: [{ model: Cafeteria, as: 'Cafeteria', attributes: ['name', 'phone'] }]
    });

    if (!partner) {
      return res.status(401).json({ message: "Invalid ID or Password" });
    }

    if (!partner.isActive) {
      return res.status(403).json({ message: "Account suspended. Contact Admin." });
    }

    const isMatch = await bcrypt.compare(password, partner.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid ID or Password" });
    }

    const token = generateToken({ id: partner.id, role: "DELIVERY", cafeteriaId: partner.cafeteriaId });
    const refreshToken = generateRefreshToken({ id: partner.id, role: "DELIVERY", cafeteriaId: partner.cafeteriaId });

    // 🧹 Clear Redis cache to ensure the new role is picked up immediately
    const { clearAuthCache } = await import("../middleware/auth.js");
    await clearAuthCache(partner.id);

    console.log(`✅ Partner Login: ${partner.name} (ID: ${partner.id})`);

    res.json({
      message: "Login successful",
      token,
      refreshToken,
      partner: {
        id: partner.id,
        name: partner.name,
        phone: partner.phone,
        cafeteriaId: partner.cafeteriaId,
        isOnline: partner.isOnline,
      },
    });
  } catch (err) {
    console.error("PARTNER LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================================
// 2. PARTNER MANAGEMENT (Admin & SuperAdmin)
// ==========================================

export const createDeliveryPartner = async (req, res) => {
  try {
    let { partnerId, name, phone, password, cafeteriaId } = req.body;
    
    // Auto-fill cafeteriaId if admin is creating
    if (!cafeteriaId && req.user.role === 'admin') {
      cafeteriaId = req.user.cafeteriaId;
    }

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Missing cafeteria selection" });
    }

    // Authorization Check: Admin can only create for their own cafeteria
    if (req.user.role === 'admin' && req.user.cafeteriaId !== parseInt(cafeteriaId)) {
      return res.status(403).json({ message: "Unauthorized cafeteria access" });
    }

    const existingPartner = await DeliveryPartner.findOne({ where: { partnerId } });
    if (existingPartner) {
      return res.status(400).json({ message: "Partner ID already exists" });
    }

    const partner = await DeliveryPartner.create({
      partnerId,
      name,
      phone,
      password,
      cafeteriaId
    });

    res.status(201).json({ message: "Partner created successfully", id: partner.id });
  } catch (err) {
    console.error("CREATE PARTNER ERROR:", err);
    res.status(500).json({ message: "Failed to create partner" });
  }
};

export const getDeliveryPartners = async (req, res) => {
  try {
    const { cafeteriaId } = req.query;
    const where = {};
    
    if (req.user.role === 'admin') {
      where.cafeteriaId = req.user.cafeteriaId;
    } else if (cafeteriaId) {
      where.cafeteriaId = cafeteriaId;
    }

    const partners = await DeliveryPartner.findAll({ 
      where,
      attributes: { exclude: ['password'] },
      include: [
        { model: Cafeteria, as: 'Cafeteria', attributes: ['name', 'phone', 'latitude', 'longitude'] }
      ]
    });

    // Fetch Avg Ratings
    const ratings = await OrderFeedback.findAll({
      attributes: [
        'deliveryPartnerId',
        [sequelize.fn('AVG', sequelize.col('delivery_rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount']
      ],
      where: { deliveryPartnerId: { [Op.ne]: null } },
      group: ['deliveryPartnerId']
    });

    const ratingMap = ratings.reduce((acc, r) => {
      acc[r.deliveryPartnerId] = {
        avgRating: parseFloat(r.dataValues.avgRating).toFixed(1),
        reviewCount: r.dataValues.reviewCount
      };
      return acc;
    }, {});

    const partnersWithDistance = partners.map(partner => {
      // Proximity Calculation (Haversine)
      partner.dataValues.distanceToCafeteria = (partner.lastLat && partner.lastLong && partner.Cafeteria?.latitude && partner.Cafeteria?.longitude) 
        ? (function() {
            const R = 6371;
            const dLat = (partner.lastLat - partner.Cafeteria.latitude) * Math.PI / 180;
            const dLon = (partner.lastLong - partner.Cafeteria.longitude) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(partner.Cafeteria.latitude * Math.PI / 180) * Math.cos(partner.lastLat * Math.PI / 180) * 
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          })()
        : null;

      partner.dataValues.averageRating = ratingMap[partner.id]?.avgRating || "0.0";
      partner.dataValues.reviewCount = ratingMap[partner.id]?.reviewCount || 0;

      return partner;
    }).sort((a, b) => {
      const distA = a.dataValues.distanceToCafeteria;
      const distB = b.dataValues.distanceToCafeteria;
      if (distA === null) return 1;
      if (distB === null) return -1;
      return distA - distB;
    });

    res.json(partnersWithDistance);
  } catch (err) {
    console.error("GET PARTNERS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch partners" });
  }
};

export const updatePartnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, isOnline } = req.body;

    const partner = await DeliveryPartner.findByPk(id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    if (isActive !== undefined) partner.isActive = isActive;
    if (isOnline !== undefined) partner.isOnline = isOnline;

    await partner.save();
    res.json({ message: "Status updated", partner });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
};

// ==========================================
// 3. ORDER MANAGEMENT FOR PARTNERS
// ==========================================

export const getAssignedOrders = async (req, res) => {
  try {
    const partnerId = parseInt(req.user.id);
    console.log(`🔍 [DB DEBUG] Fetching orders for Partner ID: ${partnerId} (Type: ${typeof partnerId})`);
    
    const orders = await Order.findAll({
      where: { 
        deliveryPartnerId: partnerId,
        status: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'READY'],
        updatedAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      attributes: [
        'id', 'billId', 'status', 'totalAmount', 'orderType', 
        'deliveryAddress', 'roomNumber', 'blockName', 'receiverPhone',
        'latitude', 'longitude', 'deliveryOtp', 'readyReminderCount', 
        'pickedUpAt', 'assignedAt', 'createdAt', 'updatedAt', 'deliveryOrderId'
      ],
      include: [
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem', attributes: ['name'] }]
        },
        { model: User, attributes: ['id', 'name', 'phone'] },
        { model: Cafeteria, as: 'Cafeteria', attributes: ['id', 'name', 'phone', 'latitude', 'longitude'] }
      ],
      order: [['updatedAt', 'DESC']]
    });

    console.log(`🔍 [DB DEBUG] Partner ${partnerId} query result: found ${orders.length} orders.`);

    // Explicitly map to ensure camelCase and correct types
    const sanitizedOrders = await Promise.all(orders.map(async (order) => {
      const plain = order.get({ plain: true });
      const hasDeliveryData = plain.deliveryAddress || (plain.latitude && plain.longitude);
      const finalOrderType = plain.orderType || (hasDeliveryData ? 'DELIVERY' : 'DINE_IN');

      // 🔎 Fetch Delivery OTP from Redis
      const activeStatuses = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'READY'];
      if (activeStatuses.includes(plain.status)) {
        const cachedOtp = await getCache(`delivery_otp:${plain.id}`);
        if (cachedOtp) {
          plain.deliveryOtp = cachedOtp;
        }
      }

      const result = {
        ...plain,
        orderType: finalOrderType,
        totalAmount: parseFloat(plain.totalAmount || 0),
        deliveryOrderId: plain.deliveryOrderId,
        customerName: plain.User?.name || 'Guest User',
        customerPhone: plain.User?.phone || '',
        deliveryAddress: plain.deliveryAddress || 'No Address Provided',
        cafeteriaName: plain.Cafeteria?.name || 'Cafeteria',
        cafeteriaPhone: plain.Cafeteria?.phone || '',
        cafeteriaLat: parseFloat(plain.Cafeteria?.latitude || 0),
        cafeteriaLng: parseFloat(plain.Cafeteria?.longitude || 0),
        customerLat: parseFloat(plain.latitude || 0),
        customerLng: parseFloat(plain.longitude || 0),
        roomNumber: plain.roomNumber,
        blockName: plain.blockName,
        receiverPhone: plain.receiverPhone,
        readyReminderCount: plain.readyReminderCount,
        assignedAt: plain.assignedAt,
        items: (plain.items || []).map(item => ({
          ...item,
          name: item.menuItem?.name || item.name || 'Unknown Item'
        }))
      };

      console.log(`📦 [DEBUG] Order #${result.id} Sanitized:`, {
        room: result.roomNumber,
        block: result.blockName,
        phone: result.receiverPhone
      });

      return result;
    }));

    console.log(`📡 [DELIVERY] Fetched ${sanitizedOrders.length} orders for Partner ${partnerId}.${sanitizedOrders.length > 0 ? ` Example Type: ${sanitizedOrders[0].orderType}` : ''}`);
    res.json(sanitizedOrders);
  } catch (err) {
    console.error("❌ [DELIVERY] GET ASSIGNED ORDERS ERROR:", err.message);
    if (err.name === 'SequelizeDatabaseError') {
      console.error("   SQL Error:", err.parent?.message || err.original?.message);
    }
    console.error("   Stack:", err.stack);
    res.status(500).json({ message: "Error fetching orders", detail: err.message });
  }
};

export const updatePartnerFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const partnerId = req.user.id;

    if (!fcmToken) return res.status(400).json({ message: "Token required" });

    await PartnerFcmToken.upsert({
      partnerId,
      fcmToken
    });

    res.json({ message: "FCM token updated" });
  } catch (err) {
    console.error("FCM UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to update token" });
  }
};

// ==========================================
// 4. PERFORMANCE & HISTORY
// ==========================================

export const getPartnerPerformance = async (req, res) => {
  try {
    const partnerId = req.user.id;
    const partner = await DeliveryPartner.findByPk(partnerId, {
      include: [{ model: Cafeteria, as: 'Cafeteria', attributes: ['deliveryFee'] }]
    });

    if (!partner) return res.status(404).json({ message: "Partner not found" });

    // Today's metrics (Robust IST calculation - UTC+5:30)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: 'numeric', day: 'numeric'
    });
    const parts = formatter.formatToParts(now).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

    // Create a UTC date representing 00:00:00 of the current day in IST
    // Note: parts.month is 1-indexed
    const istMidnightUTC = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
    
    // Subtract 5.5 hours to get the actual UTC start time for today in IST
    const startOfTodayUTC = new Date(istMidnightUTC.getTime() - (5.5 * 60 * 60 * 1000));

    const todayOrders = await Order.findAll({
      where: {
        deliveryPartnerId: partnerId,
        status: ['DELIVERED', 'COMPLETED'],
        updatedAt: { [Op.gte]: startOfTodayUTC }
      }
    });

    const totalOrders = await Order.count({
      where: { deliveryPartnerId: partnerId, status: ['DELIVERED', 'COMPLETED'] }
    });

    const deliveryFee = parseFloat(partner.Cafeteria?.deliveryFee || 20.0);
    const todayEarnings = todayOrders.length * deliveryFee;
    const totalEarnings = totalOrders * deliveryFee;

    // Reputation
    const feedbackStats = await OrderFeedback.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('delivery_rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount']
      ],
      where: { deliveryPartnerId: partnerId }
    });

    res.json({
      todayOrders: todayOrders.length,
      todayEarnings,
      totalOrders,
      totalDeliveries: totalOrders, // alias for Profile screen
      totalEarnings,
      rejectionCount: partner.rejectionCount,
      isOnline: partner.isOnline,
      averageRating: parseFloat(feedbackStats?.dataValues?.avgRating || 0).toFixed(1),
      totalReviews: parseInt(feedbackStats?.dataValues?.reviewCount || 0)
    });
  } catch (err) {
    console.error("GET PERFORMANCE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch performance data" });
  }
};

export const getPartnerHistory = async (req, res) => {
  try {
    const partnerId = req.user.id;
    const { page = 1, limit = 20, date } = req.query;
    const offset = (page - 1) * limit;

    const where = {
      deliveryPartnerId: partnerId,
      status: ['DELIVERED', 'COMPLETED']
    };

    if (date) {
      // 🇮🇳 IST Support: Convert the selected date to 00:00 IST and 23:59 IST in UTC
      // 00:00 IST is 18:30 UTC of the previous day
      const istStart = new Date(date);
      istStart.setHours(0, 0, 0, 0); 
      const startUtc = new Date(istStart.getTime() - (5.5 * 60 * 60 * 1000));

      // 23:59 IST is 18:29 UTC of the same day
      const istEnd = new Date(date);
      istEnd.setHours(23, 59, 59, 999);
      const endUtc = new Date(istEnd.getTime() - (5.5 * 60 * 60 * 1000));

      where.updatedAt = {
        [Op.gte]: startUtc,
        [Op.lte]: endUtc
      };
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem', attributes: ['name'] }]
        },
        { model: User, attributes: ['name'] }
      ],
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      orders: rows
    });
  } catch (err) {
    console.error("GET HISTORY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
};

// ==========================================
// 5. GEOSPATIAL ACTIONS
// ==========================================

export const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const partnerId = req.user.id;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "Coordinates required" });
    }

    await DeliveryPartner.update(
      { 
        lastLat: lat, 
        lastLong: lng, 
        lastLocationAt: new Date() 
      },
      { where: { id: partnerId } }
    );

    // 🔥 Real-time Tracking: Emit to all users who have an active order with this partner
    const activeOrders = await Order.findAll({
      where: {
        deliveryPartnerId: partnerId,
        status: ['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY']
      },
      attributes: ['studentId']
    });

    activeOrders.forEach(order => {
      emitPartnerLocationToUser(order.studentId, {
        partnerId,
        lat,
        lng,
        lastUpdate: new Date()
      });
    });

    res.json({ success: true, message: "Location updated" });
  } catch (err) {
    console.error("UPDATE LOCATION ERROR:", err);
    res.status(500).json({ message: "Failed to update location" });
  }
};

export const getPartnerLocation = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findByPk(orderId, {
      attributes: ['deliveryPartnerId', 'status']
    });

    if (!order || !order.deliveryPartnerId) {
      return res.status(404).json({ message: "Delivery tracking not available for this order" });
    }

    // Only allow tracking if order is in a trackable state
    const TRACKABLE_STATUSES = ['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];
    if (!TRACKABLE_STATUSES.includes(order.status)) {
       return res.status(200).json({ status: order.status, trackingAvailable: false });
    }

    const partner = await DeliveryPartner.findByPk(order.deliveryPartnerId, {
      attributes: ['lastLat', 'lastLong', 'lastLocationAt', 'name', 'phone']
    });

    res.json({
      status: order.status,
      trackingAvailable: true,
      partner: {
        lat: partner.lastLat,
        lng: partner.lastLong,
        lastUpdate: partner.lastLocationAt,
        name: partner.name,
        phone: partner.phone
      }
    });
  } catch (err) {
    console.error("GET LOCATION ERROR:", err);
    res.status(500).json({ message: "Failed to fetch tracking data" });
  }
};
