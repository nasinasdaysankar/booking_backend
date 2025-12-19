import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'; // ✅ Import crypto for random string generation
import { Order, OrderItem, MenuItem } from '../models/index.js';

// --------------------------------------------------
// HELPER: GENERATE CUSTOM BILL ID
// Format: AA-X7K9P2M (Prefix + Random Unique String)
// --------------------------------------------------
// Helper to generate a Short, Unique Bill ID
const generateBillId = (cafeteriaId) => {
  let prefix = "GEN";
  const mapping = { 1: "AA", 2: "AR", 3: "DP", 4: "FC" };
  prefix = mapping[Number(cafeteriaId)] || "GEN";

  const randomString = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${randomString}`;
};

// --------------------------------------------------
// ETA CALCULATOR
// --------------------------------------------------
const calculateETA = () => 10; // static ETA or adjust later

// --------------------------------------------------
// CREATE ORDER (Flutter + Menu format supported)
// --------------------------------------------------
export const createOrder = async (req, res) => {
  const t = await Order.sequelize.transaction();
  try {
    const { cafeteriaId, items } = req.body;
    const userId = req.user.id; // Extract ID from JWT

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    let total = 0;
    const finalItems = [];

    // Support both Flutter local cart and Menu-based ID formats
    for (const item of items) {
      const price = Number(item.price || item.priceAtOrder);
      const qty = Number(item.qty || item.quantity);
      total += price * qty;

      finalItems.push({
        Id: item.Id || 0,
        name: item.name,
        quantity: qty,
        priceAtOrder: price,
        imageUrl: item.img || item.imageUrl || null,
      });
    }

    const order = await Order.create({
      billId: generateBillId(cafeteriaId),
      studentId: userId, // Dynamically linked to logged-in user
      cafeteriaId,
      totalAmount: total.toFixed(2),
      status: "PAID",
      paymentStatus: "SUCCESS",
    }, { transaction: t });

    for (const item of finalItems) {
      await OrderItem.create({
        orderId: order.id,
        ...item
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ success: true, orderId: order.id, billId: order.billId });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
};

// --------------------------------------------------
// GET MY ORDERS
// --------------------------------------------------
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id;

    const orders = await Order.findAll({
      where: { studentId: userId },
      order: [["createdAt", "DESC"]],
    });

    return res.json(orders);
  } catch (err) {
    console.error("🔥 GET MY ORDERS ERROR:", err);
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

// --------------------------------------------------
// GET ORDER BY ID
// --------------------------------------------------
export const getOrderById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const orderId = req.params.id;

    const order = await Order.findOne({
      where: { id: orderId, studentId: userId },
      include: [OrderItem],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json(order);
  } catch (err) {
    console.error("🔥 ORDER FETCH ERROR:", err);
    return res.status(500).json({ message: "Error fetching order" });
  }
};