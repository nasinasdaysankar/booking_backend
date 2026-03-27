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


import { sequelize, Order, OrderItem, UserFcmToken, User, MenuItem, Cafeteria } from "../models/index.js";
import { QueryTypes, Op } from "sequelize";
import { emitNewOrder, emitOrderStatusToUser, emitAdminOrderUpdate } from "../socket.js";
import admin from "../config/firebaseAdmin.js";
import { statsCacheGet, statsCacheSet, clearAnalyticsCache, CACHE_KEYS } from "../utils/cache.js";
import { updateOrderStatusInSheet } from "../utils/googleSheets.js";

import { generateBillId, generateDailyOrderNumber, generateKotNumber, generateTotalOrderNumber } from "./paymentController.js";
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
      },
      { transaction: t }
    );

    // 4. Create Order Items (include menuItemId for stock tracking)
    const orderItems = items.map((item) => ({
      orderId: order.id,
      menuItemId: item.id || item.menuItemId || null, // ✅ preserve menu item reference
      name: item.name,
      quantity: item.quantity,
      priceAtOrder: item.price,
      imageUrl: item.imageUrl,
      isParcel: item.isParcel || false,
      specialInstructions: item.specialInstructions || item.note || null,
    }));

    await OrderItem.bulkCreate(orderItems, { transaction: t });

    // 5. ✅ DEDUCT STOCK (same policy as online payments — all items treated as stock-tracked)
    for (const item of orderItems) {
      if (!item.menuItemId) continue;

      const menuItem = await MenuItem.findByPk(item.menuItemId, { transaction: t });
      if (!menuItem) continue;

      // Universal stock tracking: treat every item as trackStock = true
      const newStock = Math.max(0, menuItem.stock - item.quantity);
      console.log(`📦 [STOCK] Manual order: ${menuItem.name} ${menuItem.stock} → ${newStock}`);

      const updates = { stock: newStock };
      if (newStock === 0) {
        console.log(`📉 [STOCK] Marking ${menuItem.name} as UNAVAILABLE (stock = 0)`);
        updates.isAvailable = false;
      }

      await menuItem.update(updates, { transaction: t });
    }

    await t.commit();

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
              "isparcel" AS "isParcel",
              "special_instructions" AS "specialInstructions"
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

    // 🔔 FCM → USER (BACKGROUND - ONLY FOR PREPARING AND READY)
    if (status === "PREPARING" || status === "READY") {
      (async () => {
        try {
          const userTokens = await UserFcmToken.findAll({
            where: { userId: order.studentId },
            order: [['updatedAt', 'DESC']],
            limit: 3 // Try up to 3 tokens (multi-device support)
          });

          console.log(`🔍 [FCM] User ${order.studentId} has ${userTokens.length} tokens.`);

          if (userTokens.length > 0) {
            // Send to all available tokens for reliability
            for (const userToken of userTokens) {
              const token = userToken.fcmToken;

              // Status-specific Tracking Snap Images (from S3)
              const trackSnaps = {
                "PREPARING": "https://udaya-food-app-images.s3.ap-south-1.amazonaws.com/assets/track_in_prep.png",
                "READY": "https://udaya-food-app-images.s3.ap-south-1.amazonaws.com/assets/track_ready.png"
              };

              const notificationImageUrl = trackSnaps[status] || (parsedItems.length && parsedItems[0].imageUrl ? parsedItems[0].imageUrl : undefined);

              let bodyText = "";
              let titleText = "";
              
              if (status === "PREPARING") {
                titleText = "👨‍🍳 Order In Prep";
                bodyText = `Your order #${order.dailyOrderNumber ?? order.id} is now being prepared.`;
              } else if (status === "READY") {
                titleText = "✅ Order Ready!";
                bodyText = `Your order #${order.dailyOrderNumber ?? order.id} is ready for pickup!`;
              }

              const sendNotificationWithRetry = async (retries = 3, delay = 1000) => {
                for (let i = 0; i < retries; i++) {
                  try {
                    const payload = {
                      token,
                      notification: {
                        title: titleText,
                        body: bodyText,
                        ...(notificationImageUrl && { imageUrl: notificationImageUrl })
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
                          ...(notificationImageUrl && { imageUrl: notificationImageUrl })
                        },
                      },
                      apns: {
                        payload: {
                          aps: {
                            sound: "default",
                            badge: 1,
                            alert: {
                              title: titleText,
                              body: bodyText,
                            },
                            'mutable-content': notificationImageUrl ? 1 : 0,
                            category: 'ORDER_UPDATE'
                          }
                        },
                        fcmOptions: {
                          imageUrl: notificationImageUrl
                        }
                      }
                    };
                    await admin.messaging().send(payload);
                    console.log(`✅ FCM (${status}) sent to token: ${token.substring(0, 10)}...`);
                    return; // success
                  } catch (sendError) {
                    console.error(`❌ FCM individual send error (Try ${i + 1}/${retries}):`, sendError.message);
                    if (
                      sendError.code === 'messaging/registration-token-not-registered' ||
                      sendError.code === 'messaging/invalid-registration-token'
                    ) {
                      await UserFcmToken.destroy({ where: { fcmToken: token } });
                      console.log("🗑️ Deleted invalid token. Aborting retries.");
                      return; // abort retries
                    }
                    if (i < retries - 1) {
                      await new Promise(r => setTimeout(r, delay * (i + 1))); // exponential backoff
                    }
                  }
                }
                console.error(`🚨 FCM completely failed for token ${token.substring(0, 5)} after ${retries} retries.`);
              };

              await sendNotificationWithRetry();
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