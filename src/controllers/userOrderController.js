import {
  Order,
  OrderItem,
  MenuItem,
  Cafeteria,
  OrderFeedback,
} from "../models/index.js";
import { Op } from "sequelize";
import { emitAdminOrderUpdate } from "../socket.js";





// ================= CONFIRM PICKUP + INVOICE =================


// ================= SUBMIT FEEDBACK =================
export const submitOrderFeedback = async (req, res) => {
  try {
    const { orderId, rating, comment, deliveryRating, deliveryComment } = req.body;
    const studentId = req.user.id;

    console.log("📝 FEEDBACK REQUEST RECEIVED:");
    console.log("  Order ID:", orderId);
    console.log("  Rating:", rating);
    console.log("  Student ID:", studentId);
    console.log("  Comment:", comment);

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
        "deliveryPartnerId",
      ],
    });

    if (!order) {
      console.log("❌ Order not found:", orderId);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log(
      "✅ Order found - Status:",
      order.status,
      "isRated:",
      order.isRated
    );

    // ✅ 2. VERIFY OWNERSHIP
    if (order.studentId !== studentId) {
      console.log(
        "❌ Order ownership mismatch - Order belongs to:",
        order.studentId,
        "Requesting user:",
        studentId
      );
      return res.status(403).json({
        success: false,
        message: "Order does not belong to you",
      });
    }

    // ✅ 3. VERIFY STATUS (must be PICKED_UP, DELIVERED, COMPLETED, or SERVED)
    if (!["PICKED_UP", "DELIVERED", "COMPLETED", "SERVED"].includes(order.status)) {
      console.log(
        "❌ Order status not allowed for feedback, actual status:",
        order.status
      );
      return res.status(400).json({
        success: false,
        message: `Cannot submit feedback for order with status: ${order.status}`,
      });
    }

    // ✅ 4. CHECK IF ALREADY RATED
    if (order.isRated === true) {
      console.log("⚠️  Order already rated");
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
      console.log("⚠️  Feedback already exists for this order");
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
      deliveryRating: deliveryRating || null,
      deliveryComment: deliveryComment || "",
      deliveryPartnerId: order.deliveryPartnerId || null,
    });

    if (!feedback) {
      throw new Error("Failed to create feedback record");
    }

    console.log("✅ Feedback created with ID:", feedback.id);

    // ✅ 7. UPDATE isRated FLAG (THIS IS CRITICAL)
    console.log("🔄 Updating isRated to true for order:", orderId);

    const updateResult = await Order.update(
      { isRated: true },
      {
        where: {
          id: orderId,
          studentId,
        },
      }
    );

    console.log("📊 Update result (affected rows):", updateResult);

    // ✅ 8. VERIFY THE UPDATE
    const updatedOrder = await Order.findByPk(orderId, {
      attributes: ["id", "status", "isRated"],
    });

    console.log(
      "✅ Verified after update - ID:",
      updatedOrder.id,
      "isRated:",
      updatedOrder.isRated
    );

    if (updatedOrder.isRated !== true) {
      console.error(
        "❌ CRITICAL: isRated was NOT updated after first attempt!"
      );
      console.error("Database value is still:", updatedOrder.isRated);

      // ⚠️ RETRY with direct instance update
      console.log("🔄 Retrying with direct instance update...");
      await order.reload(); // Reload from DB
      await order.update({ isRated: true });

      const recheck = await Order.findByPk(orderId);
      console.log("🔁 After retry - isRated:", recheck.isRated);
    }

    // ✅ 9. RESPOND WITH SUCCESS
    return res.status(200).json({
      success: true,
      message: "Thank you for your feedback! 🎉",
      data: {
        feedbackId: feedback.id,
        orderId: orderId,
        isRated: true,
        status: "PICKED_UP",
      },
    });
  } catch (error) {
    console.error("❌ submitOrderFeedback ERROR:", error.message);
    console.error("Full error:", error);
    console.error("Stack trace:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Failed to submit feedback",
      error: error.message,
    });
  }
};

// ================= CHECK FEEDBACK STATUS =================
export const checkFeedbackStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const studentId = req.user.id;

    console.log("🔍 Checking feedback status for order:", orderId);

    const order = await Order.findOne({
      where: {
        id: orderId,
        studentId,
      },
      attributes: ["id", "status", "isRated"],
    });

    if (!order) {
      console.log("❌ Order not found:", orderId);
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

    console.log("✅ Feedback status - isRated:", order.isRated, "hasRecord:", !!feedback);

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