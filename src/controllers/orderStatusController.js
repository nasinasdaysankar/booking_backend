import { Order, OrderItem } from "../models/index.js";
import { Op } from "sequelize";

/**
 * GET ACTIVE ORDER FOR LOGGED-IN USER
 * URL: GET /api/orders/active
 */
export const getActiveOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const order = await Order.findOne({
      where: {
        studentId: userId,
        status: {
          [Op.in]: ["PAID", "PREPARING", "READY"],
        },
      },
      include: [
        {
          model: OrderItem,
          as: "items",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // ✅ VERY IMPORTANT FOR FLUTTER
    if (!order) {
      return res.status(200).json(null);
    }

    return res.status(200).json(order);
  } catch (err) {
    console.error("❌ ACTIVE ORDER ERROR:", err);
    return res.status(500).json({
      message: "Error fetching order",
    });
  }
};
