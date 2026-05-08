import { Payment, Order, OrderItem, MenuItem, sequelize, AffiliateProduct, SystemSetting } from "../models/index.js";
import { Op, QueryTypes } from "sequelize";
import { appendOrderToSheet } from "../utils/googleSheets.js";
import { emitNewOrder, emitStockUpdate } from "../socket.js";
import admin from "../config/firebaseAdmin.js";
import { AdminFcmToken, UserStreak, UserFcmToken } from "../models/index.js";
import { syncCategoryBanner } from "../utils/bannerSync.js";
import { clearAnalyticsCache } from "../utils/cache.js";
import { getCache, setCache, delCache } from "../config/redis.js";
import dayjs from "dayjs";
import axios from "axios";

// Cache TTL for payment status — short enough to stay fresh, long enough to
// absorb the Flutter retry bursts (6 retries × 3s = 18s window per payment).
// A PENDING result is cached for only 4s so retries still see updates quickly.
// A SUCCESS/FAILED result is cached for 30s since it won't change anymore.
const PAYMENT_STATUS_PENDING_TTL = 4;   // seconds
const PAYMENT_STATUS_FINAL_TTL   = 30;  // seconds
const paymentStatusCacheKey = (orderId) => `cf:status:${orderId}`;

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
export const generateKotNumber = async (cafeteriaId, transaction) => {
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

  const results = await sequelize.query(
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
      type: QueryTypes.SELECT,
    }
  );

  const counter = results[0].counter;
  const sequence = String(counter).padStart(2, "0");

  return `${prefix}-${randomStr}${sequence}`;
};

export const generateDeliveryOrderId = async (cafeteriaId, transaction) => {
  const prefix = getCafeteriaPrefix(cafeteriaId);
  const randomStr = generateRandomString(4);
  const sequence = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `DEL-${prefix}-${randomStr}-${sequence}`;
};

export const generateDailyOrderNumber = async (cafeteriaId, transaction) => {
  // ✅ FORCE IST DATE (Asia/Kolkata) to ensure daily reset at midnight IST
  const today = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000) + (new Date().getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0];

  const results = await sequelize.query(
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
      type: QueryTypes.SELECT,
    }
  );

  return results[0].counter;
};

