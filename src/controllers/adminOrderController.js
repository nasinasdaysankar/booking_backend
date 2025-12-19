// import { sequelize, Order, CafeteriaQr } from "../models/index.js";
// import { QueryTypes, Op } from "sequelize";

// console.log("--------------------------------------------------");
// console.log("✅ LOADED: adminOrderController.js (Static QR Mode)");
// console.log("--------------------------------------------------");

// // ================= ADMIN DASHBOARD FUNCTIONS =================

// /**
//  * 1. Fetch all orders for the Admin Dashboard based on status
//  */
// export const getAdminOrders = async (req, res) => {
//   try {
//     const { status } = req.query;
//     const cafeteriaId = req.user.cafeteriaId; // Isolated to admin's own cafeteria

//     const orders = await sequelize.query(
//       `SELECT * FROM orders WHERE status = :status AND "cafeteriaId" = :cafeteriaId ORDER BY "createdAt" ASC`,
//       {
//         replacements: { 
//             status: status || 'PAID', 
//             cafeteriaId 
//         },
//         type: QueryTypes.SELECT
//       }
//     );

//     if (orders.length === 0) return res.json([]);

//     const orderIds = orders.map(o => o.id);
//     const allItems = await sequelize.query(
//       `SELECT * FROM order_items WHERE "orderId" IN (:ids)`,
//       {
//         replacements: { ids: orderIds },
//         type: QueryTypes.SELECT
//       }
//     );

//     const combinedData = orders.map(order => ({
//       ...order,
//       items: allItems.filter(item => item.orderId === order.id)
//     }));

//     return res.json(combinedData);
//   } catch (err) {
//     console.error("🔥 getAdminOrders Error:", err);
//     return res.status(500).json({ message: "Error fetching orders" });
//   }
// };

// /**
//  * 2. Update status (PAID -> PREPARING -> READY)
//  * Removed all crypto/token generation logic
//  */
// export const updateOrderStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     let { status, etaMinutes } = req.body;

//     if (status) status = status.toString().trim().toUpperCase();

//     const order = await Order.findByPk(id);
//     if (!order) return res.status(404).json({ success: false, message: "Order not found" });

//     const updateData = {};
//     if (status) updateData.status = status;
//     if (etaMinutes !== undefined) updateData.etaMinutes = etaMinutes;

//     await order.update(updateData);

//     return res.json({
//       success: true,
//       message: `Order status updated to ${status}`,
//       order
//     });
//   } catch (err) {
//     console.error("❌ updateOrderStatus Error:", err);
//     return res.status(500).json({ success: false, message: "Failed to update status" });
//   }
// };

