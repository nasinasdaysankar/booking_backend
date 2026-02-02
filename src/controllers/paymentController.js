// ===================================================================
// FILE: controllers/paymentController.js
// Complete refund functions with all fixes
// ===================================================================

import { Payment, Order, OrderItem, sequelize } from "../models/index.js";
import { emitNewOrder } from "../socket.js";
import admin from "../config/firebaseAdmin.js";
import { AdminFcmToken } from "../models/index.js";
import { UserStreak } from "../models/index.js";
import dayjs from "dayjs";

// --------------------------------------------------
// 🆕 HELPER: GENERATE KOT NUMBER (PER CAFETERIA)
// --------------------------------------------------
const generateKotNumber = async (cafeteriaId, transaction) => {
  const [result] = await sequelize.query(
    `
    INSERT INTO kot_counters ("cafeteriaId", "counter")
    VALUES (:cafeteriaId, 1)
    ON CONFLICT ("cafeteriaId")
    DO UPDATE SET "counter" = kot_counters."counter" + 1
    RETURNING "counter";
    `,
    {
      replacements: { cafeteriaId },
      transaction,
    }
  );

  const counter = result[0].counter;
  return `KOT-${cafeteriaId}-${String(counter).padStart(5, "0")}`;
};

// --------------------------------------------------
// 🆕 HELPER: UPDATE USER STREAK
// --------------------------------------------------
async function updateUserStreak(userId, cafeteriaId, transaction) {
  const today = dayjs().format("YYYY-MM-DD");

  let streak = await UserStreak.findOne({
    where: { userId, cafeteriaId },
    transaction,
  });

  if (!streak) {
    await UserStreak.create(
      {
        userId,
        cafeteriaId,
        currentStreak: 1,
        maxStreak: 1,
        lastOrderDate: today,
      },
      { transaction }
    );
    return;
  }

  const lastDate = dayjs(streak.lastOrderDate);
  const diff = dayjs(today).diff(lastDate, "day");

  if (diff === 1) {
    streak.currentStreak += 1;
  } else if (diff > 1) {
    streak.currentStreak = 1;
  } else {
    return;
  }

  streak.lastOrderDate = today;
  streak.maxStreak = Math.max(streak.maxStreak, streak.currentStreak);

  await streak.save({ transaction });
}

// ===================================================================
// ✅ CONFIRM PAYMENT (FROM FLUTTER APP)
// ===================================================================
// export const confirmPayment = async (req, res) => {
//   const t = await sequelize.transaction();

//   try {
//     const {
//       orderId: cashfreeOrderId,
//       billId,
//       cafeteriaId,
//       transactionId,
//       amount,
//       items,
//        isParcel,
//   parcelAmount,
//     } = req.body;

//     const authenticatedStudentId = req.user.id;

//     console.log("💳 Payment confirmation request:", {
//       cashfreeOrderId,
//       billId,
//       cafeteriaId,
//       amount,
//       studentId: authenticatedStudentId,
//     });

//     if (!cashfreeOrderId || !billId || !cafeteriaId || !amount || !transactionId) {
//       await t.rollback();
//       return res.status(400).json({
//         success: false,
//         message: "Missing required payment fields.",
//       });
//     }

//     // Create order first
//     let order = await Order.findOne({
//       where: { cashfreeOrderId },
//       transaction: t,
//       lock: t.LOCK.UPDATE,
//     });

//     let kotNumber = null;

//     if (!order) {
//       kotNumber = await generateKotNumber(cafeteriaId, t);
//       console.log("📝 Creating new order with KOT:", kotNumber);

//       order = await Order.create(
//         {
//           cashfreeOrderId,
//           billId,
//           studentId: authenticatedStudentId,
//           cafeteriaId,
//           totalAmount: amount,
//           status: "PAID",
//           paymentStatus: "SUCCESS",
//           kotNumber,
//            isParcel: Boolean(isParcel),
//     parcelAmount: Number(parcelAmount) || 0,
//         },
//         { transaction: t }
//       );

//       console.log("✅ Order created:", order.id);
//     } else {
//       kotNumber = order.kotNumber;
//       await order.update(
//         {
//           status: "PAID",
//           paymentStatus: "SUCCESS",
//            isParcel: Boolean(isParcel),
//     parcelAmount: Number(parcelAmount) || 0,
//         },
//         { transaction: t }
//       );
//       console.log("✅ Order updated:", order.id);
//     }




