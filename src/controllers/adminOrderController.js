// import { sequelize, Order, UserFcmToken } from "../models/index.js";
// import { QueryTypes, Op } from "sequelize";
// import { emitNewOrder, emitAdminOrderUpdate, emitOrderStatusToUser } from "../socket.js";
// import admin from "../config/firebaseAdmin.js";

// console.log("--------------------------------------------------");
// console.log("✅ LOADED: adminOrderController.js (Static QR Mode)");
// console.log("--------------------------------------------------");

// /**
//  * ===============================
//  * GET ADMIN ORDERS
//  * ===============================
//  */
// export const getAdminOrders = async (req, res) => {
//   try {
//     const { status } = req.query;
//     const cafeteriaId = req.user.cafeteriaId;

//     const orders = await sequelize.query(
//       `
//       SELECT *,
//              "createdAt" AT TIME ZONE 'UTC' AS "createdAtUtc"
//       FROM orders
//       WHERE status = :status
//       AND "cafeteriaId" = :cafeteriaId
//       ORDER BY "createdAtUtc" DESC
//       `,
//       {
//         replacements: { status: status || "PAID", cafeteriaId },
//         type: QueryTypes.SELECT,
//       }
//     );


//     if (orders.length === 0) return res.json([]);

//     const orderIds = orders.map((o) => o.id);

//     const allItems = await sequelize.query(
//       `SELECT * FROM order_items WHERE "orderId" IN (:ids)`,
//       {
//         replacements: { ids: orderIds },
//         type: QueryTypes.SELECT,
//       }
//     );

//     const combinedData = orders.map((order) => ({
//       ...order,
//       items: allItems.filter((item) => item.orderId === order.id),
//     }));

//     return res.json(combinedData);
//   } catch (err) {
//     console.error("🔥 getAdminOrders Error:", err);
//     return res.status(500).json({ message: "Error fetching orders" });
//   }
// };
// /**
//  * ===============================
//  * UPDATE ORDER STATUS
//  * ===============================
//  */
// export const updateOrderStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     let { status, etaMinutes } = req.body;

//     if (status) status = status.toUpperCase();

//     const order = await Order.findByPk(id);
//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     await order.update({
//       status,
//       etaMinutes,
//     });

//     console.log(`📝 Order ${order.id} updated to status: ${status}`);

//     // 🔔 REALTIME → ADMIN (SOCKET)
//     emitNewOrder(order.cafeteriaId, {
//       orderId: order.id,
//       status: order.status,
//       etaMinutes: order.etaMinutes,
//       updatedAt: new Date(),
//     });
//     console.log("✅ Admin notification sent via socket");

//     // 🔔 REALTIME → USER (SOCKET)
//     emitOrderStatusToUser(order.studentId, {
//       orderId: order.id,
//       status: order.status,
//       etaMinutes: order.etaMinutes,
//       updatedAt: new Date(),
//     });
//     console.log("✅ User socket notification sent");

//     // 🔔 FCM → USER (BACKGROUND NOTIFICATION)
//     try {
//       const userTokens = await UserFcmToken.findAll({
//         where: { userId: order.studentId },
//       });

//       console.log(`🔍 Found ${userTokens.length} FCM tokens for user ${order.studentId}`);

//       if (userTokens.length > 0) {
//         const tokens = userTokens.map((t) => t.fcmToken);

//         console.log("📤 Sending FCM notification to tokens:", tokens);

//         const response = await admin.messaging().sendEachForMulticast({
//           tokens,
//           notification: {
//             title: "📦 Order Update",
//             body: `Your order is now ${order.status}`,
//           },
//           data: {
//             orderId: String(order.id),
//             status: order.status,
//             etaMinutes: String(order.etaMinutes || 0),
//           },
//           android: {
//             priority: "high",
//             notification: {
//               channelId: "high_importance_channel",
//             },
//           },
//         });

//         console.log(`✅ FCM sent successfully. Success: ${response.successCount}, Failure: ${response.failureCount}`);

//         // Remove invalid tokens
//         if (response.failureCount > 0) {
//           const invalidTokens = response.responses
//             .map((resp, idx) => (!resp.success ? tokens[idx] : null))
//             .filter(Boolean);

//           if (invalidTokens.length > 0) {
//             console.log("🗑️ Removing invalid tokens:", invalidTokens);
//             await UserFcmToken.destroy({
//               where: { fcmToken: invalidTokens },
//             });
//           }
//         }
//       } else {
//         console.log(`⚠️ No FCM tokens found for user: ${order.studentId}`);
//       }
//     } catch (fcmError) {
//       console.error("❌ FCM Error (Non-blocking):", fcmError.message);
//       // Don't fail the entire request if FCM fails
//     }

//     return res.json({
//       success: true,
//       message: `Order status updated to ${status}`,
//       order,
//     });
//   } catch (err) {
//     console.error("❌ updateOrderStatus Error:", err);
//     return res.status(500).json({ success: false, message: "Failed to update status" });
//   }
// };

// /**
//  * ===============================
//  * GET CAFETERIA STATIC QR
//  * ===============================
//  */


