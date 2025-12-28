import { Payment, Order, OrderItem, sequelize } from "../models/index.js";

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
