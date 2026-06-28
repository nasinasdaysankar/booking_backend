// import crypto from 'crypto'; // ✅ Import crypto for random string generation
// import { Order, OrderItem, MenuItem } from '../models/index.js';

// // --------------------------------------------------
// // HELPER: GENERATE CUSTOM BILL ID
// // Format: AA-X7K9P2M (Prefix + Random Unique String)
// // --------------------------------------------------
// // Helper to generate a Short, Unique Bill ID
// const generateBillId = (cafeteriaId) => {
//   let prefix = "GEN";
//   const mapping = { 1: "AA", 2: "AR", 3: "DP", 4: "FC" };
//   prefix = mapping[Number(cafeteriaId)] || "GEN";

//   const randomString = crypto.randomBytes(4).toString('hex').toUpperCase();
//   return `${prefix}-${randomString}`;
// };

// // --------------------------------------------------
// // ETA CALCULATOR
// // --------------------------------------------------
// const calculateETA = () => 10; // static ETA or adjust later

// // --------------------------------------------------
// // CREATE ORDER (Flutter + Menu format supported)
// // --------------------------------------------------
// export const createOrder = async (req, res) => {
//   const t = await Order.sequelize.transaction();
//   try {
//     const { cafeteriaId, items } = req.body;
//     const userId = req.user.id; // Extract ID from JWT

//     if (!items || items.length === 0) {
//       return res.status(400).json({ message: "No items provided" });
//     }

//     let total = 0;
//     const finalItems = [];

//     // Support both Flutter local cart and Menu-based ID formats
//     for (const item of items) {
//       const price = Number(item.price || item.priceAtOrder);
//       const qty = Number(item.qty || item.quantity);
//       total += price * qty;

//       finalItems.push({
//         Id: item.Id || 0,
//         name: item.name,
//         quantity: qty,
//         priceAtOrder: price,
//         imageUrl: item.img || item.imageUrl || null,
//       });
//     }

//     const order = await Order.create({
//       billId: generateBillId(cafeteriaId),
//       studentId: userId, // Dynamically linked to logged-in user
//       cafeteriaId,
//       totalAmount: total.toFixed(2),
//       status: "PAID",
//       paymentStatus: "SUCCESS",
//     }, { transaction: t });

//     for (const item of finalItems) {
//       await OrderItem.create({
//         orderId: order.id,
//         ...item
//       }, { transaction: t });
//     }

//     await t.commit();
//     res.status(201).json({ success: true, orderId: order.id, billId: order.billId });
//   } catch (err) {
//     await t.rollback();
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // --------------------------------------------------
// // GET MY ORDERS
// // --------------------------------------------------
// export const getMyOrders = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const orders = await Order.findAll({
//       where: { studentId: userId },
//       order: [["createdAt", "DESC"]],
//       include: [
//         {
//           model: OrderItem,
//           as: "items", // ✅ MUST MATCH index.js
//           attributes: ["name", "imageUrl", "quantity", "priceAtOrder"],
//         },
//       ],
//     });

//     return res.json(orders);
//   } catch (err) {
//     console.error("🔥 GET MY ORDERS ERROR:", err);
//     return res.status(500).json({
//       message: err.message, // TEMP: expose real error
//     });
//   }
// };
// // --------------------------------------------------
// // GET ORDER BY ID
// // --------------------------------------------------
// export const getOrderById = async (req, res) => {
//   try {
//     const userId = req.user?.id;
//     const orderId = req.params.id;

//     const order = await Order.findOne({
//       where: { id: orderId, studentId: userId },
//       include: [OrderItem],
//     });

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     return res.json(order);
//   } catch (err) {
//     console.error("🔥 ORDER FETCH ERROR:", err);
//     return res.status(500).json({ message: "Error fetching order" });
//   }
// };

import { Order, OrderItem, MenuItem, OrderFeedback, Cafeteria, DeliveryPartner, sequelize } from '../models/index.js';
import { clearAnalyticsCache } from '../utils/cache.js';
import { generateBillId, generateDailyOrderNumber } from './paymentController.js';
import { Op } from 'sequelize';
import { getCache } from '../config/redis.js';
import { appendOrderToSheet } from '../utils/googleSheets.js';
import { emitStockUpdate } from '../socket.js';
import { syncCategoryBanner } from '../utils/bannerSync.js';

// Helpers moved to paymentController.js for sharing

// --------------------------------------------------
// ETA CALCULATOR
// --------------------------------------------------
const calculateETA = () => 10;

