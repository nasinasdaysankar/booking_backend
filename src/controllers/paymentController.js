import { Payment, Order, OrderItem, sequelize } from "../models/index.js";

export const confirmPayment = async (req, res) => {
  // Use a transaction to ensure database integrity
  const t = await sequelize.transaction();

  try {
    const {
      orderId,        // Cashfree orderId (string)
      billId,
      cafeteriaId,
      paymentId,
      transactionId,
      amount,
      items
    } = req.body;

    // 🛡️ SECURITY: Extract studentId from the verified AUTH token
    const authenticatedStudentId = req.user.id; 

    // 1. Validate required fields
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

    if (!order) {
      console.log(`⚠️ Creating new order for Student ID: ${authenticatedStudentId}`);
      order = await Order.create({
        cashfreeOrderId: orderId,
        billId,
        studentId: authenticatedStudentId,
        cafeteriaId,
        totalAmount: amount,
        status: "PAID", 
        paymentStatus: "SUCCESS",
      }, { transaction: t });
    } else {
      // If order exists, update its status
      await order.update({
        status: "PAID",
        paymentStatus: "SUCCESS",
      }, { transaction: t });
    }

    // ---------------------------------------------------------
    // ✅ STEP 2: SAVE PAYMENT (avoid duplicates)
    // ---------------------------------------------------------
    const existingPayment = await Payment.findOne({
      where: { transactionId },
      transaction: t
    });

    if (!existingPayment) {
      // 🛠️ FIX: Sync sequence to prevent "id already exists" errors
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
        // ✅ FIX: Use 'menuItemId' as primary key if 'Id' is null in request
        menuItemId: item.menuItemId || item.id || null, 
        name: item.name,
        // ✅ FIX: Check both 'quantity' and 'qty' to prevent null violation
        quantity: item.quantity || item.qty, 
        priceAtOrder: item.price,
        imageUrl: item.imageUrl || item.img || null, 
      }));

      // Validate that no quantity is null before inserting
      const hasInvalidItem = itemsToCreate.some(i => i.quantity === undefined || i.quantity === null);
      if (hasInvalidItem) {
        throw new Error("One or more items are missing a valid quantity.");
      }

      await OrderItem.bulkCreate(itemsToCreate, { transaction: t });
    }

    // Commit all changes
    await t.commit();

    // 🚀 Send success response
    return res.json({
      success: true,
      dbOrderId: order.id,
      billId: order.billId,
      message: "Payment confirmed and order updated."
    });

  } catch (err) {
    // Rollback changes if any error occurs
    if (t) await t.rollback();
    
    console.error("❌ CONFIRM PAYMENT ERROR:", err);

    if (err.name === 'SequelizeUniqueConstraintError') {
       return res.status(400).json({ 
         success: false, 
         error: "This transaction has already been processed." 
       });
    }

    return res.status(500).json({ success: false, error: err.message });
  }
};