// /**
//  * ===============================
//  * MARK ORDER PAID
//  * ===============================
//  */
// export const markOrderPaid = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const order = await Order.findByPk(orderId);

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     await order.update({ status: "PAID" });

//     return res.json({ success: true, message: "Order marked as PAID" });
//   } catch (err) {
//     return res
//       .status(500)
//       .json({ success: false, message: "Payment update failed" });
//   }
// };

// /**
//  * ===============================
//  * GET ADMIN DASHBOARD STATS
//  * ===============================
//  */
// export const getAdminStats = async (req, res) => {
//   try {
//     const { range = "daily" } = req.query;
//     const cafeteriaId = req.user?.cafeteriaId;

//     if (!cafeteriaId) {
//       return res.json({
//         totalRevenue: 0,
//         totalOrders: 0,
//         totalCustomers: 0,
//         pendingOrders: 0,
//         avgOrderValue: 0,
//       });
//     }

//     let dateFilter = {};
//     const now = new Date();

//     if (range === "daily") {
//       const startOfDay = new Date(
//         now.getFullYear(),
//         now.getMonth(),
//         now.getDate()
//       );
//       dateFilter = { createdAt: { [Op.gte]: startOfDay } };
//     } else if (range === "weekly") {
//       const startOfWeek = new Date(now);
//       startOfWeek.setDate(now.getDate() - now.getDay());
//       startOfWeek.setHours(0, 0, 0, 0);
//       dateFilter = { createdAt: { [Op.gte]: startOfWeek } };
//     } else if (range === "monthly") {
//       const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//       dateFilter = { createdAt: { [Op.gte]: startOfMonth } };
//     }

//     const orders = await Order.findAll({
//       where: {
//         cafeteriaId,
//         paymentStatus: "SUCCESS",
//         status: { [Op.in]: ["PAID", "PREPARING", "READY", "PICKED_UP"] },
//         ...dateFilter,
//       },
//       attributes: ["totalAmount", "status", "studentId"],
//     });

//     const totalOrders = orders.length;

//     const totalRevenue = orders.reduce(
//       (sum, order) => sum + (Number(order.totalAmount) || 0),
//       0
//     );

//     // 👥 TOTAL CUSTOMERS (UNIQUE STUDENTS)
//     const uniqueCustomers = new Set(
//       orders.map((order) => order.studentId).filter(Boolean)
//     );
//     const totalCustomers = uniqueCustomers.size;

//     const pendingOrders = orders.filter(
//       (o) => o.status === "PAID" || o.status === "PREPARING"
//     ).length;

//     const avgOrderValue =
//       totalOrders > 0 ? totalRevenue / totalOrders : 0;

//     return res.json({
//       totalRevenue: Number(totalRevenue.toFixed(2)),
//       totalOrders,
//       totalCustomers,
//       pendingOrders,
//       avgOrderValue: Number(avgOrderValue.toFixed(2)),
//     });
//   } catch (error) {
//     console.error("❌ getAdminStats error:", error);
//     return res.json({
//       totalRevenue: 0,
//       totalOrders: 0,
//       totalCustomers: 0,
//       pendingOrders: 0,
//       avgOrderValue: 0,
//     });
//   }
import { sequelize, Order, OrderItem, UserFcmToken, User, MenuItem, Cafeteria, OrderFeedback } from "../models/index.js";
import { QueryTypes, Op } from "sequelize";
import { emitNewOrder, emitOrderStatusToUser, emitAdminOrderUpdate, emitOrderStatusToPartner, emitStockUpdate } from "../socket.js";
import admin from "../config/firebaseAdmin.js";
import { sendBatchNotifications } from "../utils/notificationUtils.js";
import { statsCacheGet, statsCacheSet, clearAnalyticsCache, CACHE_KEYS } from "../utils/cache.js";
import { updateOrderStatusInSheet } from "../utils/googleSheets.js";

import { generateBillId, generateDailyOrderNumber, generateKotNumber, generateTotalOrderNumber, generateDeliveryOrderId } from "./paymentController.js";
import { appendOrderToSheet } from "../utils/googleSheets.js";

console.log("--------------------------------------------------");
console.log("✅ LOADED: adminOrderController.js (Static QR Mode)");
console.log("--------------------------------------------------");

/**
 * ===============================
 * CREATE MANUAL ORDER (CASH)
 * ===============================
 */