// --------------------------------------------------
// CREATE ORDER
// --------------------------------------------------
export const createOrder = async (req, res) => {
  const t = await Order.sequelize.transaction();
  try {
    const { cafeteriaId, items } = req.body;
    const userId = req.user.id;

    // ✅ VALIDATE CAFETERIA STATUS
    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria) {
      return res.status(404).json({ success: false, message: "Cafeteria not found" });
    }

    if (!cafeteria.isUserVisible) {
      return res.status(400).json({ success: false, message: "Cafeteria is not currently accepting orders." });
    }

    if (!cafeteria.isOnlineOrderEnabled) {
      return res.status(400).json({ success: false, message: "Online orders are currently disabled for this cafeteria." });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    let total = 0;
    const finalItems = [];

    for (const item of items) {
      const price = Number(item.price || item.priceAtOrder);
      const qty = Number(item.qty || item.quantity);
      total += price * qty;

      finalItems.push({
        menuItemId: item.Id || item.menuItemId || 0,
        name: item.name,
        quantity: qty,
        priceAtOrder: price,
        imageUrl: item.img || item.imageUrl || null,
        isParcel: item.isParcel || item.isParcelSelected || false, // ✅ Capture parcel status
      });
    }

    const billId = await generateBillId(cafeteriaId, t);
    const dailyOrderNumber = await generateDailyOrderNumber(cafeteriaId, t);

    const order = await Order.create(
      {
        billId,
        studentId: userId,
        cafeteriaId,
        totalAmount: total.toFixed(2),
        status: "PAID",
        paymentStatus: "SUCCESS",
        dailyOrderNumber,
      },
      { transaction: t }
    );

    for (const item of finalItems) {
      await OrderItem.create(
        {
          orderId: order.id,
          ...item,
        },
        { transaction: t }
      );
    }

    // 📦 Decrement stock for each item — collect zero-stock items to alert after commit
    const zeroStockItems = [];
    for (const item of finalItems) {
      if (!item.menuItemId) continue;

      const menuItem = await MenuItem.findByPk(item.menuItemId, { transaction: t });
      if (!menuItem || !menuItem.trackStock) continue;

      const newStock = Math.max(0, menuItem.stock - item.quantity);
      console.log(`📦 [STOCK] User order: ${menuItem.name} ${menuItem.stock} → ${newStock}`);

      const updates = { stock: newStock };
      if (newStock === 0) {
        zeroStockItems.push({ id: menuItem.id, name: menuItem.name });
      }

      await menuItem.update(updates, { transaction: t });
    }

    await t.commit();

    // 🔔 Emit stock alerts AFTER commit so DB is guaranteed saved
    for (const item of zeroStockItems) {
      console.log(`📉 [STOCK] Emitting OUT_OF_STOCK alert for: ${item.name}`);
      emitStockUpdate(cafeteriaId, {
        menuItemId: item.id,
        name: item.name,
        stock: 0,
        reason: "OUT_OF_STOCK",
        message: `🚨 ${item.name} is now out of stock!`,
      });

      // 🚀 SYNC BANNER (Async, non-blocking)
      const menuItem = await MenuItem.findByPk(item.id);
      if (menuItem) {
        syncCategoryBanner(cafeteriaId, menuItem.category);
      }
    }

    // 🗑️ INVALIDATE ANALYTICS CACHE immediately so admin dashboard
    // shows updated top items / frequently ordered without delay
    clearAnalyticsCache(cafeteriaId).catch(err =>
      console.warn("⚠️ Analytics cache clear error (non-blocking):", err.message)
    );

    // 📊 GOOGLE SHEETS SYNC (Async, non-blocking)
    (async () => {
      try {
        await appendOrderToSheet({
          id: order.id,
          dailyOrderNumber: order.dailyOrderNumber,
          billId: order.billId,
          studentId: order.studentId,
          customerName: req.user.name || "Customer",
          cafeteriaId: order.cafeteriaId,
          totalAmount: order.totalAmount,
          items: finalItems, // items formatted for sheet
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt
        });
      } catch (sheetErr) {
        console.error("⚠️ Sheets sync error (offline order):", sheetErr.message);
      }
    })();

    return res.status(201).json({
      success: true,
      orderId: order.id,
      billId: order.billId,
    });
  } catch (err) {
    await t.rollback();
    console.error("🔥 CREATE ORDER ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to create order. Please try again." });
  }
};

