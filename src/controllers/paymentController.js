import { Payment, Order, OrderItem, sequelize } from "../models/index.js";
import { Op } from "sequelize";
import { appendOrderToSheet } from "../utils/googleSheets.js";
import { emitNewOrder } from "../socket.js";
import admin from "../config/firebaseAdmin.js";
import { AdminFcmToken, UserStreak } from "../models/index.js";
import { clearAnalyticsCache } from "../utils/cache.js";
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
      : (process.env.CASHFREE_PRODUCTION_CLIENT_ID || process.env.CASHFREE_APP_ID),
    clientSecret: isSandbox
      ? process.env.CASHFREE_SANDBOX_CLIENT_SECRET
      : (process.env.CASHFREE_PRODUCTION_CLIENT_SECRET || process.env.CASHFREE_SECRET_KEY),
    baseUrl: isSandbox
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg",
    env,
  };
};

// --------------------------------------------------
// 🆕 HELPER: GET CAFETERIA PREFIX
// --------------------------------------------------
const getCafeteriaPrefix = (cafeteriaId) => {
  if (!cafeteriaId) return "GEN";
  switch (Number(cafeteriaId)) {
    case 1: return "AA";  // Anathahara
    case 2: return "AR";  // Aromos
    case 3: return "DP";  // Dhanapani
    case 4: return "FC";  // Foodclub
    default: return "GEN";
  }
};

// --------------------------------------------------
// 🆕 HELPER: GENERATE RANDOM ALPHANUMERIC STRING
// --------------------------------------------------
const generateRandomString = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
};

// --------------------------------------------------
// 🆕 HELPER: GENERATE UNIQUE RANDOM KOT NUMBER
// --------------------------------------------------
const generateKotNumber = async (cafeteriaId, transaction) => {
  try {
    console.log(`🎯 [KOT] Generating unique KOT for cafeteria: ${cafeteriaId}`);

    // Get cafeteria prefix
    const prefix = getCafeteriaPrefix(cafeteriaId);

    // Generate 8 random alphanumeric characters
    const randomString = generateRandomString(8);

    // Combine: KOT-{PREFIX}-{RANDOM}
    const kotNumber = `KOT-${prefix}-${randomString}`;

    console.log(`🎫 [KOT] Generated KOT Number: ${kotNumber}`);

    return kotNumber;
  } catch (error) {
    console.error("❌ [KOT] Error generating KOT number:", {
      message: error.message,
      cafeteriaId,
    });
    throw error;
  }
};

