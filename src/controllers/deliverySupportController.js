import { Order, DeliveryPartner, UserFcmToken, Cafeteria } from "../models/index.js";
import { sendPushNotification } from "../utils/notificationUtils.js";
import { emitAdminOrderUpdate } from "../socket.js";
import { Op } from "sequelize";

/**
 * 1. REPORT ISSUE
 * Triggered when partner selects an issue from the menu
 */
export const reportDeliveryIssue = async (req, res) => {
  try {
    const { orderId, issueType, notes } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findOne({
      where: { id: orderId, deliveryPartnerId: partnerId }
    });

    if (!order) return res.status(404).json({ message: "Order not found or not assigned to you" });

    // Update Order
    await order.update({
      supportStatus: issueType,
      supportReportedAt: new Date(),
      supportNotes: notes || ""
    });

    // Handle specific issue logic
    if (issueType === 'UNREACHABLE') {
      const tokens = await UserFcmToken.findAll({ where: { userId: order.studentId } });
      const tokenStrings = tokens.map(t => t.fcmToken);

      if (tokenStrings.length > 0) {
        await sendPushNotification(
          tokenStrings,
          "🚨 Partner Waiting!",
          "Your delivery partner is at your location but cannot reach you. Please contact them immediately.",
          { type: 'PARTNER_WAITING', orderId: orderId.toString() },
          order.studentId,
          false,
          "delivery_updates_channel"
        );
      }
    }

    emitAdminOrderUpdate(order.cafeteriaId, { 
      orderId, 
      status: order.status, 
      supportStatus: issueType 
    });

    res.json({ message: "Issue reported successfully", supportStatus: issueType });
  } catch (err) {
    console.error("REPORT ISSUE ERROR:", err);
    res.status(500).json({ message: "Failed to report issue" });
  }
};

/**
 * 2. MARK UNABLE TO DELIVER
 * Only allowed if UNREACHABLE and 15 minutes have passed since reporting
 */
export const markUnableToDeliver = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findOne({
      where: { id: orderId, deliveryPartnerId: partnerId }
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.supportStatus !== 'UNREACHABLE') {
      return res.status(400).json({ message: "Order must be marked as UNREACHABLE first" });
    }

    const waitTimeMinutes = 15;
    const reportedAt = new Date(order.supportReportedAt);
    const now = new Date();
    const diffMs = now - reportedAt;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < waitTimeMinutes) {
      return res.status(400).json({ 
        message: `Please wait ${waitTimeMinutes - diffMins} more minutes before marking as undeliverable.`,
        remainingMinutes: waitTimeMinutes - diffMins 
      });
    }

    // Finalize as CANCELLED (Undeliverable)
    await order.update({
      status: 'CANCELLED',
      supportNotes: `UNDELIVERABLE: Customer was unreachable after ${diffMins} minutes.`
    });

    // Send Push Notification to User
    try {
      const tokens = await UserFcmToken.findAll({ where: { userId: order.studentId } });
      const tokenStrings = tokens.map(t => t.fcmToken);

      if (tokenStrings.length > 0) {
        await sendPushNotification(
          tokenStrings,
          "❌ Order Cancelled (Undeliverable)",
          `Your order #${order.billId || order.id} has been cancelled because you were unreachable.`,
          { type: 'ORDER_CANCELLED', orderId: orderId.toString() },
          order.studentId,
          false,
          "delivery_updates_channel"
        );
      }
    } catch (pushErr) {
      console.error("❌ [CANCELLED_UNDELIVERABLE_PUSH] ERROR:", pushErr.message);
    }

    emitAdminOrderUpdate(order.cafeteriaId, { orderId, status: 'CANCELLED' });

    res.json({ message: "Order marked as undeliverable. You can return the items if required by the cafeteria." });
  } catch (err) {
    console.error("MARK UNDELIVERABLE ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * 3. RESOLVE ISSUE
 * Clears the flag
 */
export const resolveIssue = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findOne({
      where: { id: orderId, deliveryPartnerId: partnerId }
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    await order.update({
      supportStatus: 'NONE',
      supportReportedAt: null
    });

    res.json({ message: "Issue marked as resolved" });
  } catch (err) {
    console.error("RESOLVE ISSUE ERROR:", err);
    res.status(500).json({ message: "Failed to resolve issue" });
  }
};
