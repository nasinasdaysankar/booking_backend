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

    // ✅ VALIDATION
    if (!orderId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Order ID and rating are required",
      });
    }

    // ✅ 1. FETCH THE ORDER
    const order = await Order.findByPk(orderId, {
      attributes: [
        "id",
        "studentId",
        "status",
        "isRated",
        "cafeteriaId",
        "totalAmount",
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ✅ 2. VERIFY OWNERSHIP
    if (order.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "Order does not belong to you",
      });
    }

    // ✅ 3. VERIFY STATUS (must be PICKED_UP)
    if (order.status !== "PICKED_UP") {
      return res.status(400).json({
        success: false,
        message: `Cannot submit feedback for order with status: ${order.status}`,
      });
    }

    // ✅ 4. CHECK IF ALREADY RATED
    if (order.isRated === true) {
      return res.status(409).json({
        success: false,
        message: "Feedback already submitted for this order",
      });
    }

    // ✅ 5. CHECK FOR EXISTING FEEDBACK (safety check)
    const existingFeedback = await OrderFeedback.findOne({
      where: {
        orderId,
        studentId,
      },
    });

    if (existingFeedback) {
      // Sync the flag if missing
      await order.update({ isRated: true });
      return res.status(409).json({
        success: false,
        message: "Feedback already submitted for this order",
      });
    }

    // ✅ 6. CREATE FEEDBACK RECORD
    const feedback = await OrderFeedback.create({
      orderId,
      studentId,
      cafeteriaId: order.cafeteriaId,
      rating,
      comment: comment || "",
    });

    if (!feedback) {
      throw new Error("Failed to create feedback record");
    }

    debugPrint("✅ Feedback created:", feedback.id);

    // ✅ 7. UPDATE isRated FLAG (THIS IS CRITICAL)
    const updateResult = await Order.update(
      { isRated: true },
      {
        where: {
          id: orderId,
          studentId,
        },
      }
    );

    debugPrint("✅ Update result:", updateResult);

    // ✅ 8. VERIFY THE UPDATE
    const updatedOrder = await Order.findByPk(orderId, {
      attributes: ["id", "isRated"],
    });

    debugPrint("✅ Verified isRated after update:", updatedOrder.isRated);

    if (updatedOrder.isRated !== true) {
      console.error(
        "❌ CRITICAL: isRated was NOT updated! Checking database..."
      );
      // Retry once
      await order.update({ isRated: true });
    }

    // ✅ 9. RESPOND WITH SUCCESS
    return res.status(200).json({
      success: true,
      message: "Thank you for your feedback! 🎉",
      data: {
        feedbackId: feedback.id,
        orderId: orderId,
        isRated: true,
      },
    });
  } catch (error) {
    console.error("❌ submitOrderFeedback ERROR:", error.message);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to submit feedback",
      error: error.message,
    });
  }
};

export const checkFeedbackStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const studentId = req.user.id;

    const order = await Order.findOne({
      where: {
        id: orderId,
        studentId,
      },
      attributes: ["id", "status", "isRated"],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const feedback = await OrderFeedback.findOne({
      where: {
        orderId,
        studentId,
      },
      attributes: ["id", "rating", "comment"],
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        isRated: order.isRated,
        hasFeedbackRecord: !!feedback,
        feedbackData: feedback || null,
      },
    });
  } catch (error) {
    console.error("❌ checkFeedbackStatus ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking feedback status",
    });
  }
};
