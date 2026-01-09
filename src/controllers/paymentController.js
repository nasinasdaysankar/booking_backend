// ===================================================================
// FILE: controllers/paymentController.js
// Complete refund functions with all fixes
// ===================================================================

import { Payment, Order, OrderItem, sequelize } from "../models/index.js";
import { emitNewOrder } from "../socket.js";
import admin from "../firebase.js";
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
    } = req.body;

    const authenticatedStudentId = req.user.id;

    console.log("💳 Payment confirmation request:", {
      cashfreeOrderId,
      billId,
      cafeteriaId,
      amount,
      studentId: authenticatedStudentId,
    });

    if (
      !cashfreeOrderId ||
      !billId ||
      !cafeteriaId ||
      !amount ||
      !transactionId
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields.",
      });
    }

    let order = await Order.findOne({
      where: { cashfreeOrderId: cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let kotNumber = null;

    if (!order) {
      kotNumber = await generateKotNumber(cafeteriaId, t);

      console.log("📝 Creating new order with KOT:", kotNumber);

      order = await Order.create(
        {
          cashfreeOrderId: cashfreeOrderId,
          billId,
          studentId: authenticatedStudentId,
          cafeteriaId,
          totalAmount: amount,
          status: "PAID",
          paymentStatus: "SUCCESS",
          kotNumber,
          isParcel: isParcel || false,
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
        },
        { transaction: t }
      );

      console.log("✅ Order updated:", order.id);
    }

    const existingPayment = await Payment.findOne({
      where: { transactionId },
      transaction: t,
    });

    if (!existingPayment) {
      console.log(
        "💳 Creating payment record (paymentId will come from webhook)"
      );

      await Payment.create(
        {
          orderId: order.id,
          billId,
          cafeteriaId,
          paymentGateway: "CASHFREE",
          cashfreeOrderId: cashfreeOrderId,
          transactionId,
          amount,
          status: "SUCCESS",
          paidAt: new Date(),
        },
        { transaction: t }
      );

      console.log(
        "✅ Payment record created (awaiting webhook for real paymentId)"
      );
    } else {
      console.log("ℹ️ Payment already exists:", existingPayment.id);
    }

    const existingItem = await OrderItem.findOne({
      where: { orderId: order.id },
      transaction: t,
    });

    if (!existingItem && Array.isArray(items) && items.length > 0) {
      const itemsToCreate = items.map((item) => ({
        orderId: order.id,
        menuItemId: item.menuItemId || item.id || item.menu_item_id || null,
        name: item.name,
        quantity: item.quantity || item.qty,
        priceAtOrder: item.price,
        imageUrl: item.imageUrl || item.img || null,
      }));

      const hasInvalidItem = itemsToCreate.some(
        (i) => i.quantity === undefined || i.quantity === null || i.quantity === 0
      );

      if (hasInvalidItem) {
        throw new Error("One or more items are missing a valid quantity.");
      }

      await OrderItem.bulkCreate(itemsToCreate, { transaction: t });
      console.log(`✅ Created ${itemsToCreate.length} order items`);
    }

    await updateUserStreak(authenticatedStudentId, cafeteriaId, t);

    await t.commit();
    console.log("✅ Transaction committed successfully");

    try {
      emitNewOrder(cafeteriaId, {
        orderId: order.id,
        billId: order.billId,
        kotNumber: order.kotNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
      });

      console.log("📡 Socket event emitted");

      const adminTokens = await AdminFcmToken.findAll({
        where: { cafeteriaId },
      });

      if (adminTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          tokens: adminTokens.map((t) => t.fcmToken),
          notification: {
            title: "🍽 New Order Received",
            body: `KOT ${order.kotNumber} • ₹${order.totalAmount}`,
          },
          android: {
            priority: "high",
            notification: {
              channelId: "high_importance_channel",
            },
          },
        });

        console.log("🔔 FCM notification sent to admins");
      }
    } catch (notifyErr) {
      console.error("⚠️ Notification error (ignored):", notifyErr);
    }

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
    const { cashfreeOrderId, paymentId, paymentStatus } = req.body;

    // Use "findOrCreate" or update even if not created by app yet
    const [payment, created] = await Payment.findOrCreate({
      where: { cashfreeOrderId },
      defaults: {
        paymentId,
        status: paymentStatus || "SUCCESS",
        cashfreeOrderId,
        // Fill in placeholders if app hasn't called yet
        orderId: 0, 
        billId: 'PENDING_SYNC',
        cafeteriaId: 0
      },
      transaction: t
    });

    if (!created) {
      await payment.update({ 
        paymentId, 
        status: paymentStatus || "SUCCESS" 
      }, { transaction: t });
    }

    await t.commit();
    return res.json({ success: true });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
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