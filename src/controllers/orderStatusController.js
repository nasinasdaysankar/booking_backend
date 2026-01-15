import { Order, OrderItem, Cafeteria } from "../models/index.js";
import { Op } from "sequelize";

/**
 * GET ACTIVE ORDER FOR LOGGED-IN USER
 * URL: GET /api/orders/active
 */
export const getActiveOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // We must include PICKED_UP also so feedback can be triggered
    const order = await Order.findOne({
      where: {
        studentId: userId,
        status: {
          [Op.in]: ["PAID", "PREPARING", "READY", "PICKED_UP"],
        },
      },
      include: [
        {
          model: OrderItem,
          as: "items",
        },
        {
          model: Cafeteria,
          attributes: ["name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Flutter expects null if no active order
    if (!order) {
      return res.status(200).json({ data: null });
    }

    // Send only what frontend needs
    return res.status(200).json({
      data: {
        id: order.id,
        billId: order.billId,
        status: order.status,
        totalAmount: order.totalAmount,
        isRated: order.isRated, // ⭐ THIS IS CRITICAL
        cafeteriaId: order.cafeteriaId,
        cafeteriaName: order.Cafeteria?.name ?? "",
        items: order.items,
      },
    });
  } catch (err) {
    console.error("❌ ACTIVE ORDER ERROR:", err);
    return res.status(500).json({
      message: "Error fetching order",
    });
  }
};
