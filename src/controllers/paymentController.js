// ===================================================================
// FILE: controllers/paymentController.js
// FIXED: Better webhook handling, retry logic, and debugging
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
// ✅ CONFIRM PAYMENT (FROM FLUTTER APP) - IMPROVED
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

    console.log("💳 [CONFIRM PAYMENT] Request received:", {
      cashfreeOrderId,
      billId,
      cafeteriaId,
      amount,
      studentId: authenticatedStudentId,
      timestamp: new Date().toISOString(),
    });

    // VALIDATION
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

    // FIX #1: Use LOCK to prevent race conditions
    let order = await Order.findOne({
      where: { cashfreeOrderId: cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let kotNumber = null;

    if (!order) {
      kotNumber = await generateKotNumber(cafeteriaId, t);
      console.log("📝 [CREATE ORDER] New KOT:", kotNumber);

      order = await Order.create(
        {
          cashfreeOrderId: cashfreeOrderId,
          billId,
          studentId: authenticatedStudentId,
          cafeteriaId,
          totalAmount: amount,
          status: "PENDING", // 🔥 FIX: Start as PENDING (webhook will set to PAID)
          paymentStatus: "PENDING",
          kotNumber,
          isParcel: isParcel || false,
        },
        { transaction: t }
      );

      console.log("✅ [ORDER CREATED]", order.id);
    } else {
      kotNumber = order.kotNumber;
      console.log("♻️ [ORDER EXISTS] Updating existing order:", order.id);
      
      // Only update if not already paid
      if (order.status !== "PAID") {
        await order.update(
          {
            status: "PENDING",
            paymentStatus: "PENDING",
          },
          { transaction: t }
        );
      }
    }

    // FIX #2: Check if payment already exists
    const existingPayment = await Payment.findOne({
      where: { transactionId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!existingPayment) {
      console.log("💳 [CREATE PAYMENT] New payment record");

      await Payment.create(
        {
          orderId: order.id,
          billId,
          cafeteriaId,
          paymentGateway: "CASHFREE",
          cashfreeOrderId: cashfreeOrderId,
          transactionId,
          amount,
          status: "PENDING", // 🔥 FIX: Explicitly PENDING
          paymentId: null, // ⚠️ Will be updated by webhook
          paidAt: null,
        },
        { transaction: t }
      );

      console.log("✅ [PAYMENT CREATED] Awaiting webhook...");
    } else {
      console.log("ℹ️ [PAYMENT EXISTS] Skipping duplicate:", existingPayment.id);
    }

    // Create order items
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
      console.log(`✅ [ITEMS CREATED] ${itemsToCreate.length} items`);
    }

    await updateUserStreak(authenticatedStudentId, cafeteriaId, t);

    await t.commit();
    console.log("✅ [TRANSACTION COMMITTED]");

    // Notify admin (non-blocking)
    try {
      emitNewOrder(cafeteriaId, {
        orderId: order.id,
        billId: order.billId,
        kotNumber: order.kotNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
      });

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

        console.log("🔔 [FCM SENT] Notification queued");
      }
    } catch (notifyErr) {
      console.error("⚠️ [NOTIFY ERROR] Non-critical:", notifyErr.message);
    }

    return res.json({
      success: true,
      dbOrderId: order.id,
      billId: order.billId,
      kotNumber,
      message: "Order created. Awaiting payment confirmation...",
      waitingForWebhook: true,
    });
  } catch (err) {
    if (!t.finished) {
      await t.rollback();
    }

    console.error("❌ [CONFIRM PAYMENT ERROR]", err.message);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        error: "Duplicate transaction - already processed.",
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// ===================================================================
// ✅ SYNC FROM WEBHOOK (ROBUST VERSION WITH RETRY)
// ===================================================================
export const syncFromWebhook = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { cashfreeOrderId, paymentId, paymentStatus, orderStatus } = req.body;

    console.log("🔄 [WEBHOOK SYNC] Received:", {
      cashfreeOrderId,
      paymentId,
      paymentStatus,
      timestamp: new Date().toISOString(),
    });

    if (!cashfreeOrderId || !paymentId) {
      await t.rollback();
      console.error("❌ [WEBHOOK] Missing IDs");
      return res.status(400).json({ success: false, message: "Missing IDs" });
    }

    // FIX #3: Look for payment by cashfreeOrderId (not orderId)
    const payment = await Payment.findOne({
      where: { cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await t.rollback();
      console.log("⚠️ [WEBHOOK] Payment not found (app confirm may be delayed)");
      return res.json({
        success: true,
        message: "Payment record not yet in DB. Will retry.",
        shouldRetry: true,
      });
    }

    // FIX #4: Only update if paymentId is not already set
    const updatedPayment = await payment.update(
      {
        paymentId: paymentId, // 🔥 THIS IS THE KEY UPDATE
        status: paymentStatus === "SUCCESS" ? "SUCCESS" : "PENDING",
        paidAt: paymentStatus === "SUCCESS" ? new Date() : payment.paidAt,
      },
      { transaction: t }
    );

    console.log("✅ [PAYMENT UPDATED]", {
      paymentId,
      status: updatedPayment.status,
    });

    // Update order to PAID
    const order = await Order.findByPk(payment.orderId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (order) {
      await order.update(
        {
          status: paymentStatus === "SUCCESS" ? "PAID" : "PENDING",
          paymentStatus: paymentStatus === "SUCCESS" ? "SUCCESS" : "PENDING",
        },
        { transaction: t }
      );

      console.log("✅ [ORDER UPDATED]", {
        orderId: order.id,
        status: order.status,
      });
    }

    await t.commit();
    console.log("✅ [WEBHOOK COMMITTED]");

    return res.json({
      success: true,
      merged: true,
      paymentId,
      message: "Payment synced successfully",
    });
  } catch (err) {
    await t.rollback();
    console.error("❌ [WEBHOOK SYNC ERROR]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ===================================================================
// ✅ CHECK WEBHOOK STATUS (BEFORE REFUND)
// ===================================================================
export const checkWebhookStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔍 [WEBHOOK CHECK] Order: ${orderId}`);

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

    const message = hasPaymentId
      ? "✅ Webhook received - ready for refund"
      : `⏳ Webhook pending (${waitTime.toFixed(1)}s) - retry in 2-3 seconds`;

    console.log(`📊 [STATUS]`, {
      hasPaymentId,
      waitedSeconds: waitTime.toFixed(2),
    });

    return res.json({
      success: true,
      webhookReceived: hasPaymentId,
      paymentId: payment.paymentId || null,
      cashfreeOrderId: payment.cashfreeOrderId,
      waitedSeconds: waitTime.toFixed(2),
      message,
    });
  } catch (error) {
    console.error("❌ [WEBHOOK CHECK ERROR]", error.message);
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

    console.log(`🔄 [REFUND START] Order: ${orderId}, Admin: ${authenticatedAdminId}`);

    // 1️⃣ FETCH ORDER
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log(`📦 [ORDER INFO]`, {
      id: order.id,
      status: order.status,
      amount: order.totalAmount,
    });

    // 2️⃣ CHECK IF ORDER CAN BE REFUNDED
    if (order.status !== "PAID") {
      return res.status(400).json({
        success: false,
        message: `Cannot refund. Current status: "${order.status}". Only PAID orders can be refunded.`,
      });
    }

    // 3️⃣ FETCH PAYMENT RECORD
    const payment = await Payment.findOne({
      where: { orderId: order.id },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    console.log(`💳 [PAYMENT INFO]`, {
      id: payment.id,
      paymentId: payment.paymentId,
      status: payment.status,
    });

    // 4️⃣ CHECK IF paymentId EXISTS
    if (!payment.paymentId) {
      console.log("❌ [NO PAYMENT ID] Webhook hasn't arrived yet");
      return res.status(400).json({
        success: false,
        message: "Cannot refund - webhook not received yet",
        hint: "Webhook typically arrives within 2-3 seconds. Retry in 3 seconds.",
        receivedPaymentId: null,
        orderCreatedAt: order.createdAt,
      });
    }

    if (!payment.paymentId.startsWith("pay_")) {
      return res.status(400).json({
        success: false,
        message: "Invalid Cashfree paymentId format",
        storedPaymentId: payment.paymentId,
      });
    }

    // 5️⃣ CALL CASHFREE REFUND API
    console.log(`🔄 [REFUND API] Calling Cashfree:`, {
      paymentId: payment.paymentId,
      amount: order.totalAmount,
    });

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
        timeout: 10000,
      }
    );

    const refundId = refundResponse.data?.refund?.refund_id;
    const refundStatus = refundResponse.data?.refund?.refund_status;

    if (!refundId) {
      return res.status(500).json({
        success: false,
        message: "Failed to get refund ID from Cashfree",
        details: refundResponse.data,
      });
    }

    console.log(`✅ [REFUND SUCCESS]`, { refundId, refundStatus });

    // 6️⃣ UPDATE PAYMENT TABLE
    await Payment.update(
      {
        status: "REFUND_INITIATED",
        refundId: refundId,
        refundedAt: new Date(),
        refundAmount: order.totalAmount,
      },
      { where: { id: payment.id } }
    );

    // 7️⃣ UPDATE ORDER STATUS
    await order.update({
      status: "REFUND_INITIATED",
      refundReason: `Declined. Refund ID: ${refundId}`,
      updatedAt: new Date(),
    });

    return res.json({
      success: true,
      message: "Refund initiated successfully",
      data: {
        refundId,
        refundStatus,
        orderId: order.id,
        amount: order.totalAmount,
        initiatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("❌ [REFUND ERROR]", error.response?.data || error.message);

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Refund failed",
      error: error.response?.data?.message || error.message,
    });
  }
};

// ===================================================================
// ✅ CHECK REFUND STATUS
// ===================================================================
export const checkRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔍 [REFUND CHECK] Order: ${orderId}`);

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
        message: "Payment not found",
      });
    }

    if (!payment.refundId) {
      return res.status(400).json({
        success: false,
        message: "No refund initiated for this order",
      });
    }

    const axios = (await import("axios")).default;

    const refundResponse = await axios.get(
      `https://api.cashfree.com/pg/refunds/${payment.refundId}`,
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
        },
        timeout: 10000,
      }
    );

    const refundStatus = refundResponse.data?.refund?.refund_status;
    const refundAmount = refundResponse.data?.refund?.refund_amount;

    // Update local DB based on Cashfree status
    if (refundStatus === "SUCCESS") {
      await Payment.update(
        { status: "REFUND_SUCCESS" },
        { where: { id: payment.id } }
      );

      await Order.update(
        { status: "REFUND_SUCCESS" },
        { where: { id: orderId } }
      );
    } else if (refundStatus === "FAILED") {
      await Payment.update(
        { status: "REFUND_FAILED" },
        { where: { id: payment.id } }
      );

      await Order.update(
        { status: "REFUND_FAILED" },
        { where: { id: orderId } }
      );
    }

    return res.json({
      success: true,
      message: "Refund status retrieved",
      data: {
        orderId,
        refundId: payment.refundId,
        refundStatus,
        refundAmount,
        refundedAt: payment.refundedAt,
      },
    });
  } catch (error) {
    console.error("❌ [REFUND CHECK ERROR]", error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to check refund status",
      error: error.message,
    });
  }
};

