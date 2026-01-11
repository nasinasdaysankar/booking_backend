import {
  CafeteriaQr,
  Order,
  OrderItem,
  MenuItem,
  Cafeteria,
} from "../models/index.js";
import { Op } from "sequelize";


// ================= SCAN QR =================
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

    const order = await Order.findOne({
      where: {
        studentId,
        cafeteriaId: cafeteriaQr.cafeteriaId,
        status: { [Op.in]: ["PAID", "PREPARING", "READY"] },
      },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: ["name", "imageUrl", "quantity", "priceAtOrder"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "No active order found",
      });
    }

    res.json({
      success: true,
      orders: [
        {
          orderId: order.id,
          status: order.status,
          billId: order.billId,
          kotNumber: order.kotNumber,
          totalAmount: order.totalAmount,
          items: order.items.map(i => ({
            name: i.name,
            imageUrl: i.imageUrl,
            quantity: i.quantity,
            priceAtOrder: i.priceAtOrder
          })),
          canPickUp: order.status === "READY",
          message:
            order.status === "READY"
              ? "Your order is ready!"
              : "Your food is being prepared 🍳",
        },
      ],
    });
  } catch (error) {
    console.error("QR ERROR:", error);
    res.status(500).json({ success:false, message:"Scan failed" });
  }
};

// ================= CONFIRM PICKUP + INVOICE =================
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
          model: Cafeteria,
          attributes: ["name", "location"],
        },
        {
          model: OrderItem,
          as: "items", // ✅ MATCHES MODEL
          include: [
            {
              model: MenuItem,
              as: "menuItem", // ✅ MATCHES MODEL
              attributes: ["name", "price"],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order not ready or not yours",
      });
    }

    await order.update({ status: "PICKED_UP" });

    const invoice = {
      orderId: order.id,
      billId: order.billId,
      cafeteria: order.Cafeteria?.name ?? "",
      location: order.Cafeteria?.location ?? "",
      items: order.items.map((i) => ({
        name: i.menuItem?.name ?? "",
        quantity: i.quantity,
        price: i.menuItem?.price ?? 0,
        total: i.quantity * (i.menuItem?.price ?? 0),
      })),
      totalAmount: order.totalAmount,
      pickedAt: new Date(),
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