// --------------------------------------------------
// GET MY ORDERS
// --------------------------------------------------
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const orders = await Order.findAll({
      where: { studentId: userId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      include: [
        {
          model: OrderItem,
          as: "items", // MUST MATCH association
          attributes: ["menuItemId", "name", "imageUrl", "quantity", "priceAtOrder", "isParcel", "specialInstructions"], // ✅ Include specialInstructions
        },
        {
          model: OrderFeedback,
          attributes: ["rating", "comment"],
        },
        {
          model: Cafeteria,
          as: "Cafeteria",
          attributes: ["id", "name", "bufferTime", "latitude", "longitude"],
        },
      ],
    });

    // 🔥 Populate deliveryOtp from Redis for active orders & Redact PII for historical/completed orders
    const mapped = await Promise.all(orders.map(async (o) => {
      const plain = o.toJSON ? o.toJSON() : { ...o };
      
      const activeOtpStatuses = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'READY'];
      if (activeOtpStatuses.includes(plain.status)) {
        const cachedOtp = await getCache(`delivery_otp:${plain.id}`);
        if (cachedOtp) {
          plain.deliveryOtp = cachedOtp;
        }
      }

      // Redact PII for historical / terminal orders to prevent information disclosure (V-01)
      const activePiiStatuses = [
        'PENDING_PAYMENT',
        'PAID',
        'PREPARING',
        'READY',
        'ASSIGNED',
        'ACCEPTED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY'
      ];
      if (!activePiiStatuses.includes(plain.status)) {
        delete plain.receiverPhone;
        delete plain.deliveryAddress;
        delete plain.roomNumber;
        delete plain.blockName;
        delete plain.latitude;
        delete plain.longitude;
      }

      return plain;
    }));

    return res.json(mapped);
  } catch (err) {
    console.error("🔥 GET MY ORDERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch orders. Please try again." });
  }
};

// --------------------------------------------------
// GET ORDER BY ID
// --------------------------------------------------
export const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const order = await Order.findOne({
      where: { id: orderId, studentId: userId },
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: ["menuItemId", "name", "imageUrl", "quantity", "priceAtOrder", "isParcel", "specialInstructions"],
        },
        {
          model: OrderFeedback,
          attributes: ["rating", "comment"],
        },
        {
          model: Cafeteria,
          as: "Cafeteria",
          attributes: ["id", "name", "bufferTime", "latitude", "longitude"],
        },
        {
          model: DeliveryPartner,
          attributes: ["name", "phone", "lastLat", "lastLong"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const plainOrder = order.toJSON ? order.toJSON() : { ...order };

    // 🔎 Fetch Delivery OTP from Redis
    const cachedOtp = await getCache(`delivery_otp:${orderId}`);
    if (cachedOtp) {
      plainOrder.deliveryOtp = cachedOtp;
    }

    return res.json(plainOrder);
  } catch (err) {
    console.error("🔥 ORDER FETCH ERROR:", err);
    return res.status(500).json({ message: "Error fetching order" });
  }
};

// --------------------------------------------------
// ✅ GET ORDER BY BILL ID (WITH ITEMS) — FIXED
// --------------------------------------------------
export const getOrderByBillId = async (req, res) => {
  try {
    const userId = req.user.id;
    const { billId } = req.params;

    const order = await Order.findOne({
      where: {
        billId,
        studentId: userId,
      },
      include: [
        {
          model: OrderItem,
          as: "items", // MUST MATCH association
          attributes: ["menuItemId", "name", "quantity", "priceAtOrder", "imageUrl", "isParcel", "specialInstructions"], // ✅ Include specialInstructions
        },
        {
          model: Cafeteria,
          as: "Cafeteria",
          attributes: ["bufferTime", "name", "latitude", "longitude"],
        },
        {
          model: DeliveryPartner,
          attributes: ["name", "phone", "lastLat", "lastLong"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const plainOrder = order.toJSON ? order.toJSON() : { ...order };

    // 🔎 Fetch Delivery OTP from Redis
    const cachedOtp = await getCache(`delivery_otp:${plainOrder.id}`);
    if (cachedOtp) {
      plainOrder.deliveryOtp = cachedOtp;
    }

    return res.json({
      success: true,
      order: plainOrder,
    });
  } catch (err) {
    console.error("🔥 GET ORDER BY BILL ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order details. Please try again.",
    });
  }
};

export const getLastDeliveryOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const order = await Order.findOne({
      where: {
        studentId: userId,
        orderType: 'DELIVERY',
        status: { [Op.ne]: 'CANCELLED' }
      },
      attributes: ['deliveryAddress', 'roomNumber', 'blockName', 'receiverPhone', 'latitude', 'longitude'],
      order: [['createdAt', 'DESC']],
      limit: 1
    });

    if (!order) {
      return res.json({ success: false, message: "No previous delivery order found" });
    }

    return res.json({
      success: true,
      deliveryDetails: {
        deliveryAddress: order.deliveryAddress,
        roomNumber: order.roomNumber,
        blockName: order.blockName,
        receiverPhone: order.receiverPhone,
        latitude: order.latitude ? parseFloat(order.latitude) : null,
        longitude: order.longitude ? parseFloat(order.longitude) : null
      }
    });
  } catch (err) {
    console.error("🔥 GET LAST DELIVERY ORDER ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch delivery details. Please try again." });
  }
};

