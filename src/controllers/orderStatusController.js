import { Order, OrderItem, Cafeteria } from "../models/index.js";
import { Op } from "sequelize";

/**
 * GET ACTIVE ORDER FOR LOGGED-IN USER
 * FIXED: Only returns orders that NEED FEEDBACK
 */
export const getActiveOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ Query for UNPAID or PENDING orders
    const order = await Order.findOne({
      where: {
        studentId: userId,
        [Op.or]: [
          // Active orders (no feedback needed)
          {
            status: {
              [Op.in]: ["PAID", "PREPARING", "READY"],
            },
            isRated: false,
          },
          // Picked up but needs feedback
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
          attributes: ["quantity"],
        },
        {
          model: Cafeteria,
          attributes: ["name", "location"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!order) {
      debugPrint("✅ No active orders for user:", userId);
      return res.status(200).json({ data: null });
    }

    debugPrint(
      "✅ Found active order:",
      order.id,
      "Status:",
      order.status,
      "isRated:",
      order.isRated
    );

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
    console.error("❌ getActiveOrders ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching orders",
    });
  }
};
