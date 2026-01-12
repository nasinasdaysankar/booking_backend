// import { Payment, Order } from "../models/index.js";
// import axios from "axios";

// // ============================================
// // ✅ REFUND ORDER
// // ============================================
// export const refundOrder = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const authenticatedAdminId = req.user?.id; // Admin who initiated refund

//     console.log(`🔄 Refund request for order: ${orderId} by admin: ${authenticatedAdminId}`);

//     // 1️⃣ FETCH ORDER
//     const order = await Order.findByPk(orderId);

//     if (!order) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Order not found" 
//       });
//     }

//     console.log(`📦 Order found:`, {
//       id: order.id,
//       status: order.status,
//       totalAmount: order.totalAmount
//     });

//     // 2️⃣ CHECK IF ORDER CAN BE REFUNDED
//     if (order.status !== "PAID") {
//       return res.status(400).json({ 
//         success: false,
//         message: `Cannot refund order. Current status is "${order.status}". Only PAID orders can be refunded.`
//       });
//     }

//     // 3️⃣ FETCH PAYMENT RECORD (contains paymentId from webhook)
//     const payment = await Payment.findOne({
//       where: { orderId: order.id }
//     });

//     if (!payment) {
//       return res.status(404).json({ 
//         success: false,
//         message: "Payment record not found for this order"
//       });
//     }

//     // 4️⃣ CHECK IF paymentId EXISTS (webhook must have arrived)
//     if (!payment.paymentId) {
//       return res.status(400).json({ 
//         success: false,
//         message: "Payment ID not available. Webhook may not have been received yet. Please try again in a moment.",
//         hint: "This typically takes 1-2 seconds. The cashfreeOrderId is available but paymentId from webhook is required for refunds."
//       });
//     }

//     console.log(`💳 Payment found:`, {
//       id: payment.id,
//       paymentId: payment.paymentId,
//       cashfreeOrderId: payment.cashfreeOrderId,
//       status: payment.status
//     });

//     // 5️⃣ CALL CASHFREE REFUND API
//     console.log(`🔄 Initiating Cashfree refund...`);
//     console.log(`   paymentId: ${payment.paymentId}`);
//     console.log(`   amount: ₹${order.totalAmount}`);

//     const refundResponse = await axios.post(
//       "https://api.cashfree.com/pg/refunds",
//       {
//         payment_id: payment.paymentId, // ✅ REAL paymentId from webhook (pay_xxx)
//         refund_amount: order.totalAmount,
//         refund_note: `Order #${order.id} declined by cafeteria ${order.cafeteriaId}`
//       },
//       {
//         headers: {
//           "x-api-version": "2023-08-01",
//           "x-client-id": process.env.CASHFREE_CLIENT_ID,
//           "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("✅ Cashfree refund initiated:", refundResponse.data);

//     // 6️⃣ EXTRACT REFUND ID FROM RESPONSE
//     const refundId = refundResponse.data?.refund?.refund_id;
//     const refundStatus = refundResponse.data?.refund?.refund_status;

//     if (!refundId) {
//       return res.status(500).json({
//         success: false,
//         message: "Failed to get refund ID from Cashfree",
//         details: refundResponse.data
//       });
//     }

//     console.log(`✅ Refund ID received: ${refundId}`);

//     // 7️⃣ UPDATE PAYMENT TABLE
//     await Payment.update(
//       { 
//         status: "REFUND_INITIATED",
//         refundId: refundId,
//         refundedAt: new Date(),
//         refundAmount: order.totalAmount
//       },
//       { where: { id: payment.id } }
//     );

//     console.log(`✅ Payment updated with refund info`);

//     // 8️⃣ UPDATE ORDER STATUS
//     await order.update({ 
//       status: "REFUND_INITIATED",
//       refundReason: `Order declined by cafeteria. Refund ID: ${refundId}`,
//       updatedAt: new Date()
//     });

//     console.log(`✅ Order status updated to REFUND_INITIATED`);

//     // 9️⃣ SEND SUCCESS RESPONSE
//     return res.json({
//       success: true,
//       message: "Refund initiated successfully",
//       data: {
//         refundId: refundId,
//         refundStatus: refundStatus,
//         orderId: order.id,
//         billId: order.billId,
//         amount: order.totalAmount,
//         paymentId: payment.paymentId,
//         initiatedBy: authenticatedAdminId,
//         initiatedAt: new Date()
//       }
//     });

