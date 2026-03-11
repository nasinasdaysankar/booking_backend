import { Payment, Order, OrderItem, sequelize } from "../models/index.js";
import { Op, QueryTypes } from "sequelize";
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
export const getCafeteriaPrefix = (cafeteriaId) => {
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
export const generateBillId = async (cafeteriaId, transaction) => {
  const prefix = getCafeteriaPrefix(cafeteriaId);
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();

  const [result] = await sequelize.query(
    `
    INSERT INTO bill_counters (cafeteria_id, counter)
    VALUES (:cafeteriaId, 1)
    ON CONFLICT (cafeteria_id)
    DO UPDATE SET counter = bill_counters.counter + 1
    RETURNING counter;
    `,
    {
      replacements: { cafeteriaId },
      transaction,
      type: QueryTypes.INSERT,
    }
  );

  const counter = result[0].counter;
  const sequence = String(counter).padStart(2, "0");

  // Format: AR-UVMVCVNV01
  return `${prefix}-${randomStr}${sequence}`;
};

export const generateDailyOrderNumber = async (cafeteriaId, transaction) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const [result] = await sequelize.query(
    `
    INSERT INTO daily_order_counters (cafeteria_id, date, counter)
    VALUES (:cafeteriaId, :today, 1)
    ON CONFLICT (cafeteria_id, date)
    DO UPDATE SET counter = daily_order_counters.counter + 1
    RETURNING counter;
    `,
    {
      replacements: { cafeteriaId, today },
      transaction,
      type: QueryTypes.INSERT,
    }
  );

  return result[0].counter;
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

    const payload = req.body;
    const financeBackendUrl = process.env.FINANCE_BACKEND_URL;
    const internalApiKey = process.env.WEBHOOK_API_KEY;

    console.log(`🔗 [PROXY] Finance URL: ${financeBackendUrl}`);
    console.log(`🔑 [PROXY] API Key set: ${!!internalApiKey}, length: ${internalApiKey?.length || 0}`);

    if (!financeBackendUrl) {
      return res.status(500).json({
        success: false,
        message: "Finance backend URL not configured",
      });
    }

    if (!internalApiKey) {
      return res.status(500).json({
        success: false,
        message: "Internal API key not configured",
      });
    }

    const response = await axios.post(financeBackendUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": internalApiKey,
      },
      timeout: 15000,
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

    if (!cashfreeOrderId || !cafeteriaId || !amount || !transactionId) {
      console.error("❌ [VALIDATE] Missing required fields!");
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields.",
        missing: {
          cashfreeOrderId: !cashfreeOrderId,
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
    let dailyOrderNumber = null;

    let billId = null;
    if (!order) {
      console.log("📝 [DATABASE] Order not found, creating new one");
      kotNumber = await generateKotNumber(cafeteriaId, t);
      dailyOrderNumber = await generateDailyOrderNumber(cafeteriaId, t);
      billId = await generateBillId(cafeteriaId, t);
      console.log(`✅ [KOT]: ${kotNumber}, [DAILY]: ${dailyOrderNumber}, [BILL]: ${billId}`);

      try {
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
            dailyOrderNumber,
            isParcel: Boolean(isParcel),
            parcelAmount: Number(parcelAmount) || 0,
            platformFee: Number(platformFee) || 0,
            commissionAmount: Number(commissionAmount) || 0,
            gstAmount: Number(gstAmount) || 0,
          },
          { transaction: t }
        );

        console.log(`✅ [DATABASE] Order created with ID: ${order.id}`);
      } catch (createErr) {
        console.error("❌ [DATABASE CREATE ERROR]:", {
          name: createErr.name,
          message: createErr.message,
          sql: createErr.sql,
          fields: createErr.fields,
        });

        await t.rollback();

        return res.status(500).json({
          success: false,
          message: "Failed to create order in database",
          error: createErr.message,
          debug: {
            errorName: createErr.name,
            sql: createErr.sql,
            fields: createErr.fields,
          },
        });
      }
    } else {
      console.log("📝 [DATABASE] Order already exists, updating it");
      kotNumber = order.kotNumber;
      const updateData = {
        status: "PAID",
        paymentStatus: "SUCCESS",
        isParcel: Boolean(isParcel),
        parcelAmount: Number(parcelAmount) || 0,
        platformFee: Number(platformFee) || 0,
        commissionAmount: Number(commissionAmount) || 0,
        gstAmount: Number(gstAmount) || 0,
      };

      if (!order.dailyOrderNumber) {
        updateData.dailyOrderNumber = await generateDailyOrderNumber(cafeteriaId, t);
      }

      if (!order.billId || order.billId.includes('TEMP')) {
        updateData.billId = await generateBillId(cafeteriaId, t);
      }

      await order.update(updateData, { transaction: t });
      console.log(`✅ [DATABASE] Order updated: ${order.id}`);
    }

    // ========================================
    // 💳 CREATE PAYMENT RECORD
    // ========================================
    console.log("\n💳 [PAYMENT] Creating payment record...");

    const existingPayment = await Payment.findOne({
      where: { cashfreeOrderId },
      transaction: t,
    });

    if (!existingPayment) {
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
        },
        { transaction: t }
      );

      console.log("✅ [PAYMENT] Payment record created");
    } else {
      console.log("ℹ️ [PAYMENT] Payment already exists");
    }

    let formattedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      formattedItems = items.map((item) => {
        const isParcelForThisItem = Boolean(item.isParcelSelected);
        return {
          orderId: order.id,
          menuItemId: item.menuItemId || item.id || item.menu_item_id || null,
          name: item.name,
          quantity: item.quantity || item.qty,
          priceAtOrder: item.price,
          imageUrl: item.imageUrl || item.img || null,
          isParcel: isParcelForThisItem,
        };
      });

      const existingItem = await OrderItem.findOne({
        where: { orderId: order.id },
        transaction: t,
      });

      if (!existingItem) {
        console.log("🧺 [ITEMS] Creating order items...");
        await OrderItem.bulkCreate(formattedItems, { transaction: t });
        console.log(`✅ Created ${formattedItems.length} order items`);
      }
    }

    // ========================================
    // 🎯 UPDATE USER STREAK
    // ========================================
    await updateUserStreak(authenticatedStudentId, cafeteriaId, t);

    await t.commit();

    console.log("✅ Transaction committed successfully");

    // 🗑️ INVALIDATE ANALYTICS CACHE immediately so admin dashboard
    // shows updated top items / frequently ordered without delay
    clearAnalyticsCache(cafeteriaId).catch(err =>
      console.warn("⚠️ Analytics cache clear error (non-blocking):", err.message)
    );

    // ========================================
    // 🔔 SEND NOTIFICATIONS (Async)
    // ========================================
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
          netAmount: Number(order.totalAmount) - Number(order.platformFee || 0) - Number(order.commissionAmount || 0),
          dailyOrderNumber: order.dailyOrderNumber,
          items: formattedItems,
          customerName: req.user.name || "Customer",
        });

        const adminTokens = await AdminFcmToken.findAll({
          where: { cafeteriaId },
        });

        console.log(`📊 Found ${adminTokens.length} FCM tokens for cafeteria ${cafeteriaId}`);

        if (adminTokens.length > 0) {
          const tokens = adminTokens.map((t) => t.fcmToken);

          console.log(`🔔 Sending FCM to ${tokens.length} device(s)...`);

          const standardNotificationResponse = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: "🍽 New Order Received",
              body: `KOT ${order.kotNumber} • ₹${order.totalAmount}`,
            },
            data: {
              type: "NEW_ORDER",
              orderId: String(order.id),
              kotNumber: order.kotNumber || "",
              cafeteriaId: String(cafeteriaId),
            },
            android: {
              priority: "high",
              notification: { channelId: "high_importance_channel", sound: "default" },
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: "🍽 New Order Received",
                    body: `KOT ${order.kotNumber} • ₹${order.totalAmount}`,
                  },
                  sound: "default",
                  badge: 1,
                  "content-available": 1,
                },
              },
            },
          });

          console.log(`🔔 FCM Result: ${standardNotificationResponse.successCount} success, ${standardNotificationResponse.failureCount} failed`);

          if (standardNotificationResponse.failureCount > 0) {
            const invalidTokens = [];
            standardNotificationResponse.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.log(`  ❌ Token ${idx} failed:`, resp.error?.message);
                invalidTokens.push(adminTokens[idx].fcmToken);
              }
            });
            if (invalidTokens.length > 0) {
              await AdminFcmToken.destroy({ where: { fcmToken: invalidTokens } });
              console.log("🧹 Cleaned up invalid admin tokens:", invalidTokens.length);
            }
          }
        } else {
          console.log("⚠️ No FCM tokens found for this cafeteria — admin won't receive push notification");
        }
      } catch (notifyErr) {
        console.error("⚠️ Notification error (background):", notifyErr);
      }

      // 📊 GOOGLE SHEETS SYNC
      try {
        await appendOrderToSheet({
          id: order.id,
          cashfreeOrderId: order.cashfreeOrderId,
          billId: order.billId,
          studentId: order.studentId,
          customerName: req.user.name || "Customer",
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
          createdAt: order.createdAt
        });
      } catch (sheetErr) {
        console.error("⚠️ Sheets sync error (background):", sheetErr.message);
      }
    })();

    // ========================================
    // ✅ RETURN SUCCESS RESPONSE
    // ========================================
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

    console.error("❌ [FATAL ERROR] confirmPayment failed:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return res.status(500).json({
      success: false,
      error: err.message,
      errorName: err.name,
      debug: process.env.NODE_ENV === "development" ? { stack: err.stack } : undefined,
    });
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
    const { cashfreeOrderId, paymentId, orderStatus, paymentStatus } = req.body;

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

    const payment = await Payment.findOne({
      where: { cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await sequelize.query(
        `
        INSERT INTO pending_webhooks (cashfree_order_id, payment_id)
        VALUES (:orderId, :paymentId)
        ON CONFLICT (cashfree_order_id)
        DO UPDATE SET payment_id = EXCLUDED.payment_id
        `,
        {
          replacements: { orderId: cashfreeOrderId, paymentId },
          transaction: t,
        }
      );

      await t.commit();
      return res.json({
        success: true,
        message: "Webhook saved. Will be linked when /confirm runs.",
      });
    }

    await payment.update(
      { paymentId, status: "SUCCESS", paidAt: new Date() },
      { transaction: t }
    );

    if (payment.orderId) {
      const order = await Order.findByPk(payment.orderId, { transaction: t, lock: t.LOCK.UPDATE });
      if (order) {
        const updateData = { status: "PAID", paymentStatus: "SUCCESS" };

        // Use the helpers already defined in this file
        if (!order.kotNumber) {
          updateData.kotNumber = await generateKotNumber(order.cafeteriaId, t);
        }
        if (!order.dailyOrderNumber) {
          updateData.dailyOrderNumber = await generateDailyOrderNumber(order.cafeteriaId, t);
        }
        if (!order.billId || order.billId.includes('TEMP')) {
          updateData.billId = await generateBillId(order.cafeteriaId, t);
        }

        await order.update(updateData, { transaction: t });
        console.log(`✅ [WEBHOOK] Order ${order.id} updated with sequential IDs`);
      }
    }

    await t.commit();

    // 🗑️ INVALIDATE ANALYTICS CACHE on webhook sync
    if (payment.orderId) {
      const syncedOrder = await Order.findByPk(payment.orderId);
      if (syncedOrder?.cafeteriaId) {
        clearAnalyticsCache(syncedOrder.cafeteriaId).catch(err =>
          console.warn("⚠️ Analytics cache clear error (webhook, non-blocking):", err.message)
        );
      }
    }

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