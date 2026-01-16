import {
  CafeteriaQr,
  Order,
  OrderItem,
  MenuItem,
  Cafeteria,
  OrderFeedback,
} from "../models/index.js";
import { Op } from "sequelize";


export const scanStaticCafeteriaQR = async (req, res) => {
  try {
    const { qrToken, orderId } = req.body;
    const studentId = req.user.id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const cafeteriaQr = await CafeteriaQr.findOne({
      where: { qrToken: qrToken?.trim() },
    });

    if (!cafeteriaQr) {
      return res.status(400).json({
        success: false,
        message: "Invalid cafeteria QR",
      });
    }

    const order = await Order.findOne({
      where: {
        id: orderId,
        studentId,
        cafeteriaId: cafeteriaQr.cafeteriaId,
      },
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menuItem",
              attributes: ["name", "price", "imageUrl"], // ✅ FIX
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or does not belong to you",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Order was cancelled",
      });
    }

    return res.json({
      success: true,
      orders: [
        {
          orderId: order.id,
          billId: order.billId,
          status: order.status,
          kotNumber: order.kotNumber,
          totalAmount: order.totalAmount,
          items: order.items.map((i) => ({
            name: i.menuItem?.name ?? "",
            quantity: i.quantity,
            priceAtOrder: i.menuItem?.price ?? 0,
            imageUrl: i.menuItem?.imageUrl ?? "", // ✅ FIX
          })),
        },
      ],
    });
  } catch (error) {
    console.error("❌ scanStaticCafeteriaQR error:", error);
    res.status(500).json({
      success: false,
      message: "Scan error",
    });
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
      showFeedback: true,   // ✅ ADD THIS
  orderId: order.id,
    });
  } catch (error) {
    console.error("❌ confirmOrderPickup error:", error);
    res.status(500).json({
      success: false,
      message: "Pickup error",
    });
  }
};

 
export const submitOrderFeedback = async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;
    const studentId = req.user.id;

    // ✅ 1. Fetch order (must be PICKED_UP and NOT rated)
    const order = await Order.findOne({
      where: {
        id: orderId,
        studentId,
        status: "PICKED_UP",
      },
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order not found or not picked up",
      });
    }

    // ✅ 2. HARD BLOCK — Already rated?
    if (order.isRated === true) {
      return res.status(409).json({
        success: false,
        message: "Feedback already submitted",
      });
    }

    // ✅ 3. Check for duplicate feedback in DB
    const existingFeedback = await OrderFeedback.findOne({
      where: {
        orderId,
        studentId,
      },
    });

    if (existingFeedback) {
      // Safety: Mark as rated if feedback exists but flag wasn't set
      await order.update({ isRated: true });

      return res.status(409).json({
        success: false,
        message: "Feedback already submitted",
      });
    }

    // ✅ 4. Create feedback record
    await OrderFeedback.create({
      orderId,
      studentId,
      cafeteriaId: order.cafeteriaId,
      rating,
      comment,
    });

    // ✅ 5. CRITICAL: Update isRated = true BEFORE responding
    await order.update({ isRated: true });

    return res.json({
      success: true,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    console.error("❌ submitOrderFeedback error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Feedback failed",
    });
  }
};