//   } catch (error) {
//     console.error("❌ Refund error:", error.response?.data || error.message);
    
//     // Handle specific Cashfree errors
//     const errorMessage = error.response?.data?.message || error.message;
//     const errorCode = error.response?.data?.code;

//     return res.status(error.response?.status || 500).json({
//       success: false,
//       message: "Refund initiation failed",
//       error: errorMessage,
//       code: errorCode
//     });
//   }
// };

// // ============================================
// // ✅ CHECK REFUND STATUS
// // ============================================
// export const checkRefundStatus = async (req, res) => {
//   try {
//     const { orderId } = req.params;

//     console.log(`🔍 Checking refund status for order: ${orderId}`);

//     // 1️⃣ FETCH PAYMENT WITH REFUND INFO
//     const payment = await Payment.findOne({
//       where: { orderId: orderId },
//       include: [{
//         model: Order,
//         where: { id: orderId }
//       }]
//     });

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found for this order"
//       });
//     }

//     // 2️⃣ CHECK IF REFUND EXISTS
//     if (!payment.refundId) {
//       return res.status(400).json({
//         success: false,
//         message: "No refund initiated for this order"
//       });
//     }

//     console.log(`🔍 Refund ID found: ${payment.refundId}`);

//     // 3️⃣ CALL CASHFREE TO GET CURRENT REFUND STATUS
//     const refundResponse = await axios.get(
//       `https://api.cashfree.com/pg/refunds/${payment.refundId}`,
//       {
//         headers: {
//           "x-api-version": "2023-08-01",
//           "x-client-id": process.env.CASHFREE_CLIENT_ID,
//           "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const refundStatus = refundResponse.data?.refund?.refund_status;
//     const refundAmount = refundResponse.data?.refund?.refund_amount;

//     console.log(`📊 Current refund status from Cashfree: ${refundStatus}`);

//     // 4️⃣ UPDATE LOCAL DATABASE BASED ON CASHFREE STATUS
//     if (refundStatus === "SUCCESS") {
//       await Payment.update(
//         { status: "REFUND_SUCCESS" },
//         { where: { id: payment.id } }
//       );

//       await Order.update(
//         { status: "REFUND_SUCCESS" },
//         { where: { id: orderId } }
//       );

//       console.log(`✅ Refund marked as SUCCESS in local DB`);
//     } 
//     else if (refundStatus === "FAILED") {
//       await Payment.update(
//         { status: "REFUND_FAILED" },
//         { where: { id: payment.id } }
//       );

//       console.log(`❌ Refund marked as FAILED in local DB`);
//     }

//     // 5️⃣ SEND RESPONSE
//     return res.json({
//       success: true,
//       message: "Refund status retrieved",
//       data: {
//         orderId: orderId,
//         refundId: payment.refundId,
//         refundStatus: refundStatus,
//         refundAmount: refundAmount,
//         refundedAt: payment.refundedAt,
//         orderStatus: payment.Order?.status
//       }
//     });

//   } catch (error) {
//     console.error("❌ Check refund status error:", error.response?.data || error.message);
    
//     return res.status(error.response?.status || 500).json({
//       success: false,
//       message: "Failed to check refund status",
//       error: error.response?.data?.message || error.message
//     });
//   }
// };

// // ============================================
// // ✅ GET REFUND HISTORY (for admin dashboard)
// // ============================================
// export const getRefundHistory = async (req, res) => {
//   try {
//     const { cafeteriaId } = req.query;

//     let whereClause = {
//       status: ["REFUND_INITIATED", "REFUND_SUCCESS", "REFUND_FAILED"]
//     };

//     if (cafeteriaId) {
//       whereClause.cafeteriaId = cafeteriaId;
//     }

//     const refunds = await Payment.findAll({
//       where: whereClause,
//       include: [Order],
//       order: [["refundedAt", "DESC"]],
//       limit: 50
//     });

//     return res.json({
//       success: true,
//       count: refunds.length,
//       data: refunds
//     });

//   } catch (error) {
//     console.error("❌ Get refund history error:", error);
    
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch refund history",
//       error: error.message
//     });
//   }
// };


// ===================================================================
// FILE: controllers/adminRefundController.js
// Complete refund controller for admin dashboard
// ===================================================================

// ===================================================================
// FILE: controllers/adminRefundController.js
// Admin-specific refund management functions
// ===================================================================

import { Payment, Order } from "../models/index.js";

