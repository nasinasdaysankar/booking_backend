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
// };


import { sequelize, Order, UserFcmToken, User } from "../models/index.js";
import { QueryTypes, Op } from "sequelize";
import { emitNewOrder, emitOrderStatusToUser, emitAdminOrderUpdate } from "../socket.js";
import admin from "../config/firebaseAdmin.js";
import { statsCacheGet, statsCacheSet, clearAnalyticsCache, CACHE_KEYS } from "../utils/cache.js";
import { updateOrderStatusInSheet } from "../utils/googleSheets.js";

console.log("--------------------------------------------------");
console.log("✅ LOADED: adminOrderController.js (Static QR Mode)");
console.log("--------------------------------------------------");

/**
 * ===============================
 * GET ADMIN ORDERS
 * ===============================
 */
export const getAdminOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    // Handle multiple statuses (comma-separated or single)
    let statusCondition = 'orders.status = :status';
    let replacements = { status: status || 'PAID', cafeteriaId };

    if (status && status.includes(',')) {
      const statusArray = status.split(',').map(s => s.trim());
      statusCondition = 'orders.status IN (:statusArray)';
      replacements = { statusArray, cafeteriaId };
    }

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
              (orders."totalamount" - (orders."totalamount" * 0.0195 * 1.18) - COALESCE(orders."commission_amount", 0)) AS "netAmount",
              users.name AS "customerName"
       FROM orders
       LEFT JOIN users ON users.id = orders."studentid"
       WHERE ${statusCondition}
       AND orders."cafeteriaid" = :cafeteriaId
       ORDER BY orders."created_at" DESC
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );


    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map((o) => o.id);

    const allItems = await sequelize.query(
      `SELECT id,
              "orderid" AS "orderId",
              "name",
              "imageurl" AS "imageUrl",
              "quantity",
              "priceatorder" AS "priceAtOrder",
              "isparcel" AS "isParcel"
       FROM order_items WHERE "orderid" IN (:ids)`,
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
      include: [{ model: User }]
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

    // ✅ Reset notification flags when order becomes READY
    // This ensures notifications work correctly for the new READY timestamp
    if (status === "READY") {
      updateData.tenMinReminderSent = false;
      updateData.expirationNotificationSent = false;
      console.log(`🔔 Resetting notification flags for Order #${id} (status: READY)`);
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
      `SELECT id,
              "orderid" AS "orderId",
              "name",
              "imageurl" AS "imageUrl",
              "quantity",
              "priceatorder" AS "priceAtOrder",
              "isparcel" AS "isParcel"
       FROM order_items WHERE "orderid" = :orderId`,
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
      pickedUpAt: order.pickedUpAt,
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

    // 🔔 FCM → USER (BACKGROUND - FIRE & FORGET)
    (async () => {
      try {
        const userTokens = await UserFcmToken.findAll({
          where: { userId: order.studentId },
          order: [['updatedAt', 'DESC']],
          limit: 1
        });

        if (userTokens.length > 0) {
          const token = userTokens[0].fcmToken;

          // Standardize Notification Message
          let bodyText = `Hey ${userName}, your order #${order.dailyOrderNumber ?? order.id} is now ${order.status.toLowerCase()}.`;

          if (order.status === "READY") {
            bodyText = `Hey ${userName}, your order #${order.dailyOrderNumber ?? order.id} is READY! Please pick it up within 20 minutes. Note: No pickup after 20 mins and no refund will be provided.`;
          } else if (order.status === "PREPARING") {
            bodyText = `Hey ${userName}, the cafeteria has accepted your order #${order.dailyOrderNumber ?? order.id} and is now preparing it.`;
          }

          try {
            await admin.messaging().send({
              token,
              notification: {
                title: order.status === "READY" ? "✅ Order Ready!" : "📦 Order Update",
                body: bodyText,
              },
              data: {
                orderId: String(order.id),
                status: order.status,
                type: "ORDER_STATUS_UPDATE",
                etaMinutes: String(order.etaMinutes || 0),
              },
              android: {
                priority: "high",
                notification: {
                  channelId: "high_importance_channel",
                  sound: "default",
                  clickAction: "FLUTTER_NOTIFICATION_CLICK",
                  body: bodyText,
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: "default",
                    badge: 1,
                    alert: {
                      title: order.status === "READY" ? "✅ Order Ready!" : "📦 Order Update",
                      body: bodyText,
                    },
                  }
                }
              }
            });
            console.log(`✅ FCM (${order.status}) sent to User ${order.studentId} (${userName})`);
          } catch (sendError) {
            console.error("❌ FCM individual send error:", sendError.message);
            if (sendError.code === 'messaging/registration-token-not-registered' ||
              sendError.code === 'messaging/invalid-registration-token') {
              await UserFcmToken.destroy({ where: { fcmToken: token } });
              console.log("🗑️ Deleted invalid token");
            }
          }
        } else {
          console.warn(`⚠️ No FCM token found for User ${order.studentId} (${userName})`);
        }
      } catch (fcmError) {
        console.error("❌ FCM Notification Error:", fcmError.message);
      }
    })();

    // ⏰ Scheduled READY reminders are handled by notificationScheduler.js (Cron)
    // No redundant setTimeout here to prevent duplicates

    // 🗑️ INVALIDATE ANALYTICS/STATS CACHE
    await clearAnalyticsCache(order.cafeteriaId);

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order,
    });
  } catch (err) {
    console.error("❌ updateOrderStatus Error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
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
    const { range = "daily", from, to } = req.query;
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

    // ✅ CHECK REDIS CACHE
    const cacheKey = CACHE_KEYS.ADMIN_STATS(cafeteriaId, `${range}_${from || ''}_${to || ''}`);
    const cached = await statsCacheGet(cacheKey);
    if (cached) return res.json(cached);

    let dateFilter = {};

    // ✅ FIX: Support custom date ranges with inclusive time (00:00:00 to 23:59:59)
    if (from || to) {
      // If only 'from' is provided, we treat it as a single day query (from that day start to that day end)
      const startDate = from ? new Date(from) : null;
      if (startDate) startDate.setHours(0, 0, 0, 0);

      const endDate = to ? new Date(to) : (from ? new Date(from) : null);
      if (endDate) endDate.setHours(23, 59, 59, 999);

      if (startDate && endDate) {
        dateFilter = {
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
        };
      } else if (startDate) {
        dateFilter = { createdAt: { [Op.gte]: startDate } };
      } else if (endDate) {
        dateFilter = { createdAt: { [Op.lte]: endDate } };
      }
    } else {
      // Use range-based filtering
      const now = new Date();

      if (range === "daily") {
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        dateFilter = { createdAt: { [Op.gte]: startOfDay } };
      } else if (range === "weekly") {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        dateFilter = { createdAt: { [Op.gte]: startOfWeek } };
      } else if (range === "monthly") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { [Op.gte]: startOfMonth } };
      }
      // "all" range has no date filter
    }

    const orders = await Order.findAll({
      where: {
        cafeteriaId,
        paymentStatus: "SUCCESS",
        status: { [Op.in]: ["PAID", "PREPARING", "READY", "PICKED_UP"] },
        ...dateFilter,
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

    // 📅 TODAY'S CALCULATIONS
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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