export const createManualOrder = async (req, res) => {
  console.log("🚀 [POS] createManualOrder hit. Body:", JSON.stringify(req.body));
  const t = await sequelize.transaction();
  try {
    const { items, totalAmount, isParcel, parcelAmount, gstAmount, platformFee, commissionAmount, customerName } = req.body;
    const cafeteriaId = req.user.cafeteriaId;
    console.log(`🚀 [POS] CafeteriaId: ${cafeteriaId}, Total: ${totalAmount}, Customer: ${customerName}`);

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "No items provided" });
    }

    // 1. Get or Create a "Walk-in" User for this order
    // We use a special email for all manual orders
    const [walkinUser] = await User.findOrCreate({
      where: { email: `walkin_${cafeteriaId}@velish.com` },
      defaults: {
        name: "Walk-in Customer",
        role: "student",
      },
      transaction: t,
    });

    // 2. Generate required numbers
    const billId = await generateBillId(cafeteriaId, t);
    const kotNumber = await generateKotNumber(cafeteriaId, t);
    const dailyOrderNumber = await generateDailyOrderNumber(cafeteriaId, t);
    const totalOrderNumber = await generateTotalOrderNumber(t);

    // 3. Create Order
    const order = await Order.create(
      {
        billId,
        studentId: walkinUser.id,
        cafeteriaId,
        totalAmount,
        status: "PREPARING",
        paymentStatus: "SUCCESS",
        paymentMethod: "CASH",
        kotNumber,
        dailyOrderNumber,
        totalOrderNumber,
        isParcel: Boolean(isParcel),
        parcelAmount: Number(parcelAmount) || 0,
        gstAmount: Number(gstAmount) || 0,
        platformFee: Number(platformFee) || 0,
        commissionAmount: Number(commissionAmount) || 0,
        orderType: req.body.orderType || 'DINE_IN',
      },
      { transaction: t }
    );

    // 4. Create Order Items (include menuItemId for stock tracking)
    // 📂 FETCH CATEGORIES: For Printer Splitting
    const orderItems = await Promise.all(items.map(async (item) => {
      const miId = item.id || item.menuItemId || null;
      let category = item.category || null;

      if (miId && !category) {
        const mi = await MenuItem.findByPk(miId, { transaction: t });
        category = mi?.category || null;
      }

      return {
        orderId: order.id,
        menuItemId: miId,
        name: item.name,
        quantity: item.quantity,
        priceAtOrder: item.price,
        imageUrl: item.imageUrl,
        isParcel: item.isParcel || false,
        specialInstructions: item.specialInstructions || item.note || null,
        category: category, // 📂 Essential for printing
      };
    }));

    await OrderItem.bulkCreate(orderItems, { transaction: t });

    // 5. ✅ DEDUCT STOCK — collect zero-stock items, emit AFTER commit
    const zeroStockItems = [];
    for (const item of orderItems) {
      if (!item.menuItemId) continue;

      const menuItem = await MenuItem.findByPk(item.menuItemId, { transaction: t });
      if (!menuItem) continue;

      const newStock = Math.max(0, menuItem.stock - item.quantity);
      console.log(`📦 [STOCK] Manual order: ${menuItem.name} ${menuItem.stock} → ${newStock}`);

      const updates = { stock: newStock };
      if (newStock === 0) {
        console.log(`📉 [STOCK] ${menuItem.name} hit 0 — will emit after commit`);
        zeroStockItems.push({ id: menuItem.id, name: menuItem.name });
      }

      await menuItem.update(updates, { transaction: t });
    }

    await t.commit();

    // 🔔 Emit STOCK alerts AFTER commit — DB is now saved, Flutter alert won't race with Navigator.pop
    for (const item of zeroStockItems) {
      console.log(`📢 [STOCK] Emitting STOCK_UPDATE for: ${item.name}`);
      emitStockUpdate(cafeteriaId, {
        menuItemId: item.id,
        name: item.name,
        stock: 0,
        reason: "OUT_OF_STOCK",
        message: `🚨 ${item.name} is now out of stock!`,
      });
    }

    // 6. Invalidate Cache
    await clearAnalyticsCache(cafeteriaId);

    // 7. Real-time update to Admin Dashboard (split screen)
    emitNewOrder(cafeteriaId, {
      id: order.id,
      orderId: order.id,
      billId: order.billId,
      kotNumber: order.kotNumber,
      dailyOrderNumber: order.dailyOrderNumber,
      status: "PREPARING",
      customerName: customerName || "Walk-in Customer",
      totalAmount: order.totalAmount,
      netAmount: Number(order.totalAmount) - Number(order.platformFee || 0) - Number(order.commissionAmount || 0),
      createdAt: order.createdAt,
      isParcel: order.isParcel,
      orderType: order.orderType,
      deliveryAddress: order.deliveryAddress,
      latitude: order.latitude,
      longitude: order.longitude,
      readyReminderCount: 0,
      items: orderItems,
    });

    // 7. Sync to Google Sheets (Async)
    appendOrderToSheet({
      id: order.id,
      billId: order.billId,
      studentId: order.studentId,
      customerName: customerName || "Walk-in Customer",
      cafeteriaId: order.cafeteriaId,
      totalAmount: order.totalAmount,
      platformFee: order.platformFee,
      gstAmount: order.gstAmount,
      commissionAmount: order.commissionAmount,
      isParcel: order.isParcel,
      parcelAmount: order.parcelAmount,
      items: items,
      status: order.status,
      paymentStatus: order.paymentStatus,
      kotNumber: order.kotNumber,
      dailyOrderNumber: order.dailyOrderNumber,
      createdAt: order.createdAt,
    }).catch((err) => console.error("⚠️ Sheets sync error for manual order:", err.message));

    // Construct full order object for printer (matching Flutter model)
    const orderForPrinter = {
      id: order.id,
      billId: order.billId,
      cafeteriaId: order.cafeteriaId,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      kotNumber: order.kotNumber,
      dailyOrderNumber: order.dailyOrderNumber,
      totalOrderNumber: order.totalOrderNumber,
      isParcel: order.isParcel,
      parcelAmount: order.parcelAmount,
      gstAmount: order.gstAmount,
      platformFee: order.platformFee,
      commissionAmount: order.commissionAmount,
      customerName: customerName || "Walk-in Customer",
      createdAt: order.createdAt,
      items: orderItems,
    };

    return res.status(201).json({
      success: true,
      message: "Manual order placed successfully",
      order: orderForPrinter,
      orderId: order.id,
      billId: order.billId,
      kotNumber: order.kotNumber,
    });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    console.error("❌ CREATE MANUAL ORDER ERROR:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error", 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * ===============================
 * GET ADMIN ORDERS
 * ===============================
 */
export const getAdminOrders = async (req, res) => {
  try {
    const { status, from, to, paymentMethod } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    // Handle multiple statuses (comma-separated or single)
    let statusCondition = 'orders.status = :status';
    let replacements = { status: status || 'PAID', cafeteriaId };

    if (status && status.includes(',')) {
      const statusArray = status.split(',').map(s => s.trim());
      statusCondition = 'orders.status IN (:statusArray)';
      replacements = { statusArray, cafeteriaId };
    }

    // Optional date range filter
    const dateClause = (from && to)
      ? `AND orders."created_at" BETWEEN :from AND :to`
      : from
      ? `AND orders."created_at" >= :from`
      : '';
    if (from) replacements.from = from;
    if (to) replacements.to = to;

    // Optional payment method filter
    const pmClause = (paymentMethod && ['ONLINE', 'CASH'].includes(paymentMethod.toUpperCase()))
      ? `AND orders."payment_method" = :paymentMethod`
      : '';
    if (pmClause) replacements.paymentMethod = paymentMethod.toUpperCase();

    const orders = await sequelize.query(
      `
              SELECT orders.id,
              orders."cashfreeorderid" AS "cashfreeOrderId",
              orders."billid" AS "billId",
              orders."studentid" AS "studentId",
              orders."cafeteriaid" AS "cafeteriaId",
              orders."totalamount" AS "totalAmount",
              orders.status,
              orders."paymentstatus" AS "paymentStatus",
              orders."payment_method" AS "paymentMethod",
              orders."etaminutes" AS "etaMinutes",
              orders."kotnumber" AS "kotNumber",
              orders."israted" AS "isRated",
              orders."isparcel" AS "isParcel",
              orders."parcelamount" AS "parcelAmount",
              orders."platform_fee" AS "platformFee",
              orders."gst_amount" AS "gstAmount",
              orders."created_at" AS "createdAt",
              orders."updated_at" AS "updatedAt",
              orders."picked_up_at" AS "pickedUpAt",
              orders."commission_amount" AS "commissionAmount",
              orders."daily_order_number" AS "dailyOrderNumber",
              orders."total_order_number" AS "totalOrderNumber",
              orders."ready_reminder_count" AS "readyReminderCount",
              orders."order_type" AS "orderType",
              orders."delivery_order_id" AS "deliveryOrderId",
              orders."delivery_address" AS "deliveryAddress",
              orders."latitude" AS "latitude",
              orders."longitude" AS "longitude",
              orders."delivery_charge" AS "deliveryCharge",
              (orders."totalamount" - (orders."totalamount" * 0.0195 * 1.18) - COALESCE(orders."commission_amount", 0)) AS "netAmount",

              users.name AS "customerName"
       FROM orders
       LEFT JOIN users ON users.id = orders."studentid"
       WHERE ${statusCondition}
       AND orders."cafeteriaid" = :cafeteriaId
       ${dateClause}
       ${pmClause}
       ORDER BY orders."created_at" DESC
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );

    if (orders.length > 0) {
      console.log(`📡 [FETCH] Order #${orders[0].id} keys:`, Object.keys(orders[0]));
      console.log(`📡 [FETCH] Returned ${orders.length} orders. First order type: ${orders[0].orderType}, address: ${orders[0].deliveryAddress}`);
    }


    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map((o) => o.id);

    const allItems = await sequelize.query(
      `SELECT oi.id,
              oi."orderid" AS "orderId",
              oi."name",
              oi."imageurl" AS "imageUrl",
              oi."quantity",
              oi."priceatorder" AS "priceAtOrder",
              oi."isparcel" AS "isParcel",
              oi."special_instructions" AS "specialInstructions",
              mi.category AS "category"
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.menuitemid
       WHERE oi."orderid" IN (:ids)`,
      {
        replacements: { ids: orderIds },
        type: QueryTypes.SELECT,
      }
    );

    const combinedData = orders.map((order) => ({
      ...order,
      items: allItems.filter((item) => item.orderId === order.id),
    }));

    return res.json(combinedData);
  } catch (err) {
    console.error("🔥 getAdminOrders Error:", err);
    return res.status(500).json({ message: "Error fetching orders" });
  }
};
/**
 * ===============================
 * UPDATE ORDER STATUS
 * ===============================
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, etaMinutes } = req.body;

    if (status) status = status.toUpperCase();

    const order = await Order.findByPk(id, {
      include: [{ model: User }, { model: Cafeteria, as: "Cafeteria" }]
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const userName = order.User?.name || "User";

    // 🔔 Prepare update object
    const updateData = {
      status,
      etaMinutes,
    };

    // ✅ Generate deliveryOrderId if accepted (PREPARING) and not yet generated
    if (["PREPARING", "ACCEPTED", "READY"].includes(status) && order.orderType === "DELIVERY" && !order.deliveryOrderId) {
      updateData.deliveryOrderId = await generateDeliveryOrderId(order.cafeteriaId, null);
      console.log(`📦 Generated Delivery Order ID: ${updateData.deliveryOrderId}`);
    }

    // ✅ Reset notification flags when order becomes READY
    // This ensures notifications work correctly for the new READY timestamp
    if (status === "READY") {
      updateData.tenMinReminderSent = false;
      updateData.expirationNotificationSent = false;
      updateData.readyReminderCount = 1; // 🚩 Mark as ready persistently
      console.log(`🔔 Resetting notification flags and marking READY persistently for Order #${id}`);
    }

    // ✅ Set pickedUpAt timestamp
    if (status === "PICKED_UP") {
      updateData.pickedUpAt = new Date();
      console.log(`🚚 Setting Picked Up timestamp for Order #${id}`);
    }

    await order.update(updateData);
    
    // 📊 GOOGLE SHEETS DYNAMIC UPDATE
    updateOrderStatusInSheet(order.id, status).catch(err => 
       console.error("⚠️ Sheets dynamic update error:", err.message)
    );

    console.log(`📝 Order ${order.id} updated to status: ${status}`);

    // 🔔 REALTIME → ADMIN (SOCKET)
    // 🧺 Fetch items to include in socket payload for "Instant Injection"
    const items = await sequelize.query(
      `SELECT oi.id,
              oi."orderid" AS "orderId",
              oi."name",
              oi."imageurl" AS "imageUrl",
              oi."quantity",
              oi."priceatorder" AS "priceAtOrder",
              oi."isparcel" AS "isParcel",
              mi.category AS "category"
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id = oi.menuitemid
       WHERE oi."orderid" = :orderId`,
      {
        replacements: { orderId: order.id },
        type: QueryTypes.SELECT
      }
    );

    // 🧺 Parse isParcel correctly for items
    const parsedItems = items.map(item => ({
      ...item,
      isParcel: item.isParcel === true || item.isParcel === 1
    }));


    emitAdminOrderUpdate(order.cafeteriaId, {
      id: order.id,
      orderId: order.id,
      status: order.status,
      etaMinutes: order.etaMinutes,
      updatedAt: new Date(),
      cafeteriaId: order.cafeteriaId,
      totalAmount: order.totalAmount,
      kotNumber: order.kotNumber,
      billId: order.billId,
      createdAt: order.createdAt,
      isParcel: order.isParcel,
      parcelAmount: order.parcelAmount,
      netAmount: Number(order.totalAmount) - (Number(order.totalAmount) * 0.0195 * 1.18) - Number(order.commissionAmount || 0),
      dailyOrderNumber: order.dailyOrderNumber,
      items: parsedItems,
      customerName: userName,
      readyReminderCount: order.readyReminderCount,
      pickedUpAt: order.pickedUpAt,
      orderType: order.orderType,
      deliveryOrderId: order.deliveryOrderId,
      deliveryAddress: order.deliveryAddress,
      latitude: order.latitude,
      longitude: order.longitude,
      deliveryCharge: order.deliveryCharge,
    });
    console.log("✅ Admin notification sent via emitAdminOrderUpdate");

    // 🔔 REALTIME → USER (SOCKET)
    emitOrderStatusToUser(order.studentId, {
      orderId: order.id,
      status: order.status,
      etaMinutes: order.etaMinutes,
      updatedAt: new Date(),
    });
    console.log("✅ User socket notification sent");

    // 🔔 REALTIME → PARTNER (SOCKET)
    if (order.deliveryPartnerId) {
      emitOrderStatusToPartner(order.deliveryPartnerId, {
        orderId: order.id,
        status: order.status,
        readyReminderCount: order.readyReminderCount,
        deliveryOrderId: order.deliveryOrderId,
        updatedAt: new Date(),
      });
      console.log("✅ Partner socket notification sent");
    }

    // 🔔 FCM → USER (BACKGROUND - PREPARING, READY, COMPLETED, CANCELLED)
    if (status === "PREPARING" || status === "READY" || status === "COMPLETED" || status === "CANCELLED") {
      (async () => {
        try {
          const userTokens = await UserFcmToken.findAll({
            where: { userId: order.studentId },
            order: [['updatedAt', 'DESC']],
            limit: 3
          });
 
          if (userTokens.length > 0) {
            const trackSnaps = {
              "PREPARING": "https://udaya-food-app-images.s3.ap-south-1.amazonaws.com/assets/track_in_prep_v3.png",
              "READY": "https://udaya-food-app-images.s3.ap-south-1.amazonaws.com/assets/track_ready_v3.png",
              "COMPLETED": "https://udaya-food-app-images.s3.ap-south-1.amazonaws.com/assets/track_ready_v3.png"
            };
 
            const notificationImageUrl = trackSnaps[status] || (parsedItems.length && parsedItems[0].imageUrl ? parsedItems[0].imageUrl : undefined);
            
            let titleText = "";
            let bodyText = "";
 
            if (status === "PREPARING") {
              titleText = "👨‍🍳 Order Preparing...";
              bodyText = `Order #${order.dailyOrderNumber ?? order.id} is being prepared.`;
            } else if (status === "READY") {
              if (order.orderType === "DELIVERY") {
                titleText = "✅ Order Ready!";
                bodyText = `Your order is prepared. A delivery partner is being assigned.`;
              } else {
                const buffer = order.Cafeteria?.bufferTime || 20;
                titleText = `✅ Ready! (Pick up in ${buffer}m)`;
                bodyText = `Pick up soon or order cancels (No Refund).`;
              }
            } else if (status === "COMPLETED") {
              titleText = "🍽️ Order Completed!";
              bodyText = `Hope you enjoyed your meal! Order #${order.dailyOrderNumber ?? order.id} has been completed.`;
            } else if (status === "CANCELLED") {
              titleText = "❌ Order Cancelled";
              bodyText = `Order #${order.dailyOrderNumber ?? order.id} has been cancelled by the cafeteria.`;
            }

            const bufferMinutes = order.Cafeteria?.bufferTime || 20;
            const expiryTimestamp = Date.now() + (bufferMinutes * 60 * 1000);
            const expiryTimeISO = new Date(expiryTimestamp).toISOString();

            const messages = userTokens.map(ut => ({
              token: ut.fcmToken,
              // 🚨 REMOVED top-level 'notification' to prevent OS-level truncation.
              // This is now a "Data-Only" message. The app will handle display.
              data: {
                title: titleText,
                body: bodyText,
                orderId: String(order.id),
                status: order.status,
                type: "ORDER_STATUS_UPDATE",
                image: notificationImageUrl || "",
                expiryTimestamp: (status === "READY" && order.orderType !== "DELIVERY") ? String(expiryTimestamp) : "",
                expiryTimeISO: (status === "READY" && order.orderType !== "DELIVERY") ? expiryTimeISO : "",
              },
              android: {
                priority: "high",
                // 🛠️ data messages don't use android.notification
              },
              apns: {
                payload: {
                  aps: {
                    sound: "default",
                    badge: 1,
                    mutableContent: notificationImageUrl ? true : false,
                    contentAvailable: true, // 🚨 Required for background 'data' messages on iOS
                    category: 'ORDER_UPDATE'
                  }
                },
                fcmOptions: {
                  imageUrl: notificationImageUrl
                }
              }
            }));

            try {
              const response = await sendBatchNotifications(messages, userTokens);
              console.log(`✅ FCM (${status}) Batch sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);
            } catch (batchError) {
              console.error("❌ FCM Batch Send Error:", batchError.message);
            }
          } else {
            console.warn(`⚠️ No FCM token found for User ${order.studentId} (${userName})`);
          }
        } catch (fcmError) {
          console.error("❌ FCM Setup Error:", fcmError.message);
        }
      })();
    }

    // ⏰ Scheduled READY reminders are handled by notificationScheduler.js (Cron)
    // No redundant setTimeout here to prevent duplicates

    // 🗑️ INVALIDATE ANALYTICS/STATS CACHE
    await clearAnalyticsCache(order.cafeteriaId);

    // ✅ Re-fetch full order for response to ensure ALL metadata is included
    const updatedOrder = await Order.findByPk(id, {
      include: [
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem', attributes: ['name'] }]
        },
        { model: User, attributes: ['id', 'name', 'phone'] },
        { model: Cafeteria, as: 'Cafeteria', attributes: ['id', 'name', 'phone', 'latitude', 'longitude'] }
      ]
    });

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: updatedOrder,
    });
  } catch (err) {
    console.error("❌ updateOrderStatus Error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

/**
 * ===============================
 * SEND READY REMINDER (Follow-up)
 * ===============================
 */
export const sendReadyReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [{ model: User }]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 🛡️ GUARDIANS
    if (order.status !== "READY") {
      return res.status(400).json({ 
        success: false, 
        message: "Notifications can only be sent for READY orders." 
      });
    }

    if (order.readyReminderCount >= 2) {
      return res.status(400).json({ 
        success: false, 
        message: "Maximum limit (2) for ready reminders reached for this order." 
      });
    }

    // 🔔 Send FCM notification
    const userTokens = await UserFcmToken.findAll({
      where: { userId: order.studentId },
      order: [['updatedAt', 'DESC']],
      limit: 3
    });

    if (userTokens.length > 0) {
      const titleText = "🍽️ Ready for Pickup!";
      const bodyText = "Your order is ready—please pick it up promptly!";
      const tokens = userTokens.map(ut => ut.fcmToken);

      await admin.messaging().sendEach(userTokens.map(ut => ({
        token: ut.fcmToken,
        notification: {
          title: titleText,
          body: bodyText,
        },
        data: {
          title: titleText,
          body: bodyText,
          orderId: String(order.id),
          status: order.status,
          type: "ORDER_STATUS_UPDATE", // Reuse existing handler for UI navigation
        },
        android: {
          priority: "high",
          notification: {
            channelId: "high_importance_channel",
            sound: "default",
            defaultSound: true,
            defaultVibrateTimings: true,
            tag: `order_${order.id}_ready`, // Deduplicate locally
          }
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              category: "ORDER_READY"
            }
          }
        }
      })));

      // 📈 Increment reminder count
      await order.update({ readyReminderCount: order.readyReminderCount + 1 });

      console.log(`🔔 Ready reminder #${order.readyReminderCount} sent for Order #${id}`);

      return res.json({ 
        success: true, 
        message: "Reminder sent successfully",
        readyReminderCount: order.readyReminderCount
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: "No active device tokens found for this user." 
      });
    }
  } catch (err) {
    console.error("❌ sendReadyReminder error:", err);
    return res.status(500).json({ success: false, message: "Failed to send reminder" });
  }
};

