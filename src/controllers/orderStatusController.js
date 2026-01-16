import { Order, OrderItem, Cafeteria } from "../models/index.js";
import { Op } from "sequelize";

/**
 * GET ACTIVE ORDER FOR LOGGED-IN USER
 * FIXED: Only returns orders that NEED FEEDBACK
 */
export const getActiveOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const order = await Order.findOne({
      where: {
        studentId: userId,
        [Op.or]: [
          // ✅ ACTIVE ORDERS (no feedback needed yet)
          {
            status: {
              [Op.in]: ["PAID", "PREPARING", "READY"],
            },
            isRated: false,
          },
          // ✅ PICKED_UP but NOT RATED (needs feedback)
          {
            status: "PICKED_UP",
            isRated: false,
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
        isRated: order.isRated, // ✅ KEY: This must be FALSE if feedback is needed
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