import { CafeteriaQr, Order, OrderItem, MenuItem, Cafeteria } from "../models/index.js";
import { Op } from "sequelize";

export const scanStaticCafeteriaQR = async (req, res) => {
  try {
    const { qrToken } = req.body;
    const studentId = req.user.id;

    const cafeteriaQr = await CafeteriaQr.findOne({
      where: { qrToken: qrToken?.trim() },
    });

    if (!cafeteriaQr) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR",
      });
    }

    // 🔥 Find active orders
    const activeOrders = await Order.findAll({
      where: {
        studentId,
        cafeteriaId: cafeteriaQr.cafeteriaId,
        status: { [Op.in]: ["PAID", "PREPARING", "READY"] },
      },
      order: [["createdAt", "DESC"]],
    });

    if (activeOrders.length > 0) {
      const ordersData = activeOrders.map((order) => {
        let msg = "we are cooking";
        if (order.status === "READY") {
          msg = "Ready, pick it up";
        }

        return {
          orderId: order.id,
          status: order.status,
          message: msg,
          canPickUp: order.status === "READY",
        };
      });

      return res.json({
        success: true,
        orders: ordersData,
      });
    }

    // 🔁 Check recently picked order
    const pickedOrder = await Order.findOne({
      where: {
        studentId,
        cafeteriaId: cafeteriaQr.cafeteriaId,
        status: "PICKED_UP",
      },
      order: [["updatedAt", "DESC"]],
    });

    if (pickedOrder) {
      return res.status(404).json({
        success: false,
        message: "you have already picked it",
      });
    }

    return res.status(404).json({
      success: false,
      message: "No active order found",
    });
  } catch (error) {
    console.error("❌ scanStaticCafeteriaQR error:", error);
    res.status(500).json({
      success: false,
      message: "Scan error",
    });
  }
};


export const confirmOrderPickup = async (req, res) => {
  try {
    const { orderId } = req.body;
    const studentId = req.user.id;

    const order = await Order.findOne({
      where: {
        id: orderId,
        studentId,
        status: "READY",
      },
      include: [
        {
          model: OrderItem,
          as: "items", // ✅ MUST MATCH ASSOCIATION
          include: [
            {
              model: MenuItem,
              attributes: ["name", "price"],
            },
          ],
        },
        {
          model: Cafeteria,
          attributes: ["name"],
        },
      ],
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order not ready or not yours",
      });
    }

    // ✅ Update status
    await order.update({ status: "PICKED_UP" });

    // ✅ Build invoice
    const invoice = {
      orderId: order.id,
      cafeteriaName: order.Cafeteria.name,
      totalAmount: order.totalAmount,
      items: order.items.map((i) => ({
        name: i.MenuItem.name,
        quantity: i.quantity,
        price: i.MenuItem.price,
        total: i.quantity * i.MenuItem.price,
      })),
      pickedUpAt: new Date(),
    };

    return res.json({
      success: true,
      message: "🎉 Picked up successfully!",
      invoice,
    });
  } catch (error) {
    console.error("❌ confirmOrderPickup error:", error);
    res.status(500).json({
      success: false,
      message: "Pickup error",
    });
  }
};