// --------------------------------------------------
// 🆕 HELPER: GENERATE DAILY ORDER NUMBER (RESETS EVERY DAY)
// --------------------------------------------------
const generateDailyOrderNumber = async (cafeteriaId, transaction) => {
  try {
    // We use dayjs local time to define "today"
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    // Use max + 1 to avoid sequence issues and ensure it's truly sequential for that day
    const maxVal = await Order.max("dailyOrderNumber", {
      where: {
        cafeteriaId,
        createdAt: {
          [Op.between]: [todayStart, todayEnd],
        },
      },
      transaction,
    });

    const dailyNumber = (Number(maxVal) || 0) + 1;
    console.log(`🔢 [DAILY] Generated Daily Order Number: ${dailyNumber}`);
    return dailyNumber;
  } catch (error) {
    console.error("❌ [DAILY] Error generating daily order number:", error.message);
    return 1; // Fallback
  }
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

// --------------------------------------------------
// 🆕 HELPER: FINALIZE ORDER AND NOTIFY (REUSABLE)
// --------------------------------------------------
async function finalizeOrderAndNotify(order, transactionId, t, options = {}) {
  const { isManual = false, isParcel = false, parcelAmount = 0, platformFee = 0, commissionAmount = 0, gstAmount = 0, items = [] } = options;

  console.log(`🎯 [FINALIZE] Finalizing Order #${order.id} (Status: ${order.status})`);

  // 1. Only update if not already PAID
  if (order.status !== "PAID") {
    const kotNumber = await generateKotNumber(order.cafeteriaId, t);
    const dailyOrderNumber = await generateDailyOrderNumber(order.cafeteriaId, t);

    console.log(`✅ [GENERATE] KOT: ${kotNumber}, Daily: ${dailyOrderNumber}`);

    await order.update({
      status: "PAID",
      paymentStatus: "SUCCESS",
      kotNumber,
      dailyOrderNumber,
      isParcel: Boolean(isParcel) || order.isParcel,
      parcelAmount: Number(parcelAmount) || order.parcelAmount,
      platformFee: Number(platformFee) || order.platformFee,
      commissionAmount: Number(commissionAmount) || order.commissionAmount,
      gstAmount: Number(gstAmount) || order.gstAmount,
    }, { transaction: t });
  }

  // 2. Create Payment record if missing
  const existingPayment = await Payment.findOne({
    where: { cashfreeOrderId: order.cashfreeOrderId },
    transaction: t,
  });

  if (!existingPayment) {
    await Payment.create({
      orderId: order.id,
      billId: order.billId,
      cafeteriaId: order.cafeteriaId,
      paymentGateway: "CASHFREE",
      cashfreeOrderId: order.cashfreeOrderId,
      transactionId: transactionId || order.cashfreeOrderId,
      amount: order.totalAmount,
      status: "SUCCESS",
      paidAt: new Date(),
    }, { transaction: t });
    console.log("💳 [PAYMENT] Record created");
  }

  // 3. Update Streak
  await updateUserStreak(order.studentId, order.cafeteriaId, t);

  // 4. Send Notifications (Async after commit logic usually, but we'll trigger here)
  // We need the items for the socket/sheets. If not provided, fetch them.
  let finalItems = items;
  if (finalItems.length === 0) {
    const dbItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
    finalItems = dbItems.map(i => ({
      name: i.name,
      quantity: i.quantity,
      price: i.priceAtOrder,
      imageUrl: i.imageUrl,
      isParcelSelected: i.isParcel,
    }));
  }

  // Fetch student name if not provided
  let studentName = "Customer";
  const student = await order.getUser({ transaction: t });
  if (student) studentName = student.name || student.email || "Customer";

  // Trigger non-blocking notifications
  setTimeout(async () => {
    try {
      console.log(`🔔 [NOTIFY] Sending notifications for Order #${order.id}`);

      emitNewOrder(order.cafeteriaId, {
        orderId: order.id,
        id: order.id,
        billId: order.billId,
        kotNumber: order.kotNumber,
        totalAmount: order.totalAmount,
        status: "PAID",
        createdAt: order.createdAt,
        isParcel: order.isParcel,
        parcelAmount: order.parcelAmount,
        netAmount: Number(order.totalAmount) - Number(order.platformFee || 0) - Number(order.commissionAmount || 0),
        items: finalItems,
        customerName: studentName,
      });

      // Admin Push Notifications
      const adminTokens = await AdminFcmToken.findAll({ where: { cafeteriaId: order.cafeteriaId } });
      if (adminTokens.length > 0) {
        const tokens = adminTokens.map((t) => t.fcmToken);
        await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: "🍽 New Order Received",
            body: `KOT ${order.kotNumber} • ₹${order.totalAmount}`,
          },
          data: {
            type: "NEW_ORDER",
            orderId: String(order.id),
            kotNumber: order.kotNumber || "",
            cafeteriaId: String(order.cafeteriaId),
          },
          android: {
            priority: "high",
            notification: { channelId: "high_importance_channel", sound: "default" },
          },
        });
      }

      // Sheets Sync
      appendOrderToSheet({
        id: order.id,
        cashfreeOrderId: order.cashfreeOrderId,
        billId: order.billId,
        studentId: order.studentId,
        customerName: studentName,
        cafeteriaId: order.cafeteriaId,
        totalAmount: order.totalAmount,
        platformFee: order.platformFee,
        gstAmount: order.gstAmount,
        commissionAmount: order.commissionAmount,
        isParcel: order.isParcel,
        parcelAmount: order.parcelAmount,
        items: finalItems,
        status: "PAID",
        paymentStatus: "SUCCESS",
        kotNumber: order.kotNumber,
        createdAt: order.createdAt
      }).catch(e => console.error("⚠️ Sheets error:", e.message));

      clearAnalyticsCache(order.cafeteriaId).catch(() => { });
    } catch (e) {
      console.error("⚠️ Async notification error:", e.message);
    }
  }, 0);

  return order;
}