//     // Create payment record
//     const existingPayment = await Payment.findOne({
//       where: { cashfreeOrderId },
//       transaction: t,
//     });

//     if (!existingPayment) {
//       console.log("💳 Creating payment record");

//       await Payment.create(
//         {
//           orderId: order.id,
//           billId,
//           cafeteriaId,
//           paymentGateway: "CASHFREE",
//           cashfreeOrderId,
//           transactionId,
//           amount,
//           status: "SUCCESS",
//           paidAt: new Date(),
//           // paymentId will be added by webhook
//         },
//         { transaction: t }
//       );

//       console.log("✅ Payment record created (webhook will add paymentId)");
//     } else {
//       console.log("ℹ️ Payment already exists:", existingPayment.id);
//     }


// // 🔗 LINK WEBHOOK PAYMENT ID (if webhook arrived earlier)
// const [pending] = await sequelize.query(`
//   SELECT payment_id FROM pending_webhooks
//   WHERE cashfree_order_id = :orderId
// `, {
//   replacements: { orderId: cashfreeOrderId },
//   transaction: t
// });

// if (pending.length > 0) {
//   console.log("🔗 Linking stored webhook paymentId:", pending[0].payment_id);

//   await Payment.update(
//     { paymentId: pending[0].payment_id },
//     { where: { cashfreeOrderId }, transaction: t }
//   );

//   await sequelize.query(`
//     DELETE FROM pending_webhooks WHERE cashfree_order_id = :orderId
//   `, {
//     replacements: { orderId: cashfreeOrderId },
//     transaction: t
//   });
// }


//     // Create order items
//     const existingItem = await OrderItem.findOne({
//       where: { orderId: order.id },
//       transaction: t,
//     });

//     if (!existingItem && Array.isArray(items) && items.length > 0) {
//       const itemsToCreate = items.map((item) => ({
//         orderId: order.id,
//         menuItemId: item.menuItemId || item.id || item.menu_item_id || null,
//         name: item.name,
//         quantity: item.quantity || item.qty,
//         priceAtOrder: item.price,
//         imageUrl: item.imageUrl || item.img || null,
//       }));

//       const hasInvalidItem = itemsToCreate.some(
//         (i) => i.quantity === undefined || i.quantity === null || i.quantity === 0
//       );

//       if (hasInvalidItem) {
//         throw new Error("One or more items are missing a valid quantity.");
//       }

//       await OrderItem.bulkCreate(itemsToCreate, { transaction: t });
//       console.log(`✅ Created ${itemsToCreate.length} order items`);
//     }

//     await updateUserStreak(authenticatedStudentId, cafeteriaId, t);
//     await t.commit();

//     console.log("✅ Transaction committed successfully");

//     // Send notifications
//     try {
//       emitNewOrder(cafeteriaId, {
//         orderId: order.id,
//         billId: order.billId,
//         kotNumber: order.kotNumber,
//         totalAmount: order.totalAmount,
//         status: order.status,
//         createdAt: order.createdAt,
//       });

//       const adminTokens = await AdminFcmToken.findAll({
//         where: { cafeteriaId },
//       });

//       if (adminTokens.length > 0) {
//         await admin.messaging().sendEachForMulticast({
//           tokens: adminTokens.map((t) => t.fcmToken),
//           notification: {
//             title: "🍽 New Order Received",
//             body: `KOT ${order.kotNumber} • ₹${order.totalAmount}`,
//           },
//           android: {
//             priority: "high",
//             notification: {
//               channelId: "high_importance_channel",
//             },
//           },
//         });

//         console.log("🔔 FCM notification sent to admins");
//       }
//     } catch (notifyErr) {
//       console.error("⚠️ Notification error (ignored):", notifyErr);
//     }

//     return res.json({
//       success: true,
//       dbOrderId: order.id,
//       billId: order.billId,
//       kotNumber,
//       message: "Payment confirmed successfully. Order sent to cafeteria.",
//     });

//   } catch (err) {
//     if (!t.finished) {
//       await t.rollback();
//     }

