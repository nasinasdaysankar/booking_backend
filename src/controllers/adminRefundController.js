import axios from "axios";
import { Order } from "../models/index.js";

export const refundOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "PAID") {
      return res
        .status(400)
        .json({ message: "Only PAID orders can be refunded" });
    }

    if (!order.paymentId) {
      return res
        .status(400)
        .json({ message: "Payment ID missing for refund" });
    }

    // 🔁 Call Cashfree refund API
    await axios.post(
      "https://api.cashfree.com/pg/refund",
      {
        payment_id: order.paymentId,
        refund_amount: order.totalAmount,
        refund_note: "Order declined by cafeteria",
      },
      {
        headers: {
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    // Update order status
    await order.update({ status: "REFUND_INITIATED" });

    res.json({
      success: true,
      message: "Refund initiated successfully",
    });
  } catch (error) {
    console.error("❌ Refund error:", error);
    res.status(500).json({
      success: false,
      message: "Refund initiation failed",
    });
  }
};
