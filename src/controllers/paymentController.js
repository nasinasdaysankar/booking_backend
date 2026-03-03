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
import axios from "axios";

// ===================================================================
// 🔧 HELPER: Get Cashfree credentials based on environment
// ===================================================================
const getCashfreeCredentials = () => {
  const env = (process.env.CASHFREE_ENV || "sandbox").toLowerCase();
  const isSandbox = env !== "production";

  return {
    clientId: isSandbox
      ? process.env.CASHFREE_SANDBOX_CLIENT_ID
      : (process.env.CASHFREE_PRODUCTION_CLIENT_ID || process.env.CASHFREE_CLIENT_ID),
    clientSecret: isSandbox
      ? process.env.CASHFREE_SANDBOX_CLIENT_SECRET
      : (process.env.CASHFREE_PRODUCTION_CLIENT_SECRET || process.env.CASHFREE_CLIENT_SECRET),
    baseUrl: isSandbox
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg",
    env,
  };
};

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
// ✅ CREATE CASHFREE ORDER (PROXY TO FINANCE BACKEND)
// ===================================================================
export const createCashfreeOrder = async (req, res) => {
  try {
    console.log("🚀 [PROXY] Forwarding order creation to Finance Backend...");

    // The flutter app sends: amount, orderId, uid, email, name, phone, cafeteriaId, etc.
    const payload = req.body;

    // Forward the request using the internal webhook API key
    const financeBackendUrl = process.env.FINANCE_BACKEND_URL || "https://createcashfreeorder-ueekkmxxta-uc.a.run.app/";
    const internalApiKey = process.env.WEBHOOK_API_KEY;

    console.log(`🔗 [PROXY] Finance URL: ${financeBackendUrl}`);
    console.log(`🔑 [PROXY] API Key set: ${!!internalApiKey}, length: ${internalApiKey?.length || 0}`);

    const response = await axios.post(financeBackendUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": internalApiKey,
      },
    });

    console.log("✅ [PROXY] Order created successfully via Finance Backend");
    return res.status(200).json(response.data);
  } catch (error) {
    console.error("❌ [PROXY] Error creating Cashfree order:", error?.response?.data || error.message);
    return res.status(error?.response?.status || 500).json({
      success: false,
      message: "Failed to create Cashfree order via proxy",
      error: error?.response?.data?.error || error.message,
    });
  }
};