/**
 * ===============================
 * MARK ORDER PAID
 * ===============================
 */
export const markOrderPaid = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 🛡️ PROTECT: Don't reset status if the order has already been acted on
    const protectedStatuses = ["PREPARING", "READY", "PICKED_UP", "EXPIRED", "CANCELLED", "REFUND_INITIATED", "REFUND_SUCCESS"];
    if (protectedStatuses.includes(order.status)) {
      console.log(`🛡️ markOrderPaid: Order ${orderId} is already ${order.status}. Skipping reset to PAID.`);
      return res.json({ success: true, message: `Order is already ${order.status}. Status not changed.` });
    }

    await order.update({ status: "PAID" });

    // 📊 GOOGLE SHEETS DYNAMIC UPDATE
    updateOrderStatusInSheet(orderId, "PAID").catch(err => 
        console.error("⚠️ Sheets mark paid update error:", err.message)
    );

    // 🗑️ INVALIDATE ANALYTICS/STATS CACHE
    await clearAnalyticsCache(order.cafeteriaId);

    return res.json({ success: true, message: "Order marked as PAID" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Payment update failed" });
  }
};

/**
 * ===============================
 * GET ADMIN DASHBOARD STATS
 * ===============================
 */
export const getAdminStats = async (req, res) => {
  try {
    const { range = "daily", from, to, paymentMethod } = req.query;
    const cafeteriaId = req.user?.cafeteriaId;

    if (!cafeteriaId) {
      return res.json({
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        pendingOrders: 0,
        avgOrderValue: 0,
      });
    }

    // ✅ CHECK REDIS CACHE (key includes payment method so results are cached separately)
    const pmSuffix = paymentMethod && ["ONLINE","CASH"].includes(paymentMethod.toUpperCase())
      ? paymentMethod.toUpperCase() : "all";
    const cacheKey = CACHE_KEYS.ADMIN_STATS(cafeteriaId, `${range}_${from || ''}_${to || ''}_${pmSuffix}`);
    const cached = await statsCacheGet(cacheKey);
    if (cached) return res.json(cached);

    let dateFilter = {};

    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    // ✅ FIX: Support custom date ranges with inclusive IST time boundaries
    // The 'from'/'to' params are IST date strings (e.g. "2026-04-01").
    // We must compute IST midnight (= UTC midnight minus 5h30m) as the boundary.
    if (from || to) {
      let startUTC = null;
      let endUTC   = null;

      if (from) {
        // IST midnight of the 'from' date = UTC midnight − 5h30m
        const [fy, fm, fd] = from.split('-').map(Number);
        startUTC = new Date(Date.UTC(fy, fm - 1, fd) - IST_OFFSET_MS); // 18:30 UTC prev day
      }

      if (to) {
        // End of IST day = next IST midnight minus 1ms
        const [ty, tm, td] = to.split('-').map(Number);
        endUTC = new Date(Date.UTC(ty, tm - 1, td + 1) - IST_OFFSET_MS - 1); // 18:29:59.999 UTC
      } else if (from) {
        // Single day: same as from
        const [fy, fm, fd] = from.split('-').map(Number);
        endUTC = new Date(Date.UTC(fy, fm - 1, fd + 1) - IST_OFFSET_MS - 1);
      }

      if (startUTC && endUTC) {
        dateFilter = { createdAt: { [Op.between]: [startUTC, endUTC] } };
      } else if (startUTC) {
        dateFilter = { createdAt: { [Op.gte]: startUTC } };
      } else if (endUTC) {
        dateFilter = { createdAt: { [Op.lte]: endUTC } };
      }
    } else {
      // Use range-based filtering in IST (UTC+5:30)
      const nowIST = new Date(Date.now() + IST_OFFSET_MS);
      const istYear = nowIST.getUTCFullYear();
      const istMonth = nowIST.getUTCMonth();
      const istDate = nowIST.getUTCDate();

      if (range === "daily") {
        // Midnight IST as UTC timestamp
        const startOfDay = new Date(Date.UTC(istYear, istMonth, istDate) - IST_OFFSET_MS);
        dateFilter = { createdAt: { [Op.gte]: startOfDay } };
      } else if (range === "weekly") {
        // Last 7 days (Today + 6 previous days)
        const startOfWeek = new Date(Date.UTC(istYear, istMonth, istDate - 6) - IST_OFFSET_MS);
        dateFilter = { createdAt: { [Op.gte]: startOfWeek } };
      } else if (range === "monthly") {
        const startOfMonth = new Date(Date.UTC(istYear, istMonth, 1) - IST_OFFSET_MS);
        dateFilter = { createdAt: { [Op.gte]: startOfMonth } };
      }
      // "all" range has no date filter
    }

    // ✅ Build payment method filter
    const pmFilter = paymentMethod && ["ONLINE","CASH"].includes(paymentMethod.toUpperCase())
      ? { paymentMethod: paymentMethod.toUpperCase() } : {};

    const orders = await Order.findAll({
      where: {
        cafeteriaId,
        paymentStatus: "SUCCESS",
        status: { [Op.in]: ["PAID", "PREPARING", "READY", "PICKED_UP"] },
        ...dateFilter,
        ...pmFilter,
      },
      attributes: ["totalAmount", "platformFee", "commissionAmount", "status", "studentId", "createdAt"],
    });

    const totalOrders = orders.length;

    // 💰 BREAKDOWN TOTALS (Selected Range)
    let totalCashfreeCharges = 0;
    let totalCashfreeGst = 0;
    let totalCommissions = 0;
    let totalAmountBase = 0;

    orders.forEach(order => {
      const amount = Number(order.totalAmount || 0);
      const commission = Number(order.commissionAmount || 0);
      const cfCharge = amount * 0.0195;
      const cfGst = cfCharge * 0.18;

      totalAmountBase += amount;
      totalCashfreeCharges += cfCharge;
      totalCashfreeGst += cfGst;
      totalCommissions += commission;
    });

    const netRevenue = totalAmountBase - totalCashfreeCharges - totalCashfreeGst - totalCommissions;

    // 📅 TODAY'S CALCULATIONS (IST midnight) — IST_OFFSET_MS already declared above
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const startOfToday = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET_MS);
    const todayOrders = orders.filter(o => new Date(o.createdAt) >= startOfToday);
    
    const grossRevenueToday = todayOrders.reduce((s, o) => s + (Number(o.totalAmount || 0) - Number(o.platformFee || 0)), 0);
    const netRevenueToday = todayOrders.reduce((sum, order) => {
      const amount = Number(order.totalAmount || 0);
      const commission = Number(order.commissionAmount || 0);
      const cfCharge = amount * 0.0195;
      const cfGst = cfCharge * 0.18;
      return sum + (amount - cfCharge - cfGst - commission);
    }, 0);

    // 👥 TOTAL CUSTOMERS
    const uniqueCustomers = new Set(orders.map((order) => order.studentId).filter(Boolean));
    const totalCustomers = uniqueCustomers.size;
    const pendingOrders = orders.filter((o) => o.status === "PAID" || o.status === "PREPARING").length;
    const avgOrderValue = totalOrders > 0 ? (totalAmountBase / totalOrders) : 0;

    const statsResult = {
      totalRevenue: Number(netRevenue.toFixed(3)),
      grossRevenue: Number(totalAmountBase.toFixed(3)),
      netRevenue: Number(netRevenue.toFixed(3)),
      totalCashfreeCharges: Number(totalCashfreeCharges.toFixed(3)),
      totalCashfreeGst: Number(totalCashfreeGst.toFixed(3)),
      totalCommissions: Number(totalCommissions.toFixed(3)),
      grossRevenueToday: Number(grossRevenueToday.toFixed(3)),
      netRevenueToday: Number(netRevenueToday.toFixed(3)),
      totalOrders,
      totalCustomers,
      pendingOrders,
      avgOrderValue: Number(avgOrderValue.toFixed(3)),
    };

    // ✅ SAVE TO REDIS (1 min TTL)
    await statsCacheSet(cacheKey, statsResult);

    return res.json(statsResult);
  } catch (error) {
    console.error("❌ getAdminStats error:", error);
    return res.json({
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      pendingOrders: 0,
      avgOrderValue: 0,
    });
  }
};

/**
 * ===============================
 * GET ADMIN FEEDBACK (Ratings & Comments)
 * ===============================
 */
export const getAdminFeedback = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({
        success: false,
        message: "Cafeteria ID not found in session",
      });
    }

    const { rating, from, to } = req.query;

    const where = { cafeteriaId };

    if (rating) {
      where.rating = rating;
    }

    if (from && to) {
      where.createdAt = {
        [Op.between]: [new Date(from), new Date(to)],
      };
    } else if (from) {
      where.createdAt = { [Op.gte]: new Date(from) };
    } else if (to) {
      where.createdAt = { [Op.lte]: new Date(to) };
    }

    const feedbacks = await OrderFeedback.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Order,
          attributes: ["id", "billId", "totalAmount", "status", "paymentMethod", "dailyOrderNumber", "pickedUpAt", "kotNumber", "createdAt"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: feedbacks,
    });
  } catch (error) {
    console.error("❌ getAdminFeedback error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch feedback",
      error: error.message,
    });
  }
};