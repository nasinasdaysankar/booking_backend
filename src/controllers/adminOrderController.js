import { sequelize, Order, CafeteriaQr } from "../models/index.js";
import { QueryTypes, Op } from "sequelize";
import { emitNewOrder, emitOrderStatusToUser } from "../socket.js";


console.log("--------------------------------------------------");
console.log("✅ LOADED: adminOrderController.js (Static QR Mode)");
console.log("--------------------------------------------------");

/**
 * ===============================
 * GET ADMIN ORDERS
 * ===============================
 */
export const getAdminOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    const orders = await sequelize.query(
      `SELECT * FROM orders 
       WHERE status = :status 
       AND "cafeteriaId" = :cafeteriaId 
       ORDER BY "createdAt" ASC`,
      {
        replacements: { status: status || "PAID", cafeteriaId },
        type: QueryTypes.SELECT,
      }
    );

    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map((o) => o.id);

    const allItems = await sequelize.query(
      `SELECT * FROM order_items WHERE "orderId" IN (:ids)`,
      {
        replacements: { ids: orderIds },
        type: QueryTypes.SELECT,
      }
    );

    const combinedData = orders.map((order) => ({
      ...order,
      items: allItems.filter((item) => item.orderId === order.id),
    }));

    return res.json(combinedData);
  } catch (err) {
    console.error("🔥 getAdminOrders Error:", err);
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

/**
 * ===============================
 * UPDATE ORDER STATUS
 * ===============================
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, etaMinutes } = req.body;

    if (status) status = status.toString().trim().toUpperCase();

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (etaMinutes !== undefined) updateData.etaMinutes = etaMinutes;

    await order.update(updateData);
    emitNewOrder(order.cafeteriaId, {
  orderId: order.id,
  status: order.status,
  etaMinutes: order.etaMinutes,
  updatedAt: new Date()
});
// 🔔 REALTIME → USER
emitOrderStatusToUser(order.studentId, {
  orderId: order.id,
  status: order.status,
  etaMinutes: order.etaMinutes,
  updatedAt: new Date(),
});


    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order,
    });
  } catch (err) {
    console.error("❌ updateOrderStatus Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update status" });
  }
};

/**
 * ===============================
 * GET CAFETERIA STATIC QR
 * ===============================
 */
export const getMyCafeteriaQR = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only cafeteria admins can view the static QR.",
      });
    }

    const cafeteriaId = req.user.cafeteriaId;
    if (!cafeteriaId) {
      return res.status(400).json({
        success: false,
        message: "Your admin account is not linked to a cafeteria.",
      });
    }

    const [qr] = await CafeteriaQr.findOrCreate({
      where: { cafeteriaId },
      defaults: { qrToken: `STATIC_QR_CAFETERIA_${cafeteriaId}` },
    });

    return res.json({ success: true, qrToken: qr.qrToken });
  } catch (error) {
    console.error("❌ getMyCafeteriaQR error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching cafeteria QR",
    });
  }
};

/**
 * ===============================
 * MARK ORDER PAID
 * ===============================
 */
export const markOrderPaid = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await order.update({ status: "PAID" });

    return res.json({ success: true, message: "Order marked as PAID" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Payment update failed" });
  }
};

/**
 * ===============================
 * GET ADMIN DASHBOARD STATS
 * ===============================
 */
export const getAdminStats = async (req, res) => {
  try {
    const { range = "daily" } = req.query;
    const cafeteriaId = req.user?.cafeteriaId;

    if (!cafeteriaId) {
      return res.json({
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        pendingOrders: 0,
        avgOrderValue: 0,
      });
    }

    let dateFilter = {};
    const now = new Date();

    if (range === "daily") {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      dateFilter = { createdAt: { [Op.gte]: startOfDay } };
    } else if (range === "weekly") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { [Op.gte]: startOfWeek } };
    } else if (range === "monthly") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { [Op.gte]: startOfMonth } };
    }

    const orders = await Order.findAll({
      where: {
        cafeteriaId,
        paymentStatus: "SUCCESS",
        status: { [Op.in]: ["PAID", "PREPARING", "READY", "PICKED_UP"] },
        ...dateFilter,
      },
      attributes: ["totalAmount", "status", "studentId"], // ✅ studentId included
    });

    const totalOrders = orders.length;

    const totalRevenue = orders.reduce(
      (sum, order) => sum + (Number(order.totalAmount) || 0),
      0
    );

    // 👥 TOTAL CUSTOMERS (UNIQUE STUDENTS)
    const uniqueCustomers = new Set(
      orders.map((order) => order.studentId).filter(Boolean)
    );
    const totalCustomers = uniqueCustomers.size;

    const pendingOrders = orders.filter(
      (o) => o.status === "PAID" || o.status === "PREPARING"
    ).length;

    const avgOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return res.json({
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      totalCustomers, // ✅ FIXED
      pendingOrders,
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
    });
  } catch (error) {
    console.error("❌ getAdminStats error:", error);
    return res.json({
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      pendingOrders: 0,
      avgOrderValue: 0,
    });
  }
};