// ===================================================================
// ✅ CONFIRM PAYMENT (FROM FLUTTER APP)
// ===================================================================
export const confirmPayment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    // ========================================
    // 🔍 DEBUG SECTION 1: Authentication Check
    // ========================================
    console.log("\n🚀 [CONFIRM] Payment confirmation started");
    console.log("📍 [AUTH] req.user:", JSON.stringify(req.user, null, 2));
    console.log("📍 [BODY] Request body:", JSON.stringify(req.body, null, 2));

    const {
      orderId: cashfreeOrderId,
      billId,
      cafeteriaId,
      transactionId,
      amount,
      items,
      isParcel,
      parcelAmount,
      platformFee,
      gstAmount,
    } = req.body;

    const authenticatedStudentId = req.user?.id;

    // ========================================
    // 🔍 DEBUG SECTION 2: Validation
    // ========================================
    console.log("✅ [VALIDATE] Checking required fields:");
    console.log(`  - cashfreeOrderId: ${cashfreeOrderId}`);
    console.log(`  - billId: ${billId}`);
    console.log(`  - cafeteriaId: ${cafeteriaId}`);
    console.log(`  - amount: ${amount}`);
    console.log(`  - authenticatedStudentId: ${authenticatedStudentId}`);
    console.log(`  - transactionId: ${transactionId}`);

    if (!cashfreeOrderId || !billId || !cafeteriaId || !amount || !transactionId) {
      console.error("❌ [VALIDATE] Missing required fields!");
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields.",
        missing: {
          cashfreeOrderId: !cashfreeOrderId,
          billId: !billId,
          cafeteriaId: !cafeteriaId,
          amount: !amount,
          transactionId: !transactionId,
        },
      });
    }

    if (!authenticatedStudentId) {
      console.error("❌ [AUTH] User not authenticated!");
      await t.rollback();
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
        debug: { user: req.user },
      });
    }

    console.log("✅ [VALIDATE] All validations passed!");

    // ========================================
    // 🔍 DEBUG SECTION 3: Cashfree Verification
    // ========================================
    console.log("\n🔍 [CASHFREE] Verifying payment with Cashfree...");
    
    const { clientId, clientSecret, baseUrl: cfBaseUrl, env } = getCashfreeCredentials();
    
    console.log("🔑 [CASHFREE] Using credentials:", {
      env,
      clientIdPrefix: clientId?.substring(0, 10) + '***',
      hasSecret: !!clientSecret,
      baseUrl: cfBaseUrl,
    });

    try {
      const cfResponse = await axios.get(
        `${cfBaseUrl}/orders/${cashfreeOrderId}`,
        {
          headers: {
            "x-api-version": "2023-08-01",
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
          },
          timeout: 10000,
        }
      );

      const orderData = cfResponse.data;
      const orderStatus = orderData.order_status || "";

      let paymentAttemptStatus = "";
      if (orderData.payments && orderData.payments.length > 0) {
        paymentAttemptStatus = orderData.payments[0].payment_status || "";
      }

      const isActuallyPaid = orderStatus === "PAID" || paymentAttemptStatus === "SUCCESS";

      console.log("📊 [CASHFREE] Response received:", {
        orderStatus,
        paymentAttemptStatus,
        isActuallyPaid,
      });

      if (!isActuallyPaid) {
        console.error(`❌ [CASHFREE] Payment not verified. Status: ${orderStatus}, Payment: ${paymentAttemptStatus}`);
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Payment could not be verified with gateway.",
          paymentStatus: paymentAttemptStatus || orderStatus,
          debug: { orderStatus, paymentAttemptStatus },
        });
      }
      console.log(`✅ [CASHFREE] Verification passed`);
    } catch (cfErr) {
      console.error("❌ [CASHFREE API ERROR]:", {
        status: cfErr.response?.status,
        message: cfErr.message,
        error: cfErr.response?.data,
      });
      
      if (cfErr.response?.status === 404) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: `Order ${cashfreeOrderId} not found in Cashfree (${env})`,
          error: cfErr.response?.data?.message,
        });
      }

      await t.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to verify payment status with gateway",
        error: cfErr.message,
      });
    }

    // ========================================
    // 🔍 DEBUG SECTION 4: Database Operations
    // ========================================
    console.log("\n💾 [DATABASE] Creating/updating order records...");

    let order = await Order.findOne({
      where: { cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let kotNumber = null;

    if (!order) {
      console.log("📝 [DATABASE] Order not found, creating new one");
      kotNumber = await generateKotNumber(cafeteriaId, t);
      console.log(`✅ [KOT] Generated: ${kotNumber}`);

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
          platformFee: Number(platformFee) || 0,
          gstAmount: Number(gstAmount) || 0,
        },
        { transaction: t }
      );

      console.log(`✅ [DATABASE] Order created with ID: ${order.id}`);
    } else {
      console.log("📝 [DATABASE] Order already exists, updating it");
      kotNumber = order.kotNumber;
      await order.update(
        {
          status: "PAID",
          paymentStatus: "SUCCESS",
          isParcel: Boolean(isParcel),
          parcelAmount: Number(parcelAmount) || 0,
          platformFee: Number(platformFee) || 0,
          gstAmount: Number(gstAmount) || 0,
        },
        { transaction: t }
      );
      console.log(`✅ [DATABASE] Order updated: ${order.id}`);
    }

    // Continue with rest of function...
  } catch (err) {
    if (!t.finished) {
      await t.rollback();
    }

    console.error("❌ [FATAL ERROR] confirmPayment failed:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return res.status(500).json({
      success: false,
      error: err.message,
      errorName: err.name,
      debug: process.env.NODE_ENV === "development" ? err : undefined,
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

    const { clientId, clientSecret, baseUrl: cfBaseUrl } = getCashfreeCredentials();

    const refundResponse = await axios.post(
      `${cfBaseUrl}/payments/${payment.paymentId}/refunds`,
      {
        refund_amount: Number(order.totalAmount),
        refund_note: `Order #${order.id} declined by cafeteria ${order.cafeteriaId}`,
      },
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
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

    const { clientId, clientSecret, baseUrl: cfBaseUrl } = getCashfreeCredentials();

    const refundResponse = await axios.get(
      `${cfBaseUrl}/refunds/${payment.refundId}`,
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": clientId,
          "x-client-secret": clientSecret,
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

// ===================================================================
// ✅ VERIFY PAYMENT STATUS WITH CASHFREE (BEFORE CONFIRMING ORDER)
// Called by Flutter app after Cashfree SDK returns to check if
// payment was actually successful or cancelled/failed
// ===================================================================
export const verifyPaymentStatus = async (req, res) => {
  const { clientId, clientSecret, baseUrl, env } = getCashfreeCredentials();

  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: `Payment gateway credentials for ${env} not configured`,
      });
    }

    console.log(`🔍 [VERIFY] Checking Cashfree for: ${orderId} (${env})`);

    // Add a small delay to let Cashfree finalize the payment
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Always use the /payments sub-endpoint, not order object
    let paymentStatus = "";
    let orderStatus = "";

    try {
      const paymentsResponse = await axios.get(
        `${baseUrl}/orders/${orderId}/payments`,
        {
          headers: {
            "x-api-version": "2023-08-01",
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
          },
          timeout: 15000,
        }
      );

      const payments = paymentsResponse.data;
      if (Array.isArray(payments) && payments.length > 0) {
        // Get the latest payment attempt
        const latest = payments[payments.length - 1];
        paymentStatus = latest.payment_status || "";
      }
    } catch (payErr) {
      console.log("⚠️ [VERIFY] /payments endpoint error:", payErr.message);
    }

    // Fallback: check order status
    if (!paymentStatus) {
      const orderResponse = await axios.get(
        `${baseUrl}/orders/${orderId}`,
        {
          headers: {
            "x-api-version": "2023-08-01",
            "x-client-id": clientId,
            "x-client-secret": clientSecret,
          },
          timeout: 15000,
        }
      );
      orderStatus = orderResponse.data.order_status || "";
    }

    const isSuccess = orderStatus === "PAID" || paymentStatus === "SUCCESS";

    console.log(`📊 [VERIFY] orderStatus=${orderStatus}, paymentStatus=${paymentStatus}, isSuccess=${isSuccess}`);

    return res.json({
      success: true,
      paymentStatus: isSuccess ? "SUCCESS" : (paymentStatus || orderStatus || "UNKNOWN"),
      orderStatus,
      message: isSuccess ? "Payment verified successfully" : `Payment not completed: ${paymentStatus || orderStatus}`,
    });

  } catch (error) {
    console.error("❌ [VERIFY] Error:", error.response?.data || error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        paymentStatus: "NOT_FOUND",
        message: `Order not found in Cashfree (${env}). Check that app and backend use same environment.`,
      });
    }

    return res.status(500).json({
      success: false,
      paymentStatus: "ERROR",
      message: "Failed to verify payment status",
    });
  }
};