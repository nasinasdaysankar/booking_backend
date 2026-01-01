// controllers/refundController.js
export const refundOrder = async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findByPk(orderId);

  if (!order || order.status !== "PAID") {
    return res.status(400).json({ message: "Invalid order for refund" });
  }

  // Call Cashfree refund API
  const refundRes = await axios.post(
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

  // Update DB
  await order.update({
    status: "REFUND_INITIATED",
  });

  res.json({
    success: true,
    message: "Refund initiated",
  });
};
