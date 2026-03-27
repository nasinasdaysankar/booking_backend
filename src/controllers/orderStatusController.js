import { Order, OrderItem, Cafeteria } from "../models/index.js";
import { Op } from "sequelize";

/**
 * GET ACTIVE ORDER FOR LOGGED-IN USER
 * FIXED: Only returns orders that NEED FEEDBACK
 * ✅ Changed debugPrint to console.log (Node.js only)
 */
export const getActiveOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("🔍 Fetching active orders for user:", userId);

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
          as: "Cafeteria",
          attributes: ["name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!order) {
      console.log("✅ No active orders for user:", userId);
      return res.status(200).json({ data: null });
    }

    console.log(
      "✅ Found active order - ID:",
      order.id,
      "Status:",
      order.status,
      "isRated:",
      order.isRated
    );

    return res.status(200).json({
      data: {
        id: order.id,
        dailyOrderNumber: order.dailyOrderNumber,
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