//     console.error("❌ CONFIRM PAYMENT ERROR:", err);

//     if (err.name === "SequelizeUniqueConstraintError") {
//       return res.status(400).json({
//         success: false,
//         error: "This transaction has already been processed.",
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       error: err.message,
//     });
//   }
// };
// ===================================================================
// ✅ CONFIRM PAYMENT (FROM FLUTTER APP) - UPDATED WITH PARCEL TRACKING
// ===================================================================
export const confirmPayment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      orderId: cashfreeOrderId,
      billId,
      cafeteriaId,
      transactionId,
      amount,
      items,
      isParcel,
      parcelAmount,
    } = req.body;

    const authenticatedStudentId = req.user.id;

    console.log("💳 Payment confirmation request:", {
      cashfreeOrderId,
      billId,
      cafeteriaId,
      amount,
      studentId: authenticatedStudentId,
      isParcel,
      parcelAmount,
    });

    if (!cashfreeOrderId || !billId || !cafeteriaId || !amount || !transactionId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields.",
      });
    }

    // Create order first
    let order = await Order.findOne({
      where: { cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let kotNumber = null;

    if (!order) {
      kotNumber = await generateKotNumber(cafeteriaId, t);
      console.log("📝 Creating new order with KOT:", kotNumber);

      order = await Order.create(
        {
          cashfreeOrderId,
          billId,
          studentId: authenticatedStudentId,
          cafeteriaId,
          totalAmount: amount,
          status: "PAID",
          paymentStatus: "SUCCESS",
          kotNumber,
          isParcel: Boolean(isParcel),
          parcelAmount: Number(parcelAmount) || 0,
        },
        { transaction: t }
      );

      console.log("✅ Order created:", order.id);
    } else {
      kotNumber = order.kotNumber;
      await order.update(
        {
          status: "PAID",
          paymentStatus: "SUCCESS",
          isParcel: Boolean(isParcel),
          parcelAmount: Number(parcelAmount) || 0,
        },
        { transaction: t }
      );
      console.log("✅ Order updated:", order.id);
    }

    // Create payment record
    const existingPayment = await Payment.findOne({
      where: { cashfreeOrderId },
      transaction: t,
    });

    if (!existingPayment) {
      console.log("💳 Creating payment record");

      await Payment.create(
        {
          orderId: order.id,
          billId,
          cafeteriaId,
          paymentGateway: "CASHFREE",
          cashfreeOrderId,
          transactionId,
          amount,
          status: "SUCCESS",
          paidAt: new Date(),
          // paymentId will be added by webhook
        },
        { transaction: t }
      );

      console.log("✅ Payment record created (webhook will add paymentId)");

      // ===================================================================
      // 🆕 RECORD COMMISSION (PLATFORM FEE)
      // ===================================================================
      const { Commission } = await import("../models/index.js");
      await Commission.create(
        {
          orderId: order.id,
          cafeteriaId,
          amount: 1.00, // Fixed ₹1 Commission
        },
        { transaction: t }
      );
      console.log("💰 Commission of ₹1 recorded for Owner");

    } else {
      console.log("ℹ️ Payment already exists:", existingPayment.id);
    }

    // 🔗 LINK WEBHOOK PAYMENT ID (if webhook arrived earlier)
    const [pending] = await sequelize.query(
      `
      SELECT payment_id FROM pending_webhooks
      WHERE cashfree_order_id = :orderId
    `,
      {
        replacements: { orderId: cashfreeOrderId },
        transaction: t,
      }
    );

    if (pending.length > 0) {
      console.log("🔗 Linking stored webhook paymentId:", pending[0].payment_id);

      await Payment.update(
        { paymentId: pending[0].payment_id },
        { where: { cashfreeOrderId }, transaction: t }
      );

      await sequelize.query(
        `
        DELETE FROM pending_webhooks WHERE cashfree_order_id = :orderId
      `,
        {
          replacements: { orderId: cashfreeOrderId },
          transaction: t,
        }
      );
    }

    // ===================================================================
    // 🧺 CREATE ORDER ITEMS (WITH PARCEL TRACKING PER ITEM)
    // ===================================================================
    const existingItem = await OrderItem.findOne({
      where: { orderId: order.id },
      transaction: t,
    });


    let itemsToCreate = [];

    if (!existingItem && Array.isArray(items) && items.length > 0) {
      console.log("🧺 RAW ITEMS RECEIVED:", JSON.stringify(items, null, 2)); // DEBUG LOG

      itemsToCreate = items.map((item) => {
        const isParcelForThisItem = Boolean(item.isParcelSelected);

        console.log(`🧺 Item: ${item.name}, isParcelSelected: ${item.isParcelSelected}, saved as: ${isParcelForThisItem}`); // DEBUG LOG

        return {
          orderId: order.id,
          menuItemId: item.menuItemId || item.id || item.menu_item_id || null,
          name: item.name,
          quantity: item.quantity || item.qty,
          priceAtOrder: item.price,
          imageUrl: item.imageUrl || item.img || null,
          isParcel: isParcelForThisItem, // 🧺 CRITICAL: Must be explicit boolean
        };
      });

      const hasInvalidItem = itemsToCreate.some(
        (i) => i.quantity === undefined || i.quantity === null || i.quantity === 0
      );

      if (hasInvalidItem) {
        throw new Error("One or more items are missing a valid quantity.");
      }

      await OrderItem.bulkCreate(itemsToCreate, { transaction: t });

      console.log(`✅ Created ${itemsToCreate.length} order items`);

      // 🧺 Log which items have parcel
      const parcelItems = itemsToCreate.filter(i => i.isParcel);
      if (parcelItems.length > 0) {
        console.log(`📦 Items with parcel: ${parcelItems.map(i => i.name).join(', ')}`);
      } else {
        console.log(`📦 No items have parcel packaging`);
      }
    }

    await updateUserStreak(authenticatedStudentId, cafeteriaId, t);
    await t.commit();

    console.log("✅ Transaction committed successfully");

    // Send notifications (ASYNC - Fire & Forget)
    (async () => {
      try {
        emitNewOrder(cafeteriaId, {
          orderId: order.id,
          id: order.id,
          billId: order.billId,
          kotNumber: order.kotNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
          isParcel: order.isParcel,
          parcelAmount: order.parcelAmount,
          items: itemsToCreate,
          customerName: req.user.name || "Customer",
        });

        const adminTokens = await AdminFcmToken.findAll({
          where: { cafeteriaId },
        });

        if (adminTokens.length > 0) {
          const tokens = adminTokens.map((t) => t.fcmToken);

          // 1. Standard New Order Notification
          const standardNotificationResponse = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: "🍽 New Order Received",
              body: `KOT ${order.kotNumber} • ₹${order.totalAmount}`,
            },
            android: {
              priority: "high",
              notification: { channelId: "high_importance_channel" },
            },
          });

          // 2. 🔥 High Traffic Alert (Every 5th pending order after 10)
          const pendingCount = await Order.count({
            where: {
              cafeteriaId,
              status: { [Op.in]: ['PAID', 'PREPARING'] }
            }
          });

          if (pendingCount > 10 && pendingCount % 5 === 0) {
            await admin.messaging().sendEachForMulticast({
              tokens,
              notification: {
                title: "🔥 High Traffic Alert!",
                body: `Warning: ${pendingCount} orders are currently pending.`,
              },
              android: {
                priority: "high",
                notification: { channelId: "high_importance_channel" },
              },
            });
            console.log(`🔥 High Traffic Alert sent (${pendingCount} pending)`);
          }

          console.log(`🔔 FCM sent to admins.`);

          // Clean up invalid tokens
          if (standardNotificationResponse.failureCount > 0) {
            const invalidTokens = [];
            standardNotificationResponse.responses.forEach((resp, idx) => {
              if (!resp.success) invalidTokens.push(adminTokens[idx].fcmToken);
            });
            if (invalidTokens.length > 0) {
              await AdminFcmToken.destroy({ where: { fcmToken: invalidTokens } });
              console.log("Deleted invalid admin tokens:", invalidTokens.length);
            }
          }
        }
      } catch (notifyErr) {
        console.error("⚠️ Notification error (background):", notifyErr);
      }
    })();

    return res.json({
      success: true,
      dbOrderId: order.id,
      billId: order.billId,
      kotNumber,
      message: "Payment confirmed successfully. Order sent to cafeteria.",
    });
  } catch (err) {
    if (!t.finished) {
      await t.rollback();
    }

    console.error("❌ CONFIRM PAYMENT ERROR:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        error: "This transaction has already been processed.",
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
// ===================================================================
// ✅ SYNC FROM WEBHOOK (ROBUST VERSION)
// ===================================================================
export const syncFromWebhook = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    console.log("🔔 [WEBHOOK] Raw body:", JSON.stringify(req.body, null, 2));

    const {
      cashfreeOrderId,
      paymentId,
      orderStatus,
      paymentStatus,
    } = req.body;

    console.log("🔔 [WEBHOOK] Extracted:", {
      cashfreeOrderId,
      paymentId,
      orderStatus,
      paymentStatus,
    });

    // 1️⃣ Validate webhook
    if (!cashfreeOrderId || !paymentId) {
      await t.rollback();
      return res.json({
        success: true,
        message: "Invalid webhook (missing orderId or paymentId)",
      });
    }

    if (paymentStatus !== "SUCCESS") {
      await t.rollback();
      return res.json({
        success: true,
        message: `Ignoring ${paymentStatus} payment`,
      });
    }

    console.log("✅ [WEBHOOK] Processing successful payment");

    // 2️⃣ Try to find payment row
    const payment = await Payment.findOne({
      where: { cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // 3️⃣ If payment not created yet → store in pending_webhooks
    if (!payment) {
      console.log("⚠️ [WEBHOOK] Payment not yet created. Saving webhook.");

      await sequelize.query(
        `
        INSERT INTO pending_webhooks (cashfree_order_id, payment_id)
        VALUES (:orderId, :paymentId)
        ON CONFLICT (cashfree_order_id)
        DO UPDATE SET payment_id = EXCLUDED.payment_id
        `,
        {
          replacements: {
            orderId: cashfreeOrderId,
            paymentId,
          },
          transaction: t,
        }
      );

      await t.commit();

      return res.json({
        success: true,
        message: "Webhook saved. Will be linked when /confirm runs.",
      });
    }

    // 4️⃣ Payment exists → update it
    console.log("🔗 [WEBHOOK] Linking paymentId to payment");

    await payment.update(
      {
        paymentId,
        status: "SUCCESS",
        paidAt: new Date(),
      },
      { transaction: t }
    );

    // 5️⃣ Also mark order paid
    if (payment.orderId) {
      await Order.update(
        {
          status: "PAID",
          paymentStatus: "SUCCESS",
        },
        {
          where: { id: payment.orderId },
          transaction: t,
        }
      );
    }

    await t.commit();

    console.log("✅ [WEBHOOK] Linked successfully");

    return res.json({
      success: true,
      message: "Webhook processed and linked",
      cashfreeOrderId,
      paymentId,
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("❌ [WEBHOOK] Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// ===================================================================
// ✅ CHECK WEBHOOK STATUS (BEFORE REFUND)
// ===================================================================
export const checkWebhookStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔍 Checking webhook status for order: ${orderId}`);

    const payment = await Payment.findOne({
      where: { orderId },
      attributes: ["paymentId", "cashfreeOrderId", "status", "createdAt"],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const hasPaymentId = !!payment.paymentId;
    const waitTime =
      (Date.now() - new Date(payment.createdAt).getTime()) / 1000;

    console.log(
      `📊 Webhook status: ${hasPaymentId ? "RECEIVED" : "PENDING"} (${waitTime.toFixed(2)}s)`
    );

    return res.json({
      success: true,
      webhookReceived: hasPaymentId,
      paymentId: payment.paymentId || null,
      cashfreeOrderId: payment.cashfreeOrderId,
      waitedSeconds: waitTime.toFixed(2),
      message: hasPaymentId
        ? "✅ Ready for refund"
        : `⏳ Webhook pending (${waitTime.toFixed(1)}s elapsed)`,
    });
  } catch (error) {
    console.error("❌ checkWebhookStatus error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ===================================================================
// ✅ REFUND ORDER (MAIN REFUND FUNCTION)
// ===================================================================
export const refundOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const authenticatedAdminId = req.user?.id;

    console.log(
      `🔄 Refund request for order: ${orderId} by admin: ${authenticatedAdminId}`
    );

    // 1️⃣ FETCH ORDER
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log(`📦 Order found:`, {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
    });

    // 2️⃣ CHECK IF ORDER CAN BE REFUNDED
    if (order.status !== "PAID") {
      return res.status(400).json({
        success: false,
        message: `Cannot refund order. Current status is "${order.status}". Only PAID orders can be refunded.`,
      });
    }

    // 3️⃣ FETCH PAYMENT RECORD
    const payment = await Payment.findOne({
      where: { orderId: order.id },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found for this order",
      });
    }

    console.log(`💳 Payment found:`, {
      id: payment.id,
      paymentId: payment.paymentId,
      cashfreeOrderId: payment.cashfreeOrderId,
      status: payment.status,
    });

    // 4️⃣ CHECK IF paymentId EXISTS (WEBHOOK MUST HAVE ARRIVED)
    if (!payment.paymentId) {
      console.log("❌ WEBHOOK NOT RECEIVED YET");
      return res.status(400).json({
        success: false,
        message: "Cannot refund yet - payment webhook not received",
        hint: "Webhook typically arrives within 2-3 seconds. Please try again.",
        receivedPaymentId: null,
        orderCreatedAt: order.createdAt,
      });
    }

    if (!payment.paymentId.startsWith("pay_")) {
      return res.status(400).json({
        success: false,
        message: "Invalid Cashfree paymentId",
        error: "Expected format: pay_xxx",
        storedPaymentId: payment.paymentId,
      });
    }

    // 5️⃣ CALL CASHFREE REFUND API
    console.log(`🔄 Initiating Cashfree refund...`);
    console.log(`   paymentId: ${payment.paymentId}`);
    console.log(`   amount: ₹${order.totalAmount}`);

    const axios = (await import("axios")).default;

    const refundResponse = await axios.post(
      `https://api.cashfree.com/pg/payments/${payment.paymentId}/refunds`,
      {
        refund_amount: Number(order.totalAmount),
        refund_note: `Order #${order.id} declined by cafeteria ${order.cafeteriaId}`,
      },
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Cashfree refund initiated:", refundResponse.data);

    // 6️⃣ EXTRACT REFUND ID FROM RESPONSE
    const refundId = refundResponse.data?.refund?.refund_id;
    const refundStatus = refundResponse.data?.refund?.refund_status;

    if (!refundId) {
      return res.status(500).json({
        success: false,
        message: "Failed to get refund ID from Cashfree",
        details: refundResponse.data,
      });
    }

    console.log(`✅ Refund ID received: ${refundId}`);

    // 7️⃣ UPDATE PAYMENT TABLE
    await Payment.update(
      {
        status: "REFUND_INITIATED",
        refundId: refundId,
        refundedAt: new Date(),
        refundAmount: order.totalAmount,
      },
      { where: { id: payment.id } }
    );

    console.log(`✅ Payment updated with refund info`);

    // 8️⃣ UPDATE ORDER STATUS
    await order.update({
      status: "REFUND_INITIATED",
      refundReason: `Order declined by cafeteria. Refund ID: ${refundId}`,
      updatedAt: new Date(),
    });

    console.log(`✅ Order status updated to REFUND_INITIATED`);

    // 9️⃣ SEND SUCCESS RESPONSE
    return res.json({
      success: true,
      message: "Refund initiated successfully",
      data: {
        refundId: refundId,
        refundStatus: refundStatus,
        orderId: order.id,
        billId: order.billId,
        amount: order.totalAmount,
        paymentId: payment.paymentId,
        initiatedBy: authenticatedAdminId,
        initiatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      "❌ Refund error:",
      error.response?.data || error.message
    );

    const errorMessage =
      error.response?.data?.message || error.message;
    const errorCode = error.response?.data?.code;

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Refund initiation failed",
      error: errorMessage,
      code: errorCode,
    });
  }
};

// ===================================================================
// ✅ CHECK REFUND STATUS
// ===================================================================
export const checkRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔍 Checking refund status for order: ${orderId}`);

    const payment = await Payment.findOne({
      where: { orderId: orderId },
      include: [
        {
          model: Order,
          where: { id: orderId },
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found for this order",
      });
    }

    if (!payment.refundId) {
      return res.status(400).json({
        success: false,
        message: "No refund initiated for this order",
      });
    }

    console.log(`🔍 Refund ID found: ${payment.refundId}`);

    const axios = (await import("axios")).default;

    const refundResponse = await axios.get(
      `https://api.cashfree.com/pg/refunds/${payment.refundId}`,
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    const refundStatus = refundResponse.data?.refund?.refund_status;
    const refundAmount = refundResponse.data?.refund?.refund_amount;

    console.log(`📊 Current refund status from Cashfree: ${refundStatus}`);

    // 4️⃣ UPDATE LOCAL DATABASE BASED ON CASHFREE STATUS
    if (refundStatus === "SUCCESS") {
      await Payment.update(
        { status: "REFUND_SUCCESS" },
        { where: { id: payment.id } }
      );

      await Order.update(
        { status: "REFUND_SUCCESS" },
        { where: { id: orderId } }
      );

      console.log(`✅ Refund marked as SUCCESS in local DB`);
    } else if (refundStatus === "FAILED") {
      await Payment.update(
        { status: "REFUND_FAILED" },
        { where: { id: payment.id } }
      );

      await Order.update(
        { status: "REFUND_FAILED" },
        { where: { id: orderId } }
      );

      console.log(`❌ Refund marked as FAILED in local DB`);
    }

    return res.json({
      success: true,
      message: "Refund status retrieved",
      data: {
        orderId: orderId,
        refundId: payment.refundId,
        refundStatus: refundStatus,
        refundAmount: refundAmount,
        refundedAt: payment.refundedAt,
        orderStatus: payment.Order?.status,
      },
    });
  } catch (error) {
    console.error(
      "❌ Check refund status error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to check refund status",
      error: error.response?.data?.message || error.message,
    });
  }
};

// ===================================================================
// ✅ GET REFUND HISTORY (FOR ADMIN DASHBOARD)
// ===================================================================
export const getRefundHistory = async (req, res) => {
  try {
    const { cafeteriaId, status } = req.query;

    console.log(`📊 Fetching refund history - cafeteriaId: ${cafeteriaId}, status: ${status}`);

    let whereClause = {};

    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = ["REFUND_INITIATED", "REFUND_SUCCESS", "REFUND_FAILED"];
    }

    if (cafeteriaId) {
      whereClause.cafeteriaId = cafeteriaId;
    }

    const refunds = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Order,
          attributes: [
            "id",
            "billId",
            "totalAmount",
            "status",
            "createdAt",
          ],
        },
      ],
      order: [["refundedAt", "DESC"]],
      limit: 50,
    });

    console.log(`✅ Found ${refunds.length} refund records`);

    return res.json({
      success: true,
      count: refunds.length,
      data: refunds,
    });
  } catch (error) {
    console.error("❌ Get refund history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch refund history",
      error: error.message,
    });
  }
};