// ===================================================================
// ✅ CREATE CASHFREE ORDER (PROXY TO FINANCE BACKEND)
// ===================================================================
export const createCashfreeOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("🚀 [PROXY] Forwarding order creation to Finance Backend...");

    const payload = req.body;
    const {
      orderId: cashfreeOrderId,
      cafeteriaId,
      items,
      isParcel,
      parcelAmount,
      platformFee,
      commissionAmount,
      gstAmount,
      orderAmount
    } = payload;

    const financeBackendUrl = process.env.FINANCE_BACKEND_URL;
    const internalApiKey = process.env.WEBHOOK_API_KEY;

    if (!financeBackendUrl) {
      throw new Error("Finance backend URL not configured");
    }

    // 1. Forward to Finance Backend
    const response = await axios.post(financeBackendUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": internalApiKey,
      },
      timeout: 15000,
    });

    const cfData = response.data;
    const billId = cfData.billId;

    console.log(`✅ [PROXY] Order created at gateway. BillID: ${billId}`);

    // 2. Pre-create local Order record (Status: PENDING_PAYMENT)
    const order = await Order.create({
      cashfreeOrderId,
      billId,
      studentId: req.user.id,
      cafeteriaId,
      totalAmount: orderAmount,
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      isParcel: !!isParcel,
      parcelAmount: Number(parcelAmount) || 0,
      platformFee: Number(platformFee) || 0,
      commissionAmount: Number(commissionAmount) || 0,
      gstAmount: Number(gstAmount) || 0,
    }, { transaction: t });

    // 3. Create OrderItems
    if (items && Array.isArray(items)) {
      const formattedItems = items.map(item => ({
        orderId: order.id,
        name: item.name,
        quantity: item.quantity,
        priceAtOrder: item.price,
        imageUrl: item.imageUrl,
        isParcel: !!item.isParcelSelected,
      }));
      await OrderItem.bulkCreate(formattedItems, { transaction: t });
    }

    await t.commit();
    console.log(`💾 [DATABASE] Pending Order #${order.id} pre-created.`);

    return res.status(200).json(cfData);
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("❌ [PROXY] Error initiating Cashfree order:", error?.response?.data || error.message);
    return res.status(error?.response?.status || 500).json({
      success: false,
      message: "Failed to initiate payment",
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
      commissionAmount,
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
    // 💾 [DATABASE] Finalize Order Status
    // ========================================
    let order = await Order.findOne({
      where: { cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!order) {
      console.error("❌ [DATABASE] Order record not found! Pre-creation must have failed.");
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Order record not found. Please contact support if amount was deducted.",
      });
    }

    await finalizeOrderAndNotify(order, transactionId, t, {
      items,
      isParcel,
      parcelAmount,
      platformFee,
      commissionAmount,
      gstAmount
    });

    await t.commit();
    console.log("✅ Transaction committed successfully (Manual Confirmation)");

    return res.json({
      success: true,
      dbOrderId: order.id,
      billId: order.billId,
      kotNumber: order.kotNumber,
      message: "Order placed successfully.",
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("❌ [CONFIRM] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ===================================================================
// ✅ VERIFY PAYMENT STATUS WITH CASHFREE
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

    await new Promise(resolve => setTimeout(resolve, 1500));

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
        const latest = payments[payments.length - 1];
        paymentStatus = latest.payment_status || "";
      }
    } catch (payErr) {
      console.log("⚠️ [VERIFY] /payments endpoint error:", payErr.message);
    }

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

    // ✅ ROBUSTNESS: If verified as SUCCESS, ensure order is finalized in our DB
    if (isSuccess) {
      const order = await Order.findOne({ where: { cashfreeOrderId: orderId } });
      if (order && order.status === "PENDING_PAYMENT") {
        console.log(`🛠 [VERIFY] Order ${orderId} is PENDING_PAYMENT in DB but SUCCESS in Cashfree. Finalizing now...`);
        const t = await sequelize.transaction();
        try {
          await finalizeOrderAndNotify(order, null, t);
          await t.commit();
        } catch (finalizeErr) {
          if (!t.finished) await t.rollback();
          console.error("❌ [VERIFY] Finalization error:", finalizeErr.message);
        }
      }
    }

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

// ===================================================================
// ✅ SYNC FROM WEBHOOK
// ===================================================================
export const syncFromWebhook = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { cashfreeOrderId, paymentId, paymentStatus } = req.body;

    if (!cashfreeOrderId || !paymentId) {
      await t.rollback();
      return res.json({ success: true, message: "Invalid webhook" });
    }

    if (paymentStatus !== "SUCCESS") {
      await t.rollback();
      return res.json({ success: true, message: `Ignoring ${paymentStatus}` });
    }

    // 1. Find the order (should have been pre-created)
    const order = await Order.findOne({
      where: { cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!order) {
      console.warn(`⚠️ [WEBHOOK] Order ${cashfreeOrderId} not found in DB! Creating link in pending_webhooks.`);
      await sequelize.query(
        `INSERT INTO pending_webhooks (cashfree_order_id, payment_id) VALUES (:orderId, :paymentId)
         ON CONFLICT (cashfree_order_id) DO UPDATE SET payment_id = EXCLUDED.payment_id`,
        { replacements: { orderId: cashfreeOrderId, paymentId }, transaction: t }
      );
      await t.commit();
      return res.json({ success: true, message: "Webhook saved (Order not yet in DB)" });
    }

    // 2. Finalize using the same logic as manual confirmation
    await finalizeOrderAndNotify(order, paymentId, t);

    await t.commit();
    console.log(`✅ [WEBHOOK] Order #${order.id} finalized via Webhook sync.`);

    return res.json({ success: true, message: "Webhook processed successfully" });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("❌ [WEBHOOK] Sync Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ===================================================================
// ✅ GET PAYMENT BY ORDER ID
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