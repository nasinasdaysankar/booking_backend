import { Payment, Order, OrderItem, sequelize } from "../models/index.js";
import { emitNewOrder } from "../socket.js";
import admin from "../firebase.js";
import { AdminFcmToken } from "../models/index.js";




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

    // 🛡️ AUTH STUDENT ID
    const authenticatedStudentId = req.user.id;

    if (!orderId || !billId || !cafeteriaId || !amount || !transactionId) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Missing required payment fields." });
    }

    // ---------------------------------------------------------
    // ✅ STEP 1: FIND OR CREATE ORDER
    // ---------------------------------------------------------
    let order = await Order.findOne({
      where: { cashfreeOrderId: orderId },
      transaction: t
    });

    let kotNumber = null;

    if (!order) {
      // 🆕 Generate KOT ONLY for first-time paid order
      kotNumber = await generateKotNumber(cafeteriaId, t);

      order = await Order.create({
        cashfreeOrderId: orderId,
        billId,
        studentId: authenticatedStudentId,
        cafeteriaId,
        totalAmount: amount,
        status: "PAID",
        paymentStatus: "SUCCESS",
        kotNumber, // ✅ STORED
      }, { transaction: t });
    } else {
      // If order already exists, do NOT regenerate KOT
      await order.update({
        status: "PAID",
        paymentStatus: "SUCCESS",
      }, { transaction: t });

      kotNumber = order.kotNumber;
    }

    // ---------------------------------------------------------
    // ✅ STEP 2: SAVE PAYMENT (avoid duplicates)
    // ---------------------------------------------------------
    const existingPayment = await Payment.findOne({
      where: { transactionId },
      transaction: t
    });

    if (!existingPayment) {
      await sequelize.query(
        "SELECT setval(pg_get_serial_sequence('payments', 'id'), (SELECT MAX(id) FROM payments))",
        { transaction: t }
      ).catch(() => console.log("Sequence sync skipped (table may be empty)."));

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
    // ✅ STEP 3: SAVE ORDER ITEMS
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

    // ---------------------------------------------------------
    // ✅ COMMIT TRANSACTION
    // ---------------------------------------------------------
    await t.commit();
// 🔔 REALTIME: Notify Admin (WebSocket)
emitNewOrder(cafeteriaId, {
  orderId: order.id,
  billId: order.billId,
  kotNumber: order.kotNumber,
  totalAmount: order.totalAmount,
  status: order.status,
  createdAt: order.createdAt
});
// 🔔 FCM: Push notification to Admin devices
const adminTokens = await AdminFcmToken.findAll({
  where: { cafeteriaId },
});

if (adminTokens.length > 0) {
  await admin.messaging().sendMulticast({
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

    return res.json({
      success: true,
      dbOrderId: order.id,
      billId: order.billId,
      kotNumber: kotNumber, // ✅ RETURNED
      message: "Payment confirmed, KOT generated, and order updated."
    });

  } catch (err) {
    if (t) await t.rollback();

    console.error("❌ CONFIRM PAYMENT ERROR:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        error: "This transaction has already been processed."
      });
    }

    return res.status(500).json({ success: false, error: err.message });
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