// ===================================================================
// ✅ CHECK WEBHOOK STATUS (BEFORE REFUND)
// ===================================================================
export const checkWebhookStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const cafeteriaId = req.user.cafeteriaId;

    console.log(`🔍 [ADMIN WEBHOOK CHECK] Order: ${orderId}, Cafeteria: ${cafeteriaId}`);

    // Verify order belongs to admin's cafeteria
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.cafeteriaId !== cafeteriaId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this order",
      });
    }

    // Find payment for this order
    const payment = await Payment.findOne({
      where: { orderId },
      attributes: ["paymentId", "cashfreeOrderId", "status", "createdAt"],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found for this order",
      });
    }

    const hasPaymentId = !!payment.paymentId;
    const waitTime =
      (Date.now() - new Date(payment.createdAt).getTime()) / 1000;

    console.log(`📊 [WEBHOOK STATUS]`, {
      hasPaymentId,
      waitedSeconds: waitTime.toFixed(2),
    });

    const message = hasPaymentId
      ? "✅ Webhook received - ready for refund"
      : `⏳ Webhook pending (${waitTime.toFixed(1)}s) - retry in 2-3 seconds`;

    return res.json({
      success: true,
      webhookReceived: hasPaymentId,
      paymentId: payment.paymentId || null,
      cashfreeOrderId: payment.cashfreeOrderId,
      orderStatus: order.status,
      paymentStatus: payment.status,
      waitedSeconds: waitTime.toFixed(2),
      message,
    });
  } catch (error) {
    console.error("❌ [WEBHOOK CHECK ERROR]", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ===================================================================
// ✅ REFUND ORDER (ADMIN VERSION)
// ===================================================================
export const refundOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    const cafeteriaId = req.user.cafeteriaId;

    console.log("=======================================");
    console.log("🔄 [ADMIN REFUND] Order:", orderId);
    console.log("👨‍🍳 Cafeteria:", cafeteriaId);

    // 1️⃣ Load order
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.cafeteriaId !== cafeteriaId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (order.status !== "PAID") {
      return res.status(400).json({ success: false, message: "Order is not PAID" });
    }

    console.log("📦 Order:", {
      id: order.id,
      amount: order.totalAmount,
      billId: order.billId,
    });

    // 2️⃣ Load payment
    const payment = await Payment.findOne({ where: { orderId } });
    if (!payment) {
      return res.status(400).json({ success: false, message: "Payment record missing" });
    }

    console.log("💳 Payment:", {
      paymentId: payment.paymentId,
      cashfreeOrderId: payment.cashfreeOrderId,
      status: payment.status,
    });

    if (!payment.cashfreeOrderId) {
      return res.status(400).json({
        success: false,
        message: "Cashfree order not linked yet (webhook pending)",
      });
    }

    // 3️⃣ PRINT CASHFREE KEYS (debug)
    console.log("🔐 Cashfree Sandbox App ID:", process.env.CASHFREE_SANDBOX_CLIENT_ID);
    console.log(
      "🔐 Cashfree Sandbox Secret:",
      process.env.CASHFREE_SANDBOX_CLIENT_SECRET
        ? process.env.CASHFREE_SANDBOX_CLIENT_SECRET.slice(0, 6) + "******"
        : "MISSING"
    );

    if (!process.env.CASHFREE_SANDBOX_CLIENT_ID || !process.env.CASHFREE_SANDBOX_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Cashfree sandbox credentials not configured in Railway",
      });
    }

    // 4️⃣ Call Cashfree
    const axios = (await import("axios")).default;

    console.log("🚀 Calling Cashfree refund API...");

    const refundResponse = await axios.post(
      `https://sandbox.cashfree.com/pg/orders/${payment.cashfreeOrderId}/refunds`,
      {
        refund_amount: Number(order.totalAmount),
        refund_note: `Order #${order.id} declined by cafeteria ${cafeteriaId}`,
      },
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_SANDBOX_CLIENT_ID,
          // ✅ FIX: Changed from "x-secret-key" to "x-client-secret"
          "x-client-secret": process.env.CASHFREE_SANDBOX_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("💸 Cashfree Raw Response:", refundResponse.data);

const refund = refundResponse.data; 
    if (!refund || !refund.refund_id) {
      return res.status(500).json({
        success: false,
        message: "Cashfree refund failed",
        raw: refundResponse.data,
      });
    }

    // 5️⃣ Save refund in DB
    await Payment.update(
  {
    status: refund.refund_status,   // ← "PENDING"
    refundId: refund.refund_id,
    refundedAt: new Date(),
    refundAmount: refund.refund_amount,
  },
  { where: { id: payment.id } }
);


    await order.update({
      status: "REFUND_INITIATED",
      refundReason: reason || "Declined by cafeteria",
    });

    console.log("✅ Refund saved in DB");

    return res.json({
      success: true,
      message: "Refund initiated",
      data: {
        refundId: refund.refund_id,
        refundStatus: refund.refund_status,
        amount: refund.refund_amount,
        orderId: order.id,
      },
    });
  } catch (error) {
    console.error("❌ [REFUND ERROR]", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Refund failed",
      error: error.response?.data || error.message,
    });
  }
};
// ===================================================================
// ✅ CHECK REFUND STATUS
// ===================================================================
export const checkRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const cafeteriaId = req.user.cafeteriaId;

    console.log(`🔍 [CHECK REFUND] Order: ${orderId}`);

    // Verify order belongs to admin's cafeteria
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.cafeteriaId !== cafeteriaId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this order",
      });
    }

    // Find payment
    const payment = await Payment.findOne({
      where: { orderId },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (!payment.refundId) {
      return res.status(400).json({
        success: false,
        message: "No refund initiated for this order",
      });
    }

    console.log(`🔍 [CHECK REFUND] Refund ID: ${payment.refundId}`);

    // ====================================
    // ✅ FIX: FETCH EXISTING REFUND STATUS
    // ====================================
    const axios = (await import("axios")).default;

    const refundResponse = await axios.get(
      `https://sandbox.cashfree.com/pg/orders/${payment.cashfreeOrderId}/refunds/${payment.refundId}`,
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_SANDBOX_CLIENT_ID,
          // ✅ FIX: Use correct header name
          "x-client-secret": process.env.CASHFREE_SANDBOX_CLIENT_SECRET,
        },
        timeout: 15000,
      }
    );

    const refundStatus = refundResponse.data?.refund_status;
    const refundAmount = refundResponse.data?.refund_amount;

    console.log(`📊 [REFUND STATUS] ${refundStatus}`);

    // ====================================
    // UPDATE LOCAL DB BASED ON STATUS
    // ====================================
    if (refundStatus === "SUCCESS") {
    await Payment.update(
  { status: refundStatus },
  { where: { id: payment.id } }
);

     await Order.update(
  { status: refundStatus === "SUCCESS" ? "REFUND_SUCCESS" : "REFUND_FAILED" },
  { where: { id: orderId } }
);

      console.log(`✅ [REFUND SUCCESS] Updated in DB`);
    } else if (refundStatus === "FAILED") {
     await Payment.update(
  { status: refundStatus },
  { where: { id: payment.id } }
);

     await Order.update(
  { status: refundStatus === "SUCCESS" ? "REFUND_SUCCESS" : "REFUND_FAILED" },
  { where: { id: orderId } }
);

      console.log(`❌ [REFUND FAILED] Updated in DB`);
    }

    return res.json({
      success: true,
      message: "Refund status retrieved",
      data: {
        orderId,
        refundId: payment.refundId,
        refundStatus,
        refundAmount,
        refundedAt: payment.refundedAt,
        orderStatus: order.status,
      },
    });
  } catch (error) {
    console.error("❌ [CHECK REFUND ERROR]", error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to check refund status",
      error: error.message,
    });
  }
};
// ===================================================================
// ✅ GET REFUND HISTORY
// ===================================================================
export const getRefundHistory = async (req, res) => {
  try {
    const { status } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    console.log(`📊 [REFUND HISTORY] Cafeteria: ${cafeteriaId}, Status: ${status || "all"}`);

    let whereClause = { cafeteriaId };

    if (status) {
  whereClause.status = status;
} else {
  whereClause.status = ["PENDING", "SUCCESS", "FAILED"];
}

    const refunds = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Order,
          where: { cafeteriaId },
          attributes: ["id", "billId", "totalAmount", "status", "createdAt"],
        },
      ],
      order: [["refundedAt", "DESC"]],
      limit: 50,
    });

    console.log(`✅ [REFUND HISTORY] Found ${refunds.length} refunds`);

    return res.json({
      success: true,
      count: refunds.length,
      cafeteriaId,
      data: refunds,
    });
  } catch (error) {
    console.error("❌ [REFUND HISTORY ERROR]", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch refund history",
      error: error.message,
    });
  }
};


