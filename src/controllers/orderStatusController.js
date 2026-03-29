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

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // ✅ Query for ALL active or unrated orders (limit Picked up to last 24h)
    const orders = await Order.findAll({
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
          // Picked up but needs feedback (within 24 hours ONLY)
          {
            status: "PICKED_UP",
            isRated: false,
            createdAt: {
              [Op.gte]: twentyFourHoursAgo,
            },
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