// ===================================================================
// ✅ GET PAYMENT BY ORDER ID (FOR VERIFICATION)
// ===================================================================
export const getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🔍 Looking up payment for order:", orderId);

    const payment = await Payment.findOne({
      where: { cashfreeOrderId: orderId },
      order: [["createdAt", "DESC"]],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found for this Cashfree order",
      });
    }

    if (!payment.paymentId) {
      return res.json({
        success: true,
        message: "Payment exists but webhook not received yet",
        cashfreeOrderId: payment.cashfreeOrderId,
        paymentId: null,
        webhookPending: true,
      });
    }

    return res.json({
      success: true,
      paymentId: payment.paymentId,
      cashfreeOrderId: payment.cashfreeOrderId,
      status: payment.status,
      webhookPending: false,
    });
  } catch (err) {
    console.error("❌ getPaymentByOrderId error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch paymentId",
      error: err.message,
    });
  }
};

// ===================================================================
// ✅ LEGACY: UPDATE PAYMENT ID FROM WEBHOOK
// ===================================================================
export const updatePaymentIdFromWebhook = async (req, res) => {
  const { cashfreeOrderId, paymentId } = req.body;

  if (!cashfreeOrderId || !paymentId) {
    return res.status(400).json({ message: "Missing data" });
  }

  await Payment.update(
    { paymentId },
    { where: { cashfreeOrderId } }
  );

  res.json({ success: true });
};