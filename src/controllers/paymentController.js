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

/* ======================================================
   🔥 USER STREAK HELPER (DO NOT EXPORT)
   ====================================================== */
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
    // ✅ Continue streak
    streak.currentStreak += 1;
  } else if (diff > 1) {
    // ❌ Missed a day → reset
    streak.currentStreak = 1;
  } else {
    // Same day order → ignore
    return;
  }

  streak.lastOrderDate = today;
  streak.maxStreak = Math.max(
    streak.maxStreak,
    streak.currentStreak
  );

  await streak.save({ transaction });
}

/* ======================================================
   ✅ CONFIRM PAYMENT (FROM FLUTTER APP)
   Called immediately after Cashfree payment completes
   Webhook will update paymentId later with real pay_xxx
   ====================================================== */
export const confirmPayment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      orderId: cashfreeOrderId, // ORDER_xxx from Cashfree
      billId,
      cafeteriaId,
      transactionId,
      amount,
      items,
      isParcel
    } = req.body;

    const authenticatedStudentId = req.user.id;

    console.log("💳 Payment confirmation request:", {
      cashfreeOrderId,
      billId,
      cafeteriaId,
      amount,
      studentId: authenticatedStudentId
    });

    if (!cashfreeOrderId || !billId || !cafeteriaId || !amount || !transactionId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields."
      });
    }

    // ---------------------------------------------------------
    // STEP 1: FIND OR CREATE ORDER
    // ---------------------------------------------------------
    let order = await Order.findOne({
      where: { cashfreeOrderId: cashfreeOrderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let kotNumber = null;

    if (!order) {
      // Generate KOT number for new order
      kotNumber = await generateKotNumber(cafeteriaId, t);

      console.log("📝 Creating new order with KOT:", kotNumber);

      order = await Order.create({
        cashfreeOrderId: cashfreeOrderId,
        billId,
        studentId: authenticatedStudentId,
        cafeteriaId,
        totalAmount: amount,
        status: "PAID",
        paymentStatus: "SUCCESS",
        kotNumber,
        isParcel: isParcel || false,
      }, { transaction: t });

      console.log("✅ Order created:", order.id);
    } else {
      // Order exists, update it
      kotNumber = order.kotNumber;

      await order.update({
        status: "PAID",
        paymentStatus: "SUCCESS",
      }, { transaction: t });

      console.log("✅ Order updated:", order.id);
    }

    // ---------------------------------------------------------
    // STEP 2: CREATE PAYMENT RECORD (IDEMPOTENT)
    // ❌ DO NOT SET paymentId HERE - webhook will do it
    // ---------------------------------------------------------
    const existingPayment = await Payment.findOne({
      where: { transactionId },
      transaction: t
    });

    if (!existingPayment) {
      console.log("💳 Creating payment record (paymentId will come from webhook)");
      
      await Payment.create({
        orderId: order.id,
        billId,
        cafeteriaId,
        paymentGateway: "CASHFREE",
        // ❌ DON'T SET paymentId - webhook will update it with real pay_xxx
        cashfreeOrderId: cashfreeOrderId, // ORDER_xxx (temporary)
        transactionId,
        amount,
        status: "SUCCESS",
        paidAt: new Date(),
      }, { transaction: t });

      console.log("✅ Payment record created (awaiting webhook for real paymentId)");
    } else {
      console.log("ℹ️ Payment already exists:", existingPayment.id);
    }

    // ---------------------------------------------------------
    // STEP 3: SAVE ORDER ITEMS
    // ---------------------------------------------------------
    const existingItem = await OrderItem.findOne({
      where: { orderId: order.id },
      transaction: t
    });

    if (!existingItem && Array.isArray(items) && items.length > 0) {
      const itemsToCreate = items.map(item => ({
        orderId: order.id,
        menuItemId: item.menuItemId || item.id || null,
        name: item.name,
        quantity: item.quantity || item.qty,
        priceAtOrder: item.price,
        imageUrl: item.imageUrl || item.img || null,
      }));

      const hasInvalidItem = itemsToCreate.some(
        i => i.quantity === undefined || i.quantity === null
      );

      if (hasInvalidItem) {
        throw new Error("One or more items are missing a valid quantity.");
      }

      await OrderItem.bulkCreate(itemsToCreate, { transaction: t });
      console.log(`✅ Created ${itemsToCreate.length} order items`);
    }

    // ---------------------------------------------------------
    // STEP 3.5: UPDATE USER STREAK
    // ---------------------------------------------------------
    await updateUserStreak(
      authenticatedStudentId,
      cafeteriaId,
      t
    );

    // ---------------------------------------------------------
    // STEP 4: COMMIT TRANSACTION
    // ---------------------------------------------------------
    await t.commit();
    console.log("✅ Transaction committed successfully");

    // ---------------------------------------------------------
    // 🔔 STEP 5: POST-COMMIT (SAFE ZONE)
    // ---------------------------------------------------------
    try {
      // SOCKET NOTIFICATION
      emitNewOrder(cafeteriaId, {
        orderId: order.id,
        billId: order.billId,
        kotNumber: order.kotNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt
      });

      console.log("📡 Socket event emitted");

      // FCM NOTIFICATION TO ADMINS
      const adminTokens = await AdminFcmToken.findAll({
        where: { cafeteriaId },
      });

      if (adminTokens.length > 0) {
        await admin.messaging().sendEachForMulticast({
          tokens: adminTokens.map(t => t.fcmToken),
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
      // ⚠️ DO NOT FAIL PAYMENT FOR NOTIFICATIONS
      console.error("⚠️ Notification error (ignored):", notifyErr);
    }

    // ---------------------------------------------------------
    // STEP 6: RESPONSE
    // ---------------------------------------------------------
    return res.json({
      success: true,
      dbOrderId: order.id,
      billId: order.billId,
      kotNumber,
      message: "Payment confirmed successfully. Order sent to cafeteria."
    });

  } catch (err) {
    // ---------------------------------------------------------
    // SAFE ROLLBACK
    // ---------------------------------------------------------
    if (!t.finished) {
      await t.rollback();
    }

    console.error("❌ CONFIRM PAYMENT ERROR:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        error: "This transaction has already been processed."
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/* ======================================================
   ✅ SYNC FROM WEBHOOK (CALLED BY FIREBASE FUNCTION)
   Updates payment record with real pay_xxx from Cashfree
   ====================================================== */
export const syncFromWebhook = async (req, res) => {
  try {
    const { 
      cashfreeOrderId, 
      paymentId, 
      orderStatus, 
      paymentStatus,
      paymentAmount 
    } = req.body;

    console.log("🔄 Webhook sync request:", {
      cashfreeOrderId,
      paymentId,
      orderStatus,
      paymentStatus
    });

    if (!cashfreeOrderId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: "Missing cashfreeOrderId or paymentId"
      });
    }

    // Validate paymentId format
    if (!paymentId.startsWith("pay_")) {
      console.error("❌ Invalid paymentId format:", paymentId);
      return res.status(400).json({
        success: false,
        message: "Invalid paymentId format. Expected pay_xxx"
      });
    }

    // ---------------------------------------------------------
    // UPDATE PAYMENT RECORD WITH REAL pay_xxx
    // ---------------------------------------------------------
    const [updateCount] = await Payment.update(
      { 
        paymentId: paymentId, // ✅ REAL pay_xxx from webhook
        status: paymentStatus === "SUCCESS" ? "SUCCESS" : "FAILED",
        updatedAt: new Date()
      },
      { 
        where: { cashfreeOrderId: cashfreeOrderId }
      }
    );

    if (updateCount === 0) {
      console.warn("⚠️ No payment found for cashfreeOrderId:", cashfreeOrderId);
      return res.status(404).json({
        success: false,
        message: "Payment record not found"
      });
    }

    console.log(`✅ Payment synced: ${cashfreeOrderId} -> ${paymentId}`);

    // ---------------------------------------------------------
    // UPDATE ORDER STATUS IF NEEDED
    // ---------------------------------------------------------
    if (orderStatus) {
      await Order.update(
        { 
          status: orderStatus,
          paymentStatus: paymentStatus
        },
        { 
          where: { cashfreeOrderId: cashfreeOrderId }
        }
      );
      console.log("✅ Order status updated");
    }

    res.json({
      success: true,
      message: "Payment synced successfully",
      paymentId: paymentId,
      cashfreeOrderId: cashfreeOrderId
    });
  } catch (err) {
    console.error("❌ syncFromWebhook error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/* ======================================================
   ✅ GET PAYMENT BY ORDER ID (FOR VERIFICATION)
   ====================================================== */
export const getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params; // ORDER_xxx

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

    // Check if webhook has arrived yet
    if (!payment.paymentId || !payment.paymentId.startsWith("pay_")) {
      return res.json({
        success: true,
        message: "Payment record exists but webhook pending",
        cashfreeOrderId: payment.cashfreeOrderId,
        paymentId: null,
        webhookPending: true
      });
    }

    return res.json({
      success: true,
      paymentId: payment.paymentId, // pay_xxx ✅
      cashfreeOrderId: payment.cashfreeOrderId,
      status: payment.status,
      webhookPending: false
    });
  } catch (err) {
    console.error("❌ getPaymentByOrderId error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch paymentId",
      error: err.message
    });
  }
};

/* ======================================================
   ✅ LEGACY: UPDATE PAYMENT ID FROM WEBHOOK
   (Kept for backward compatibility)
   ====================================================== */
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