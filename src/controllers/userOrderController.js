// import {
//   CafeteriaQr,
//   Order,
//   OrderItem,
//   MenuItem,
//   Cafeteria,
// } from "../models/index.js";
// import { Op } from "sequelize";


// // ================= SCAN QR =================
// export const scanStaticCafeteriaQR = async (req, res) => {
//   try {
//     const { qrToken } = req.body;
//     const studentId = req.user.id;

//     const cafeteriaQr = await CafeteriaQr.findOne({
//       where: { qrToken: qrToken?.trim() },
//     });

//     if (!cafeteriaQr) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid QR",
//       });
//     }

//     const activeOrders = await Order.findAll({
//       where: {
//         studentId,
//         cafeteriaId: cafeteriaQr.cafeteriaId,
//         status: { [Op.in]: ["PAID", "PREPARING", "READY"] },
//       },
//       order: [["createdAt", "DESC"]],
//     });

//     if (activeOrders.length > 0) {
//       return res.json({
//         success: true,
//         orders: activeOrders.map((order) => ({
//           orderId: order.id,
//           status: order.status,
//           message:
//             order.status === "READY"
//               ? "Ready, pick it up"
//               : "We are cooking",
//           canPickUp: order.status === "READY",
//         })),
//       });
//     }

//     const pickedOrder = await Order.findOne({
//       where: {
//         studentId,
//         cafeteriaId: cafeteriaQr.cafeteriaId,
//         status: "PICKED_UP",
//       },
//       order: [["updatedAt", "DESC"]],
//     });

//     if (pickedOrder) {
//       return res.status(404).json({
//         success: false,
//         message: "You have already picked it",
//       });
//     }

//     return res.status(404).json({
//       success: false,
//       message: "No active order found",
//     });
//   } catch (error) {
//     console.error("❌ scanStaticCafeteriaQR error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Scan error",
//     });
//   }
// };

// // ================= CONFIRM PICKUP + INVOICE =================
// export const confirmOrderPickup = async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     const studentId = req.user.id;

//     const order = await Order.findOne({
//       where: {
//         id: orderId,
//         studentId,
//         status: "READY",
//       },
//       include: [
//         {
//           model: Cafeteria,
//           attributes: ["name", "location"],
//         },
//         {
//           model: OrderItem,
//           as: "items", // ✅ MATCHES MODEL
//           include: [
//             {
//               model: MenuItem,
//               as: "menuItem", // ✅ MATCHES MODEL
//               attributes: ["name", "price"],
//             },
//           ],
//         },
//       ],
//     });

//     if (!order) {
//       return res.status(400).json({
//         success: false,
//         message: "Order not ready or not yours",
//       });
//     }

//     await order.update({ status: "PICKED_UP" });

//     const invoice = {
//       orderId: order.id,
//       billId: order.billId,
//       cafeteria: order.Cafeteria?.name ?? "",
//       location: order.Cafeteria?.location ?? "",
//       items: order.items.map((i) => ({
//         name: i.menuItem?.name ?? "",
//         quantity: i.quantity,
//         price: i.menuItem?.price ?? 0,
//         total: i.quantity * (i.menuItem?.price ?? 0),
//       })),
//       totalAmount: order.totalAmount,
//       pickedAt: new Date(),
//     };

//     return res.json({
//       success: true,
//       message: "🎉 Picked up successfully!",
//       invoice,
//     });
//   } catch (error) {
//     console.error("❌ confirmOrderPickup error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Pickup error",
//     });
//   }
// };


// userOrderController.js
// Make sure your imports match your actual model export style

import * as models from "../models/index.js";

const { Order, OrderItem } = models;

/**
 * 🔥 SCAN QR CODE - Get complete order with items, prices, and images
 */
export const scanStaticCafeteriaQR = async (req, res) => {
  try {
    const { qrToken } = req.body;
    
    // Get userId from authenticated user
    const userId = req.user?.id;

    console.log("📡 QR Token:", qrToken);
    console.log("👤 Student ID:", userId);

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: "QR token is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Find order by qrToken and studentId (not userId)
    const order = await Order.findOne({
      where: { cashfreeOrderId: qrToken, studentId: userId },
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [
            "id",
            "name",
            "imageUrl",
            "quantity",
            "priceAtOrder",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    console.log("📦 Order Found:", order);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "No active order found",
      });
    }

    // Format response with complete item details
    const formattedOrder = {
      orderId: order.id,
      billId: order.billId,
      kotNumber: order.kotNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl, // Include image URL
        quantity: item.quantity,
        priceAtOrder: parseFloat(item.priceAtOrder),
        itemTotal: parseFloat(item.priceAtOrder) * item.quantity,
      })),
      createdAt: order.createdAt,
    };

    console.log("✅ Formatted Order:", formattedOrder);

    res.json({
      success: true,
      orders: [formattedOrder],
      message: "Order retrieved successfully",
    });
  } catch (error) {
    console.error("❌ SCAN QR ERROR:", error);
    console.error("❌ Error Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error scanning QR code",
      error: error.message,
    });
  }
};

/**
 * 🔥 CONFIRM PICKUP - Get invoice with complete details
 */
export const confirmOrderPickup = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user?.id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Find order using studentId instead of userId
    const order = await Order.findOne({
      where: { id: orderId, studentId: userId },
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [
            "id",
            "name",
            "imageUrl",
            "quantity",
            "priceAtOrder",
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order status to PICKED_UP
    order.status = "PICKED_UP";
    order.pickedUpAt = new Date();
    await order.save();

    // Format invoice with complete details
    const invoice = {
      invoiceNumber: order.billId,
      orderId: order.id,
      kotNumber: order.kotNumber,
      status: order.status,
      pickedUpAt: order.pickedUpAt,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        priceAtOrder: parseFloat(item.priceAtOrder),
        itemTotal: parseFloat(item.priceAtOrder) * item.quantity,
      })),
      subtotal: order.items.reduce(
        (sum, item) => sum + parseFloat(item.priceAtOrder) * item.quantity,
        0
      ),
      tax: order.tax || 0,
      totalAmount: parseFloat(order.totalAmount),
      createdAt: order.createdAt,
    };

    res.json({
      success: true,
      invoice,
      message: "Order picked up successfully",
    });
  } catch (error) {
    console.error("❌ PICKUP CONFIRMATION ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error confirming pickup",
      error: error.message,
    });
  }
};

/**
 * Get active orders with complete item details
 */
export const getActiveOrders = async (req, res) => {
  try {
    const userId = req.user?.id;

    const orders = await Order.findAll({
      where: {
        studentId: userId,
        status: ["PAID", "PREPARING", "READY"],
      },
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [
            "id",
            "name",
            "imageUrl",
            "quantity",
            "priceAtOrder",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const formattedOrders = orders.map((order) => ({
      orderId: order.id,
      billId: order.billId,
      kotNumber: order.kotNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        priceAtOrder: parseFloat(item.priceAtOrder),
        itemTotal: parseFloat(item.priceAtOrder) * item.quantity,
      })),
      createdAt: order.createdAt,
    }));

    res.json({
      success: true,
      orders: formattedOrders,
      message: "Active orders retrieved",
    });
  } catch (error) {
    console.error("❌ GET ACTIVE ORDERS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching active orders",
      error: error.message,
    });
  }
}