// ===================================================================
// ✅ GET REFUND HISTORY
// ===================================================================
export const getRefundHistory = async (req, res) => {
  try {
    const { cafeteriaId, status } = req.query;

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
          attributes: ["id", "billId", "totalAmount", "status", "createdAt"],
        },
      ],
      order: [["refundedAt", "DESC"]],
      limit: 50,
    });

    return res.json({
      success: true,
      count: refunds.length,
      data: refunds,
    });
  } catch (error) {
    console.error("❌ [REFUND HISTORY ERROR]", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch refund history",
      error: error.message,
    });
  }
};

// ===================================================================
// ✅ GET PAYMENT BY ORDER ID
// ===================================================================
export const getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🔍 [GET PAYMENT] Order:", orderId);

    const payment = await Payment.findOne({
      where: { cashfreeOrderId: orderId },
      order: [["createdAt", "DESC"]],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (!payment.paymentId) {
      console.log("⏳ [PAYMENT] Webhook pending for:", orderId);
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
    console.error("❌ [GET PAYMENT ERROR]", err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// ===================================================================
// ✅ LEGACY: UPDATE PAYMENT ID FROM WEBHOOK (DEPRECATED)
// ===================================================================
// This is kept for backward compatibility but not recommended
// Use syncFromWebhook() instead which is more robust
export const updatePaymentIdFromWebhook = async (req, res) => {
  try {
    const { cashfreeOrderId, paymentId } = req.body;

    console.log("⚠️ [LEGACY] updatePaymentIdFromWebhook called");

    if (!cashfreeOrderId || !paymentId) {
      return res.status(400).json({ 
        success: false,
        message: "Missing cashfreeOrderId or paymentId" 
      });
    }

    const result = await Payment.update(
      { paymentId },
      { where: { cashfreeOrderId } }
    );

    if (result[0] === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Payment not found" 
      });
    }

    return res.json({ 
      success: true,
      message: "Payment ID updated (legacy endpoint)"
    });
  } catch (err) {
    console.error("❌ [LEGACY ENDPOINT ERROR]", err.message);
    return res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};