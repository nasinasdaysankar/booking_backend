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

    console.log("🔍 Fetching ALL active orders for user:", userId);

    // ✅ Only show orders from the start of the current calendar day (12:00 AM)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // ✅ Query for ALL active or unrated orders (limit to last 24h)
    const orders = await Order.findAll({
      where: {
        studentId: userId,
        createdAt: {
          [Op.gte]: startOfToday,
        },
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
      limit: 10,
    });

    if (!orders || orders.length === 0) {
      console.log("✅ No active orders for user:", userId);
      return res.status(200).json({ data: [] });
    }

    console.log(`✅ Found ${orders.length} active orders for user: ${userId}`);

    const formattedOrders = orders.map(order => ({
      id: order.id,
      dailyOrderNumber: order.dailyOrderNumber,
      billId: order.billId,
      status: order.status,
      totalAmount: order.totalAmount,
      isRated: order.isRated,
      cafeteriaId: order.cafeteriaId,
      cafeteriaName: order.Cafeteria?.name ?? "",
      items: order.items,
      createdAt: order.createdAt,
    }));

    return res.status(200).json({
      data: formattedOrders,
    });
  } catch (err) {
    console.error("❌ getActiveOrders ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching orders",
    });
  }
};