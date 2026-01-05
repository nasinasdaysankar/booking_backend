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

export const confirmPayment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      orderId,
      billId,
      cafeteriaId,
      paymentId,
      transactionId,
      amount,
      items
    } = req.body;

    const authenticatedStudentId = req.user.id;

    if (!orderId || !billId || !cafeteriaId || !amount || !transactionId) {
      if (!t.finished) await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields."
      });
    }

    // ---------------------------------------------------------
    // STEP 1: FIND OR CREATE ORDER
    // ---------------------------------------------------------
    let order = await Order.findOne({
      where: { cashfreeOrderId: orderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let kotNumber = null;

    if (!order) {
      kotNumber = await generateKotNumber(cafeteriaId, t);

      order = await Order.create({
        cashfreeOrderId: orderId,
        billId,
        studentId: authenticatedStudentId,
        cafeteriaId,
        totalAmount: amount,
        status: "PAID",
        paymentStatus: "SUCCESS",
        kotNumber,
      }, { transaction: t });
    } else {
      kotNumber = order.kotNumber;

      await order.update({
        status: "PAID",
        paymentStatus: "SUCCESS",
      }, { transaction: t });
    }

    // ---------------------------------------------------------
    // STEP 2: SAVE PAYMENT (IDEMPOTENT)
    // ---------------------------------------------------------
    const existingPayment = await Payment.findOne({
      where: { transactionId },
      transaction: t
    });

    if (!existingPayment) {
      await Payment.create({
        orderId: order.id,
        billId,
        cafeteriaId,
        paymentGateway: "CASHFREE",
        paymentId,
        cashfreeOrderId: orderId,
        transactionId,
        amount,
        status: "SUCCESS",
        paidAt: new Date(),
      }, { transaction: t });
    }

    // ---------------------------------------------------------
    // STEP 3: SAVE ORDER ITEMS
    // ---------------------------------------------------------
    const existingItem = await OrderItem.findOne({
      where: { orderId: order.id },
      transaction: t
    });

    if (!existingItem && Array.isArray(items)) {
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
    }


     /* ======================================================
       🔥 3.5️⃣ UPDATE USER STREAK (IMPORTANT)
       ====================================================== */
    await updateUserStreak(
      authenticatedStudentId,
      cafeteriaId,
      t
    );

    // ---------------------------------------------------------
    // STEP 4: COMMIT TRANSACTION
    // ---------------------------------------------------------
    await t.commit();

    // ---------------------------------------------------------
    // 🔔 STEP 5: POST-COMMIT (SAFE ZONE)
    // ---------------------------------------------------------
    try {
      // SOCKET
      emitNewOrder(cafeteriaId, {
        orderId: order.id,
        billId: order.billId,
        kotNumber: order.kotNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt
      });

      // FCM
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
      } else {
        console.log("⚠️ No admin FCM tokens found for cafeteria:", cafeteriaId);
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
      message: "Payment confirmed, KOT generated, and order updated."
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





export const getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params; // ORDER_xxx

    const payment = await Payment.findOne({
      where: { cashfreeOrderId: orderId },
      order: [["createdAt", "DESC"]],
    });

    if (!payment || !payment.paymentId) {
      return res.status(404).json({
        message: "Payment not found for this Cashfree order",
      });
    }

    return res.json({
      paymentId: payment.paymentId, // pay_xxx ✅
    });
  } catch (err) {
    console.error("❌ getPaymentByOrderId error:", err);
    return res.status(500).json({
      message: "Failed to fetch paymentId",
    });
  }
};

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



export const syncFromWebhook = async (req, res) => {
  try {
    const { cashfreeOrderId, paymentId, orderStatus } = req.body;

    if (!cashfreeOrderId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: "Missing cashfreeOrderId or paymentId"
      });
    }

    // Update the Payment record with real paymentId from webhook
    await Payment.update(
      { 
        paymentId: paymentId, // ✅ NOW WE HAVE THE REAL pay_xxx
        status: "SUCCESS" 
      },
      { 
        where: { cashfreeOrderId: cashfreeOrderId }
      }
    );

    console.log(`✅ Payment synced: ${cashfreeOrderId} -> ${paymentId}`);

    res.json({
      success: true,
      message: "Payment synced successfully"
    });
  } catch (err) {
    console.error("❌ syncFromWebhook error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



