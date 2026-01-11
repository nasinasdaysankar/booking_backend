// userOrderController.js

import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";

/**
 * 🔥 SCAN QR CODE - Get complete order with items, prices, and images
 */
export const scanStaticCafeteriaQR = async (req, res) => {
  try {
    const { qrToken } = req.body;
    const userId = req.userId;

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: "QR token is required",
      });
    }

    // Find order with complete item details
    const order = await Order.findOne({
      where: { qrToken, userId },
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

    res.json({
      success: true,
      orders: [formattedOrder],
      message: "Order retrieved successfully",
    });
  } catch (error) {
    console.error("❌ SCAN QR ERROR:", error);
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
    const userId = req.userId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Find order with items
    const order = await Order.findOne({
      where: { id: orderId, userId },
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
    const userId = req.userId;

    const orders = await Order.findAll({
      where: {
        userId,
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