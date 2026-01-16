import { Order, OrderItem, Cafeteria } from "../models/index.js";
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
        [Op.or]: [
          // Active flow (no feedback yet)
          {
            status: {
              [Op.in]: ["PAID", "PREPARING", "READY"],
            },
          },
          {
            status: "PICKED_UP",
            isRated: false, // 🔥 CRITICAL FIX
          },
        ],
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

    if (!order) {
      return res.status(200).json({ data: null });
    }

    return res.status(200).json({
      data: {
        id: order.id,
        billId: order.billId,
        status: order.status,
        totalAmount: order.totalAmount,
        isRated: order.isRated,
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