// /**
//  * 3. Fetch the Static QR for the Admin Dashboard to display
//  */
// // adminOrderController.js
// export const getMyCafeteriaQR = async (req, res) => {
//   try {
//     // 1. Check if the logged-in person is actually an Admin
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({
//         success: false,
//         message: "Forbidden: Only cafeteria admins can view the static QR."
//       });
//     }

//     const cafeteriaId = req.user.cafeteriaId;

//     if (!cafeteriaId) {
//       return res.status(400).json({
//         success: false,
//         message: "Your admin account is not linked to a cafeteria."
//       });
//     }

//     // 2. Use findOrCreate so the system generates a token if it's missing
//     const [qr, created] = await CafeteriaQr.findOrCreate({
//       where: { cafeteriaId },
//       defaults: {
//         qrToken: `STATIC_QR_CAFETERIA_${cafeteriaId}` 
//       }
//     });

//     return res.json({
//       success: true,
//       qrToken: qr.qrToken
//     });
//   } catch (error) {
//     console.error("❌ getMyCafeteriaQR error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while fetching cafeteria QR",
//     });
//   }
// };
// /**
//  * 4. Mark Order as PAID
//  */
// export const markOrderPaid = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const order = await Order.findByPk(orderId);
//     if (!order) return res.status(404).json({ success: false, message: "Order not found" });

//     await order.update({ status: "PAID" });
//     return res.json({ success: true, message: "Order marked as PAID" });
//   } catch (err) {
//     return res.status(500).json({ success: false, message: "Payment update failed" });
//   }
// };

// // ================= STUDENT / USER FUNCTIONS =================

// /**
//  * 5. Scan Static QR (Identity-based check)
//  */
// export const scanStaticCafeteriaQR = async (req, res) => {
//   try {
//     const { qrToken } = req.body;
//     const studentId = req.user.id;

//     const cafeteriaQr = await CafeteriaQr.findOne({ where: { qrToken } });
//     if (!cafeteriaQr) return res.status(400).json({ success: false, message: "Invalid Cafeteria QR" });

//     const order = await Order.findOne({
//       where: {
//         studentId,
//         cafeteriaId: cafeteriaQr.cafeteriaId,
//         status: { [Op.in]: ["PAID", "PREPARING", "READY"] }
//       },
//       order: [["createdAt", "DESC"]]
//     });

//     if (!order) return res.status(404).json({ success: false, message: "No active order here" });

//     let uiMessage = "";
//     if (order.status === "PAID" || order.status === "PREPARING") {
//       uiMessage = "👨‍🍳 We are cooking your order. Please wait!";
//     } else if (order.status === "READY") {
//       uiMessage = "✅ Your order is ready! Please pick it up.";
//     }

//     return res.json({
//       success: true,
//       status: order.status,
//       message: uiMessage,
//       orderId: order.id
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Scan processing error" });
//   }
// };

// /**
//  * 6. Finalize Pickup (Removes from active scan list)
//  */
// export const confirmOrderPickup = async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     const studentId = req.user.id;

//     const order = await Order.findOne({ where: { id: orderId, studentId } });

//     if (!order || order.status !== "READY") {
//       return res.status(400).json({ success: false, message: "Order not ready for pickup" });
//     }

//     await order.update({ status: "PICKED_UP" });

//     return res.json({
//       success: true,
//       message: "🎉 Order picked up successfully",
//       receipt: {
//         orderId: order.id,
//         billId: order.billId,
//         totalAmount: order.totalAmount,
//         pickedAt: new Date(),
//       }
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Pickup failed" });
//   }
// };
import { sequelize, Order, CafeteriaQr } from "../models/index.js";
import { QueryTypes } from "sequelize";
import { Op } from "sequelize";

console.log("--------------------------------------------------");
console.log("✅ LOADED: adminOrderController.js (Static QR Mode)");
console.log("--------------------------------------------------");

export const getAdminOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    const orders = await sequelize.query(
      `SELECT * FROM orders WHERE status = :status AND "cafeteriaId" = :cafeteriaId ORDER BY "createdAt" ASC`,
      {
        replacements: { status: status || 'PAID', cafeteriaId },
        type: QueryTypes.SELECT
      }
    );

    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map(o => o.id);
    const allItems = await sequelize.query(
      `SELECT * FROM order_items WHERE "orderId" IN (:ids)`,
      { replacements: { ids: orderIds }, type: QueryTypes.SELECT }
    );

    const combinedData = orders.map(order => ({
      ...order,
      items: allItems.filter(item => item.orderId === order.id)
    }));

    return res.json(combinedData);
  } catch (err) {
    console.error("🔥 getAdminOrders Error:", err);
    return res.status(500).json({ message: "Error fetching orders" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, etaMinutes } = req.body;
    if (status) status = status.toString().trim().toUpperCase();

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const updateData = {};
    if (status) updateData.status = status;
    if (etaMinutes !== undefined) updateData.etaMinutes = etaMinutes;

    await order.update(updateData);

    return res.json({ success: true, message: `Order status updated to ${status}`, order });
  } catch (err) {
    console.error("❌ updateOrderStatus Error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

export const getMyCafeteriaQR = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only cafeteria admins can view the static QR."
      });
    }

    const cafeteriaId = req.user.cafeteriaId;
    if (!cafeteriaId) {
      return res.status(400).json({
        success: false,
        message: "Your admin account is not linked to a cafeteria."
      });
    }

    const [qr, created] = await CafeteriaQr.findOrCreate({
      where: { cafeteriaId },
      defaults: { qrToken: `STATIC_QR_CAFETERIA_${cafeteriaId}` }
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

export const markOrderPaid = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    await order.update({ status: "PAID" });
    return res.json({ success: true, message: "Order marked as PAID" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Payment update failed" });
  }
};

// In src/controllers/adminOrderController.js (or a dedicated stats controller)

export const getAdminStats = async (req, res) => {
  try {
    const { range = "daily" } = req.query;
    const cafeteriaId = req.user?.cafeteriaId;

    // Safety check
    if (!cafeteriaId) {
      return res.status(400).json({
        totalRevenue: 0,
        totalOrders: 0,
        pendingOrders: 0,
        avgOrderValue: 0
      });
    }

    let dateFilter = {};
    const now = new Date();

    if (range === "daily") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { [Op.gte]: startOfDay } };
    } else if (range === "weekly") {
      const startOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day; // Sunday as start
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { [Op.gte]: startOfWeek } };
    } else if (range === "monthly") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { [Op.gte]: startOfMonth } };
    }
    // Default: no filter (all time) if range invalid

    const orders = await Order.findAll({
      where: {
        cafeteriaId,
        status: { [Op.in]: ["PAID", "PREPARING", "READY", "PICKED_UP"] },
        ...dateFilter
      },
      attributes: ["totalAmount", "status"]
    });

    const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => 
      o.status === "PAID" || o.status === "PREPARING"
    ).length;

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return res.json({
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      pendingOrders,
      avgOrderValue: Number(avgOrderValue.toFixed(2))
    });

  } catch (error) {
    console.error("❌ getAdminStats error:", error);
    // Return zeros instead of crashing
    return res.json({
      totalRevenue: 0,
      totalOrders: 0,
      pendingOrders: 0,
      avgOrderValue: 0
    });
  }
};