export const generateTotalOrderNumber = async (transaction) => {
  // 🛡️ Ensure table exists (Sequential counters)
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS total_order_counters (
      counter_name VARCHAR(50) PRIMARY KEY,
      counter INTEGER DEFAULT 0
    );`,
    { transaction }
  );

  const results = await sequelize.query(
    `
    INSERT INTO total_order_counters (counter_name, counter)
    VALUES ('global_order_count', 1)
    ON CONFLICT (counter_name)
    DO UPDATE SET counter = total_order_counters.counter + 1
    RETURNING counter;
    `,
    {
      transaction,
      type: QueryTypes.SELECT,
    }
  );

  return results[0].counter;
};

// --------------------------------------------------
// 🆕 HELPER: UPDATE USER STREAK
// --------------------------------------------------
async function updateUserStreak(userId, cafeteriaId, transaction) {
  // ✅ FORCE IST DATE (Asia/Kolkata)
  const today = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000) + (new Date().getTimezoneOffset() * 60000))
    .toISOString()
    .split("T")[0];

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
    const { items, cafeteriaId, commissionAmount: snapCommission, platformFee: snapPlatformFee, gstAmount: snapGst, isParcel: snapIsParcel, parcelAmount: snapParcelAmount, orderType: snapOrderType, deliveryAddress: snapAddress, latitude: snapLat, longitude: snapLng } = req.body;

    // 🔍 STOCK CHECK (IF ITEMS PROVIDED)
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const id = item.id || item.menuItemId;
        if (!id || isNaN(id)) continue;
        const menuItem = await MenuItem.findByPk(id);
        if (menuItem && menuItem.trackStock) {
          const qty = item.qty || item.quantity || 0;
          if (menuItem.stock < qty) {
            return res.status(400).json({
              success: false,
              message: `Sorry, ${menuItem.name} has only ${menuItem.stock} items left in stock.`,
              error: "OUT_OF_STOCK",
            });
          }
        }
      }
    }

    console.log("🚀 [PROXY] Forwarding order creation to Finance Backend...");
    console.log(`📦 [PROXY] orderType received: ${req.body.orderType || 'DINE_IN'}`);
    const payload = req.body;
    const financeBackendUrl = process.env.FINANCE_BACKEND_URL;

    if (!financeBackendUrl) {
      console.error("❌ [PROXY] FINANCE_BACKEND_URL is not configured in .env.local");
      return res.status(500).json({
        success: false,
        message: "Finance backend URL not configured",
      });
    }

    // 🔥 INJECT WEBHOOK URL: Point Cashfree strictly to the Firebase Webhook Wrapper
    // (Firebase handles Cashfree signature validation, then securely forwards it to Railway)
    const firebaseWebhookUrl = financeBackendUrl.replace(/createcashfreeorder/i, "cashfreewebhook");
    
    if (payload.orderMeta) {
      payload.orderMeta.notify_url = firebaseWebhookUrl;
    } else {
      payload.orderMeta = { notify_url: firebaseWebhookUrl };
    }

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
    console.log("📄 [PROXY] Response Data:", JSON.stringify(response.data, null, 2));

    // =====================================================================
    // 💾 SAVE ORDER SNAPSHOT — safety net if /confirm never runs
    // =====================================================================
    const cashfreeOrderId = response.data?.order_id || response.data?.orderId || response.data?.paymentSessionId;
    const studentId = req.user?.id;
    const orderAmount = req.body.orderAmount;

    if (cashfreeOrderId && studentId && cafeteriaId) {
      // Run snapshot in background to avoid delaying the user's payment screen
      (async () => {
        try {
          // 1. Ensure Table Exists
          await sequelize.query(
            `CREATE TABLE IF NOT EXISTS order_snapshots (
              cashfree_order_id   VARCHAR(255) PRIMARY KEY,
              student_id          INTEGER NOT NULL,
              cafeteria_id        INTEGER NOT NULL,
              amount              DECIMAL(10,2) NOT NULL,
              items               JSONB NOT NULL DEFAULT '[]',
              commission_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
              platform_fee        DECIMAL(10,2) NOT NULL DEFAULT 0,
              gst_amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
              is_parcel           BOOLEAN NOT NULL DEFAULT false,
              parcel_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
              order_type          VARCHAR(20) DEFAULT 'DINE_IN',
              delivery_address    TEXT,
              latitude            DECIMAL(10,7),
              longitude           DECIMAL(10,7),
              created_at          TIMESTAMP DEFAULT NOW(),
              updated_at          TIMESTAMP DEFAULT NOW(),
              expires_at          TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')
            )`,
            { type: QueryTypes.RAW }
          ).catch(() => {});

          // 2. Safe Column Migrations
          const columns = ["commission_amount", "platform_fee", "gst_amount", "is_parcel", "parcel_amount", "order_type", "delivery_address", "latitude", "longitude", "updated_at"];
          for (const col of columns) {
            let type = "DECIMAL(10,2) NOT NULL DEFAULT 0";
            if (col === "is_parcel") type = "BOOLEAN NOT NULL DEFAULT false";
            if (col === "order_type") type = "VARCHAR(20) DEFAULT 'DINE_IN'";
            if (col === "delivery_address") type = "TEXT";
            if (col === "latitude" || col === "longitude") type = "DECIMAL(10,7)";
            if (col === "updated_at") type = "TIMESTAMP DEFAULT NOW()";
            
            await sequelize.query(`ALTER TABLE order_snapshots ADD COLUMN IF NOT EXISTS ${col} ${type}`, { type: QueryTypes.RAW }).catch(() => {});
          }

          // 3. Ensure Primary Key exists (if table was created early without it)
          await sequelize.query(`ALTER TABLE order_snapshots ADD PRIMARY KEY (cashfree_order_id)`, { type: QueryTypes.RAW }).catch(() => {});

          // 4. Save Snapshot
          await sequelize.query(
            `INSERT INTO order_snapshots
               (cashfree_order_id, student_id, cafeteria_id, amount, items, commission_amount, platform_fee, gst_amount, is_parcel, parcel_amount, order_type, delivery_address, latitude, longitude)
             VALUES (:cashfreeOrderId, :studentId, :cafeteriaId, :amount, :items, :commissionAmount, :platformFee, :gstAmount, :isParcel, :parcelAmount, :orderType, :deliveryAddress, :latitude, :longitude)
             ON CONFLICT (cashfree_order_id) 
             DO UPDATE SET 
               amount = EXCLUDED.amount,
               items = EXCLUDED.items,
               order_type = EXCLUDED.order_type,
               delivery_address = EXCLUDED.delivery_address,
               latitude = EXCLUDED.latitude,
               longitude = EXCLUDED.longitude,
               updated_at = NOW()`,
            {
              replacements: {
                cashfreeOrderId,
                studentId,
                cafeteriaId: Number(cafeteriaId),
                amount: Number(orderAmount) || 0,
                items: JSON.stringify(Array.isArray(items) ? items : []),
                commissionAmount: Number(snapCommission) || 0,
                platformFee: Number(snapPlatformFee) || 0,
                gstAmount: Number(snapGst) || 0,
                isParcel: Boolean(snapIsParcel),
                parcelAmount: Number(snapParcelAmount) || 0,
                orderType: snapOrderType || 'DINE_IN',
                deliveryAddress: snapAddress || null,
                latitude: snapLat || null,
                longitude: snapLng || null,
              },
              type: QueryTypes.INSERT,
            }
          );
          console.log(`💾 [SNAPSHOT] Saved order snapshot for ${cashfreeOrderId}`);
        } catch (snapErr) {
          // ULTIMATE SAFETY: This must NEVER crash the process
          console.warn("⚠️ [SNAPSHOT] Background save skipped:", snapErr.message);
        }
      })();
    }

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
      orderType,
      deliveryAddress,
      latitude,
      longitude,
    } = req.body;

    const authenticatedStudentId = req.user?.id;

    // ========================================
    // 🔍 DEBUG SECTION 2: Validation
    // ========================================
    console.log("✅ [VALIDATE] Checking required fields:");
    console.log(`  - cashfreeOrderId: ${cashfreeOrderId}`);
    console.log(`  - cafeteriaId: ${cafeteriaId}`);
    console.log(`  - amount: ${amount}`);
    console.log(`  - authenticatedStudentId: ${authenticatedStudentId}`);
    console.log(`  - transactionId: ${transactionId}`);

    // ========================================
    // 💾 ATTEMPT TO HEAL FROM SNAPSHOT
    // ========================================
    let snapshot = null;
    try {
      const snapshots = await sequelize.query(
        `SELECT * FROM order_snapshots WHERE cashfree_order_id = :cashfreeOrderId`,
        {
          replacements: { cashfreeOrderId },
          type: QueryTypes.SELECT
        }
      );
      if (snapshots && snapshots.length > 0) {
        snapshot = snapshots[0];
        console.log(`🔍 [SNAPSHOT] Found healing snapshot. Type: ${snapshot.order_type}`);
      }
    } catch (snapErr) {
      console.warn("⚠️ [SNAPSHOT] Healing check failed:", snapErr.message);
    }

    // Use snapshot as source of truth for critical delivery data
    console.log(`🔍 [DEBUG TYPE] Body orderType: ${orderType}, Snapshot order_type: ${snapshot?.order_type}`);
    const finalOrderType = (snapshot?.order_type === 'DELIVERY' || orderType === 'DELIVERY') ? 'DELIVERY' : 'DINE_IN';
    console.log(`🎯 [DEBUG TYPE] finalOrderType determined: ${finalOrderType}`);
    const finalAddress = deliveryAddress || snapshot?.delivery_address || null;
    const finalLat = latitude || snapshot?.latitude || null;
    const finalLng = longitude || snapshot?.longitude || null;
    const finalIsParcel = Boolean(isParcel) || Boolean(snapshot?.is_parcel);
    const finalParcelAmount = Number(parcelAmount) || Number(snapshot?.parcel_amount) || 0;

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
      // Removed lock to avoid deadlocks; sequential IDs are generated atomically via separate tables
    });

    let kotNumber = null;
    let dailyOrderNumber = null;
    let totalOrderNumber = null;

    let billId = null;
    if (!order) {
      console.log("📝 [DATABASE] Order not found, creating new one");
      kotNumber = await generateKotNumber(cafeteriaId, t);
      dailyOrderNumber = await generateDailyOrderNumber(cafeteriaId, t);
      totalOrderNumber = await generateTotalOrderNumber(t);
      billId = await generateBillId(cafeteriaId, t);
      console.log(`✅ [KOT]: ${kotNumber}, [DAILY]: ${dailyOrderNumber}, [TOTAL]: ${totalOrderNumber}, [BILL]: ${billId}`);

      // 🎯 Assign Affiliate Reward if enabled
      let assignedReward = null;
      try {
        const setting = await SystemSetting.findOne({ where: { key: 'is_affiliate_rewards_enabled' }, transaction: t });
        if (setting && setting.value === 'true') {
          const product = await AffiliateProduct.findOne({
            order: [sequelize.random()],
            transaction: t
          });
          if (product) {
            assignedReward = {
              id: product.id,
              title: product.title,
              category: product.category,
              subcategory: product.subcategory,
              imageUrl: product.imageUrl,
              affiliateLink: product.affiliateLink
            };
            console.log(`🎁 [REWARD] Assigned reward: ${product.title}`);
          }
        }
      } catch (rewardErr) {
        console.error("⚠️ [REWARD] Error assigning reward (non-blocking):", rewardErr.message);
      }

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
            totalOrderNumber,
            isParcel: finalIsParcel,
            parcelAmount: finalParcelAmount,
            platformFee: Number(platformFee) || 0,
            commissionAmount: Number(commissionAmount) || 0,
            gstAmount: Number(gstAmount) || 0,
            orderType: finalOrderType,
            deliveryAddress: finalAddress,
            latitude: finalLat,
            longitude: finalLng,
            deliveryOrderId: null,
            affiliateReward: assignedReward, // ✅ Store reward here
          },
          { transaction: t }
        );

        console.log(`✅ [DATABASE] Order #${order.id} created. Full Data:`, JSON.stringify(order, null, 2));
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
      console.log("📝 [DATABASE] Order already exists, updating status");
      kotNumber = order.kotNumber;
      billId = order.billId;
      dailyOrderNumber = order.dailyOrderNumber;

      const updateData = {
        status: "PAID",
        paymentStatus: "SUCCESS",
        isParcel: finalIsParcel,
        parcelAmount: finalParcelAmount,
        platformFee: Number(platformFee) || 0,
        commissionAmount: Number(commissionAmount) || 0,
        gstAmount: Number(gstAmount) || 0,
        orderType: finalOrderType,
        deliveryAddress: finalAddress || order.deliveryAddress,
        latitude: finalLat || order.latitude,
        longitude: finalLng || order.longitude,
        deliveryOrderId: order.deliveryOrderId,
      };

      if (!order.dailyOrderNumber) {
        dailyOrderNumber = await generateDailyOrderNumber(cafeteriaId, t);
        updateData.dailyOrderNumber = dailyOrderNumber;
      }

      if (!order.totalOrderNumber) {
        totalOrderNumber = await generateTotalOrderNumber(t);
        updateData.totalOrderNumber = totalOrderNumber;
      }

      if (!order.billId || order.billId.includes('TEMP')) {
        billId = await generateBillId(cafeteriaId, t);
        updateData.billId = billId;
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
    const zeroStockItems = [];
    if (Array.isArray(items) && items.length > 0) {
      // 📂 FETCH CATEGORIES: For Printer Splitting
      formattedItems = await Promise.all(items.map(async (item) => {
        let miId = item.menuItemId || item.id || item.menu_item_id || null;
        if (miId && isNaN(miId)) {
          miId = null; // Prevent integer conversion errors in DB
        }
        let category = item.category || null;

        if (miId && !category && !isNaN(miId)) {
          const mi = await MenuItem.findByPk(miId, { transaction: t });
          category = mi?.category || null;
        }

        const isParcelForThisItem = Boolean(item.isParcelSelected);
        return {
          orderId: order.id,
          menuItemId: miId,
          name: item.name,
          quantity: item.quantity || item.qty,
          priceAtOrder: item.price,
          imageUrl: item.imageUrl || item.img || null,
          isParcel: isParcelForThisItem,
          specialInstructions: item.specialInstructions || item.note || null,
          category: category, // 📂 Essential for printing
        };
      }));

      const existingItem = await OrderItem.findOne({
        where: { orderId: order.id },
        transaction: t,
      });

      if (!existingItem) {
        console.log("🧺 [ITEMS] Creating order items...");
        await OrderItem.bulkCreate(formattedItems, { transaction: t });
        console.log(`✅ Created ${formattedItems.length} order items`);

        // 📦 [STOCK] Update stock for all items — collect zero-stock items, emit AFTER commit
        for (const item of formattedItems) {
          if (!item.menuItemId || isNaN(item.menuItemId)) continue; // skip items with no numeric menu item reference

          const menuItem = await MenuItem.findByPk(item.menuItemId, {
            transaction: t,
          });
          if (!menuItem) continue;

          const newStock = Math.max(0, menuItem.stock - item.quantity);
          console.log(
            `📦 [STOCK] Online order: ${menuItem.name} ${menuItem.stock} → ${newStock}`
          );

          const updates = { stock: newStock };
          if (newStock === 0) {
            console.log(`📉 [STOCK] ${menuItem.name} hit 0 — will emit after commit`);
            zeroStockItems.push({ id: menuItem.id, name: menuItem.name });
          }

          await menuItem.update(updates, { transaction: t });
        }
      }
    }

    // ========================================
    // 🎯 UPDATE USER STREAK
    // ========================================
    await updateUserStreak(authenticatedStudentId, cafeteriaId, t);

    await t.commit();

    // ⚡ Evict the verify-status cache now that the order is confirmed.
    // This ensures any subsequent verify call (e.g. a late retry) hits
    // Cashfree fresh instead of getting a stale cached PENDING/UNKNOWN.
    delCache(paymentStatusCacheKey(cashfreeOrderId)).catch(() => {});

    // 🔔 Emit STOCK alerts AFTER commit
    for (const item of zeroStockItems) {
      console.log(`📢 [STOCK] Emitting STOCK_UPDATE for: ${item.name}`);
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
          orderType: order.orderType,
          deliveryAddress: order.deliveryAddress,
          latitude: order.latitude,
          longitude: order.longitude,
          parcelAmount: order.parcelAmount,
          deliveryOrderId: order.deliveryOrderId,
          netAmount: Number(order.totalAmount) - Number(order.platformFee || 0) - Number(order.commissionAmount || 0),
          dailyOrderNumber: order.dailyOrderNumber,
          totalOrderNumber: totalOrderNumber || order.totalOrderNumber,
          items: formattedItems,
          customerName: req.user.name || "Customer",
        });

        const queryCafeteriaId = Number(cafeteriaId || order.cafeteriaId);
        const adminTokens = await AdminFcmToken.findAll({
          where: { cafeteriaId: queryCafeteriaId },
        });

        console.log(`📊 [PAYMENT_NOTIFY] Found ${adminTokens.length} FCM tokens for cafeteria ${queryCafeteriaId}`);

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
              notification: { 
                channelId: "high_importance_channel_v2", 
                sound: "new_order" 
              },
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: "🍽 New Order Received",
                    body: `KOT ${order.kotNumber} • ₹${order.totalAmount}`,
                  },
                  sound: "new_order.caf", // or "default" if .caf is missing, but "new_order" is better
                  badge: 1,
                  "content-available": 1,
                },
              },
            },
          });

          console.log(`🔔 FCM Result: ${standardNotificationResponse.successCount} success, ${standardNotificationResponse.failureCount} failed`);

            // 🧹 ONLY cleanup tokens that are explicitly UNREGISTERED
            const tokensToDelete = [];
            standardNotificationResponse.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const errorCode = resp.error?.code;
                console.log(`  ❌ FCM Token ${idx} failed | Error: ${errorCode} | Msg: ${resp.error?.message}`);
                
                // Delete tokens that are permanently invalid:
                // - registration-token-not-registered: app uninstalled
                // - invalid-registration: malformed token
                // - third-party-auth-error: token from a different Firebase project
                if (
                  errorCode === "messaging/registration-token-not-registered" ||
                  errorCode === "messaging/invalid-registration" ||
                  errorCode === "messaging/third-party-auth-error"
                ) {
                  tokensToDelete.push(adminTokens[idx].fcmToken);
                }
              }
            });

            if (tokensToDelete.length > 0) {
              await AdminFcmToken.destroy({ where: { fcmToken: tokensToDelete } });
              console.log(`🧹 Cleaned up ${tokensToDelete.length} stale/invalid admin tokens`);
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
          phone: order.phone,
          orderType: order.orderType,
          deliveryOrderId: order.deliveryOrderId,
          deliveryAddress: order.deliveryAddress,
          latitude: order.latitude,
          longitude: order.longitude,
          items: items,
          status: order.status,
          paymentStatus: order.paymentStatus,
          kotNumber: order.kotNumber,
          dailyOrderNumber: order.dailyOrderNumber,
          totalOrderNumber: order.totalOrderNumber,
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
      dailyOrderNumber: dailyOrderNumber || order.dailyOrderNumber,
      totalOrderNumber: totalOrderNumber || order.totalOrderNumber,
      billId: billId || order.billId,
      kotNumber,
      affiliateReward: order.affiliateReward,
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

    // ================================================================
    // 🔀 PROXY TO FINANCE BACKEND (Development / Emulator mode)
    // In production, verify is done directly against Cashfree.
    // In development, we proxy through the Finance Emulator so that
    // sandbox credentials are used correctly.
    // ================================================================
    const financeBackendUrl = process.env.FINANCE_BACKEND_URL;
    if (financeBackendUrl && env !== "production") {
      if (!financeBackendUrl) {
        console.error("❌ [VERIFY] FINANCE_BACKEND_URL is not configured");
        return res.status(500).json({ success: false, message: "Finance backend URL not configured" });
      }

      const verifyUrl = financeBackendUrl.replace(/createCashfreeOrder/i, "verifyCashfreePayment");
      console.log(`🔀 [VERIFY PROXY] Routing to Finance Emulator: ${verifyUrl}`);
      try {
        const proxyResponse = await axios.post(verifyUrl, { orderId }, {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.WEBHOOK_API_KEY,
          },
          timeout: 15000,
        });
        return res.status(200).json(proxyResponse.data);
      } catch (proxyErr) {
        console.error("❌ [VERIFY PROXY] Error:", proxyErr?.response?.data || proxyErr.message);
        return res.status(proxyErr?.response?.status || 500).json({
          success: false,
          message: "Failed to verify via Finance Emulator",
          error: proxyErr?.response?.data || proxyErr.message,
        });
      }
    }

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: `Payment gateway credentials for ${env} not configured`,
      });
    }

    // ================================================================
    // ⚡ REDIS CACHE CHECK — avoid hammering Cashfree API on retries
    // The Flutter app retries up to 6 times on PENDING status (18s window).
    // Without caching that's 6 Cashfree API calls per payment — causing
    // the 16,000+ violations/12h seen on the Cashfree dashboard.
    // With caching: all 6 retries share 1 Cashfree call per TTL window.
    // ================================================================
    const cacheKey = paymentStatusCacheKey(orderId);
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ [VERIFY] Cache HIT for ${orderId} → ${cached.paymentStatus}`);
      return res.json(cached);
    }

    console.log(`🔍 [VERIFY] Cache MISS — calling Cashfree for: ${orderId} (${env})`);

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
        const successfulPayment = payments.find(p => p.payment_status === "SUCCESS");
        if (successfulPayment) {
          paymentStatus = "SUCCESS";
        } else {
          const latest = payments[payments.length - 1];
          paymentStatus = latest.payment_status || "";
        }
      }
    } catch (payErr) {
      console.log("⚠️ [VERIFY] /payments endpoint error:", payErr.message);
    }

    if (!paymentStatus) {
      // Wrap in try/catch — a 404 here means order doesn't exist in Cashfree.
      // Previously this threw straight to the outer catch, bypassing setCache.
      try {
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
      } catch (orderErr) {
        if (orderErr.response?.status === 404) {
          // Cache the NOT_FOUND response so repeated retries don't hit Cashfree
          const notFoundPayload = {
            success: false,
            paymentStatus: "NOT_FOUND",
            message: `Order not found in Cashfree (${env}).`,
          };
          await setCache(cacheKey, notFoundPayload, PAYMENT_STATUS_PENDING_TTL);
          return res.status(404).json(notFoundPayload);
        }
        throw orderErr; // re-throw non-404 errors to the outer catch
      }
    }

    const isSuccess = orderStatus === "PAID" || paymentStatus === "SUCCESS";

    console.log(`📊 [VERIFY] orderStatus=${orderStatus}, paymentStatus=${paymentStatus}, isSuccess=${isSuccess}`);

    const responsePayload = {
      success: true,
      paymentStatus: isSuccess ? "SUCCESS" : (paymentStatus || orderStatus || "UNKNOWN"),
      orderStatus,
      message: isSuccess ? "Payment verified successfully" : `Payment not completed: ${paymentStatus || orderStatus}`,
    };

    const isFinal = isSuccess; // FAILED/USER_DROPPED are not final since user can retry
    const ttl = isFinal ? PAYMENT_STATUS_FINAL_TTL : PAYMENT_STATUS_PENDING_TTL;
    await setCache(cacheKey, responsePayload, ttl);

    return res.json(responsePayload);

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
    const { 
      cashfreeOrderId, 
      paymentId, 
      orderStatus, 
      paymentStatus,
      refundStatus,
      refundId,
      eventType 
    } = req.body;

    console.log(`📥 [WEBHOOK SYNC] Type: ${eventType || 'PAYMENT'}, Order: ${cashfreeOrderId}`);

    // ==========================================
    // 1️⃣ HANDLE REFUND WEBHOOKS
    // ==========================================
    if (eventType?.startsWith("REFUND_") || refundStatus) {
      if (!cashfreeOrderId || (!refundId && !paymentId)) {
        await t.rollback();
        return res.json({ success: true, message: "Invalid refund webhook" });
      }

      const payment = await Payment.findOne({
        where: { cashfreeOrderId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!payment) {
        await t.rollback();
        return res.json({ success: true, message: "Payment record for refund not found" });
      }

      const isSuccess = eventType === "REFUND_SUCCESS" || refundStatus === "SUCCESS";
      const isFailed = eventType === "REFUND_FAILED" || refundStatus === "FAILED" || eventType === "REFUND_REJECTED";
      const finalRefundStatus = isSuccess ? "SUCCESS" : (isFailed ? "FAILED" : "PENDING");
      
      console.log(`💸 [WEBHOOK REFUND] Type: ${eventType}, Status: ${refundStatus} -> Final: ${finalRefundStatus}`);

      await payment.update(
        { status: finalRefundStatus, refundId: refundId || payment.refundId },
        { transaction: t }
      );

      if (payment.orderId && isSuccess) {
        const order = await Order.findByPk(payment.orderId, { transaction: t });
        if (order) {
          await order.update({ status: "REFUND_SUCCESS" }, { transaction: t });
          
          // 📊 GOOGLE SHEETS DYNAMIC UPDATE
          updateOrderStatusInSheet(order.id, "REFUND_SUCCESS").catch(err => 
            console.error("⚠️ Sheets refund update error:", err.message)
          );

          // 🔔 NOTIFY USER OF REFUND STATUS
          (async () => {
              try {
                const userTokens = await UserFcmToken.findAll({ where: { userId: order.studentId } });
                if (userTokens.length > 0) {
                  const tokens = userTokens.map(t => t.fcmToken);
                  await admin.messaging().sendEachForMulticast({
                    tokens,
                    notification: {
                      title: "💰 Refund Processed",
                      body: `Your refund of ₹${order.totalAmount} for Order #${order.dailyOrderNumber ?? order.id} is successful.`,
                    },
                    data: {
                      orderId: String(order.id),
                      status: "REFUND_SUCCESS",
                      type: "REFUND_UPDATE"
                    },
                    android: {
                      priority: "high",
                      notification: {
                        channelId: "high_importance_channel",
                        sound: "default",
                        clickAction: "FLUTTER_NOTIFICATION_CLICK"
                      }
                    },
                    apns: {
                      payload: {
                        aps: {
                          sound: "default",
                          badge: 1
                        }
                      }
                    }
                  });
                  console.log("🔔 User notified of refund success via webhook sync");
                }
              } catch (e) {
                console.error("⚠️ Failed to notify user of refund via sync:", e.message);
              }
            })();
        }
      }

      await t.commit();
      return res.json({ success: true, message: `Refund sync successful: ${finalRefundStatus}` });
    }

    // ==========================================
    // 2️⃣ HANDLE PAYMENT WEBHOOKS (Existing Logic)
    // ==========================================
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
      // =====================================================================
      // 🚨 NO PAYMENT RECORD — /confirm never ran (app crashed / network drop)
      // Check if we have an order snapshot saved at /create time.
      // If yes, auto-create the full order now so the user's payment is not
      // lost. If no snapshot, fall back to pending_webhooks (old behavior).
      // =====================================================================
      const snapshots = await sequelize.query(
        `SELECT * FROM order_snapshots WHERE cashfree_order_id = :cashfreeOrderId LIMIT 1`,
        {
          replacements: { cashfreeOrderId },
          type: QueryTypes.SELECT,
        }
      ).catch(() => []); // Table might not exist yet on first deploy — ignore

      const snap = snapshots[0];

      if (!snap) {
        // No snapshot — save to pending_webhooks as before
        await sequelize.query(
          `INSERT INTO pending_webhooks (cashfree_order_id, payment_id)
           VALUES (:orderId, :paymentId)
           ON CONFLICT (cashfree_order_id)
           DO UPDATE SET payment_id = EXCLUDED.payment_id`,
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

      console.log(`🚨 [WEBHOOK RECOVERY] /confirm never ran for ${cashfreeOrderId}. Auto-creating order from snapshot.`);

      // Check if an order already exists (e.g. /confirm ran concurrently)
      let recoveredOrder = await Order.findOne({
        where: { cashfreeOrderId },
        transaction: t,
      });

      if (!recoveredOrder) {
        const snapCafeteriaId = snap.cafeteria_id;
        const snapStudentId   = snap.student_id;
        const snapAmount      = snap.amount;
        const snapItems       = Array.isArray(snap.items) ? snap.items : JSON.parse(snap.items || "[]");

        const kotNumber        = await generateKotNumber(snapCafeteriaId, t);
        const dailyOrderNumber = await generateDailyOrderNumber(snapCafeteriaId, t);
        const totalOrderNumber = await generateTotalOrderNumber(t);
        const billId           = await generateBillId(snapCafeteriaId, t);

        recoveredOrder = await Order.create(
          {
            cashfreeOrderId,
            billId,
            studentId:       snapStudentId,
            cafeteriaId:     snapCafeteriaId,
            totalAmount:     snapAmount,
            status:          "PAID",
            paymentStatus:   "SUCCESS",
            paymentMethod:   "ONLINE",
            kotNumber,
            dailyOrderNumber,
            totalOrderNumber,
            commissionAmount: Number(snap.commission_amount) || 0,
            platformFee:      Number(snap.platform_fee) || 0,
            gstAmount:        Number(snap.gst_amount) || 0,
            isParcel:         Boolean(snap.is_parcel),
            parcelAmount:     Number(snap.parcel_amount) || 0,
            orderType:        snap.order_type || 'DINE_IN',
            deliveryAddress:  snap.delivery_address || null,
            latitude:         snap.latitude || null,
            longitude:        snap.longitude || null,
            deliveryOrderId: null,
          },
          { transaction: t }
        );

        // Create order items
        if (snapItems.length > 0) {
          const formattedItems = snapItems.map((item) => ({
            orderId:     recoveredOrder.id,
            menuItemId:  item.menuItemId || item.id || null,
            name:        item.name,
            quantity:    item.quantity || item.qty || 1,
            priceAtOrder: item.price,
            imageUrl:    item.imageUrl || item.img || null,
            isParcel:    Boolean(item.isParcelSelected),
            specialInstructions: item.note || null,
          }));
          await OrderItem.bulkCreate(formattedItems, { transaction: t });

          // 📦 [STOCK] Deduct inventory securely
          for (const item of formattedItems) {
            if (!item.menuItemId) continue;
            const menuItem = await sequelize.models.MenuItem.findByPk(item.menuItemId, { transaction: t });
            if (!menuItem) continue;

            const newStock = Math.max(0, menuItem.stock - item.quantity);
            const updates = { stock: newStock };
            if (newStock === 0) updates.isAvailable = false;
            
            await menuItem.update(updates, { transaction: t });
            console.log(`📦 [WEBHOOK STOCK] ${menuItem.name} ${menuItem.stock} → ${newStock}`);
          }
        }

        await updateUserStreak(snapStudentId, snapCafeteriaId, t);

        console.log(`✅ [WEBHOOK RECOVERY] Order ${recoveredOrder.id} created. KOT: ${kotNumber}`);
      }

      // Create the payment record now
      await Payment.create(
        {
          orderId:         recoveredOrder.id,
          billId:          recoveredOrder.billId,
          cafeteriaId:     recoveredOrder.cafeteriaId,
          paymentGateway:  "CASHFREE",
          cashfreeOrderId,
          transactionId:   paymentId,
          amount:          recoveredOrder.totalAmount,
          status:          "SUCCESS",
          paidAt:          new Date(),
        },
        { transaction: t }
      );

      // Delete the snapshot — no longer needed
      await sequelize.query(
        `DELETE FROM order_snapshots WHERE cashfree_order_id = :cashfreeOrderId`,
        { replacements: { cashfreeOrderId }, transaction: t }
      );

      await t.commit();

      // Notify admin (async, non-blocking)
      (async () => {
        try {
          // 📋 FETCH ITEMS FOR SOCKET (including categories)
          const itemsForSocket = await OrderItem.findAll({
            where: { orderId: recoveredOrder.id }
          });

          emitNewOrder(recoveredOrder.cafeteriaId, {
            orderId:          recoveredOrder.id,
            id:               recoveredOrder.id,
            billId:           recoveredOrder.billId,
            kotNumber:        recoveredOrder.kotNumber,
            totalAmount:      recoveredOrder.totalAmount,
            status:           recoveredOrder.status,
            createdAt:        recoveredOrder.createdAt,
            isParcel:         recoveredOrder.isParcel,
            orderType:        recoveredOrder.orderType,
            deliveryAddress:  recoveredOrder.deliveryAddress,
            latitude:         recoveredOrder.latitude,
            longitude:        recoveredOrder.longitude,
            dailyOrderNumber: recoveredOrder.dailyOrderNumber,
            deliveryOrderId:  recoveredOrder.deliveryOrderId,
            items:            itemsForSocket,
          });

          const adminTokens = await AdminFcmToken.findAll({ where: { cafeteriaId: recoveredOrder.cafeteriaId } });
          if (adminTokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
              tokens: adminTokens.map((t) => t.fcmToken),
              notification: {
                title: "🍽 New Order Received",
                body: `KOT ${recoveredOrder.kotNumber} • ₹${recoveredOrder.totalAmount}`,
              },
              data: {
                type: "NEW_ORDER",
                orderId: String(recoveredOrder.id),
                kotNumber: recoveredOrder.kotNumber || "",
                cafeteriaId: String(recoveredOrder.cafeteriaId),
              },
              android: { priority: "high", notification: { channelId: "high_importance_channel_v2", sound: "new_order" } },
            });
          }

          // Notify the User (Student) to confirm background order
          try {
            const userTokens = await UserFcmToken.findAll({ where: { userId: recoveredOrder.studentId } });
            if (userTokens.length > 0) {
              await admin.messaging().sendEachForMulticast({
                tokens: userTokens.map((t) => t.fcmToken),
                notification: {
                  title: "✅ Payment Successful",
                  body: `Your delayed payment was processed. Order placed and sent to the cafeteria!`,
                },
                data: {
                  type: "ORDER_RECOVERED",
                  orderId: String(recoveredOrder.id),
                },
                android: { priority: "high", notification: { channelId: "high_importance_channel", sound: "default" } },
                apns: { payload: { aps: { sound: "default", badge: 1 } } },
              });
            }
          } catch (userNotifyErr) {
            console.error("⚠️ [WEBHOOK RECOVERY] Failed to notify user:", userNotifyErr.message);
          }

          clearAnalyticsCache(recoveredOrder.cafeteriaId).catch(() => {});
        } catch (notifyErr) {
          console.error("⚠️ [WEBHOOK RECOVERY] Notification error:", notifyErr.message);
        }
      })();

      return res.json({
        success: true,
        message: "Webhook recovery: order auto-created from snapshot",
        cashfreeOrderId,
        orderId: recoveredOrder.id,
        kotNumber: recoveredOrder.kotNumber,
      });
    }

    await payment.update(
      { paymentId, status: "SUCCESS", paidAt: new Date() },
      { transaction: t }
    );

    if (payment.orderId) {
      const order = await Order.findByPk(payment.orderId, { transaction: t });
      if (order) {
        const updateData = { status: "PAID", paymentStatus: "SUCCESS" };

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

    // 🗑️ INVALIDATE ANALYTICS CACHE
    if (payment.orderId) {
      const syncedOrder = await Order.findByPk(payment.orderId);
      if (syncedOrder?.cafeteriaId) {
        clearAnalyticsCache(syncedOrder.cafeteriaId).catch(err =>
          console.warn("⚠️ Analytics cache clear error (webhook, non-blocking):", err.message)
        );
      }
    }

    // 📊 GOOGLE SHEETS SYNC
    if (payment.orderId) {
      (async () => {
        try {
          const syncedOrder = await Order.findByPk(payment.orderId, {
            include: [{ model: OrderItem, as: 'items' }]
          });

          if (syncedOrder) {
            const student = await sequelize.models.User.findByPk(syncedOrder.studentId);

            await appendOrderToSheet({
              id: syncedOrder.id,
              dailyOrderNumber: syncedOrder.dailyOrderNumber,
              billId: syncedOrder.billId,
              studentId: syncedOrder.studentId,
              customerName: student?.name || "Customer",
              cafeteriaId: syncedOrder.cafeteriaId,
              totalAmount: syncedOrder.totalAmount,
              items: syncedOrder.items,
              status: syncedOrder.status,
              paymentStatus: syncedOrder.paymentStatus,
              kotNumber: syncedOrder.kotNumber,
              createdAt: syncedOrder.createdAt
            });
            console.log(`📊 [WEBHOOK] Order #${syncedOrder.id} synced to Sheets`);
          }
        } catch (sheetErr) {
          console.error("⚠️ Sheets sync error (webhook):", sheetErr.message);
        }
      })();
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