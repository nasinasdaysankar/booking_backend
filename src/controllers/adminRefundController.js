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


import { Payment, Order } from "../models/index.js";
import axios from "axios";

// ✅ REFUND ORDER
export const refundOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const authenticatedAdminId = req.user?.id;

    console.log(`🔄 Refund request for order: ${orderId} by admin: ${authenticatedAdminId}`);

    // 1️⃣ FETCH ORDER
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: "Order not found" 
      });
    }

    console.log(`📦 Order found:`, {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount
    });

    // 2️⃣ CHECK IF ORDER CAN BE REFUNDED
    if (order.status !== "PAID") {
      return res.status(400).json({ 
        success: false,
        message: `Cannot refund order. Current status is "${order.status}". Only PAID orders can be refunded.`
      });
    }

    // 3️⃣ FETCH PAYMENT RECORD (contains paymentId from webhook)
    const payment = await Payment.findOne({
      where: { orderId: order.id }
    });

    if (!payment) {
      return res.status(404).json({ 
        success: false,
        message: "Payment record not found for this order"
      });
    }

    // 4️⃣ CHECK IF paymentId EXISTS (webhook must have arrived)
    if (!payment.paymentId) {
      return res.status(400).json({ 
        success: false,
        message: "Payment ID not available. Webhook may not have been received yet. Please try again in a moment.",
        hint: "This typically takes 1-2 seconds. The cashfreeOrderId is available but paymentId from webhook is required for refunds."
      });
    }

    console.log(`💳 Payment found:`, {
      id: payment.id,
      paymentId: payment.paymentId,
      cashfreeOrderId: payment.cashfreeOrderId,
      status: payment.status
    });

    // 5️⃣ CALL CASHFREE REFUND API
    console.log(`🔄 Initiating Cashfree refund...`);
    console.log(`   paymentId: ${payment.paymentId}`);
    console.log(`   amount: ₹${order.totalAmount}`);

    const refundResponse = await axios.post(
      "https://api.cashfree.com/pg/refunds",
      {
        payment_id: payment.paymentId,
        refund_amount: order.totalAmount,
        refund_note: `Order #${order.id} declined by cafeteria ${order.cafeteriaId}`
      },
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Cashfree refund initiated:", refundResponse.data);

    // 6️⃣ EXTRACT REFUND ID FROM RESPONSE
    const refundId = refundResponse.data?.refund?.refund_id;
    const refundStatus = refundResponse.data?.refund?.refund_status;

    if (!refundId) {
      return res.status(500).json({
        success: false,
        message: "Failed to get refund ID from Cashfree",
        details: refundResponse.data
      });
    }

    console.log(`✅ Refund ID received: ${refundId}`);

    // 7️⃣ UPDATE PAYMENT TABLE
    await Payment.update(
      { 
        status: "REFUND_INITIATED",
        refundId: refundId,
        refundedAt: new Date(),
        refundAmount: order.totalAmount
      },
      { where: { id: payment.id } }
    );

    console.log(`✅ Payment updated with refund info`);

    // 8️⃣ UPDATE ORDER STATUS
    await order.update({ 
      status: "REFUND_INITIATED",
      refundReason: `Order declined by cafeteria. Refund ID: ${refundId}`,
      updatedAt: new Date()
    });

    console.log(`✅ Order status updated to REFUND_INITIATED`);

    // 9️⃣ SEND SUCCESS RESPONSE
    return res.json({
      success: true,
      message: "Refund initiated successfully",
      data: {
        refundId: refundId,
        refundStatus: refundStatus,
        orderId: order.id,
        billId: order.billId,
        amount: order.totalAmount,
        paymentId: payment.paymentId,
        initiatedBy: authenticatedAdminId,
        initiatedAt: new Date()
      }
    });

  } catch (error) {
    console.error("❌ Refund error:", error.response?.data || error.message);
    
    const errorMessage = error.response?.data?.message || error.message;
    const errorCode = error.response?.data?.code;

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Refund initiation failed",
      error: errorMessage,
      code: errorCode
    });
  }
};

// ✅ CHECK REFUND STATUS
export const checkRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔍 Checking refund status for order: ${orderId}`);

    // 1️⃣ FETCH PAYMENT WITH REFUND INFO
    const payment = await Payment.findOne({
      where: { orderId: orderId },
      include: [{
        model: Order,
        where: { id: orderId }
      }]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found for this order"
      });
    }

    // 2️⃣ CHECK IF REFUND EXISTS
    if (!payment.refundId) {
      return res.status(400).json({
        success: false,
        message: "No refund initiated for this order"
      });
    }

    console.log(`🔍 Refund ID found: ${payment.refundId}`);

    // 3️⃣ CALL CASHFREE TO GET CURRENT REFUND STATUS
    const refundResponse = await axios.get(
      `https://api.cashfree.com/pg/refunds/${payment.refundId}`,
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    const refundStatus = refundResponse.data?.refund?.refund_status;
    const refundAmount = refundResponse.data?.refund?.refund_amount;

    console.log(`📊 Current refund status from Cashfree: ${refundStatus}`);

    // 4️⃣ UPDATE LOCAL DATABASE BASED ON CASHFREE STATUS
    if (refundStatus === "SUCCESS") {
      await Payment.update(
        { status: "REFUND_SUCCESS" },
        { where: { id: payment.id } }
      );

      await Order.update(
        { status: "REFUND_SUCCESS" },
        { where: { id: orderId } }
      );

      console.log(`✅ Refund marked as SUCCESS in local DB`);
    } 
    else if (refundStatus === "FAILED") {
      await Payment.update(
        { status: "REFUND_FAILED" },
        { where: { id: payment.id } }
      );

      await Order.update(
        { status: "REFUND_FAILED" },
        { where: { id: orderId } }
      );

      console.log(`❌ Refund marked as FAILED in local DB`);
    }

    // 5️⃣ SEND RESPONSE
    return res.json({
      success: true,
      message: "Refund status retrieved",
      data: {
        orderId: orderId,
        refundId: payment.refundId,
        refundStatus: refundStatus,
        refundAmount: refundAmount,
        refundedAt: payment.refundedAt,
        orderStatus: payment.Order?.status
      }
    });

  } catch (error) {
    console.error("❌ Check refund status error:", error.response?.data || error.message);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to check refund status",
      error: error.response?.data?.message || error.message
    });
  }
};

// ✅ GET REFUND HISTORY
export const getRefundHistory = async (req, res) => {
  try {
    const { cafeteriaId, status } = req.query;

    let whereClause = {};

    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = ["REFUND_INITIATED", "REFUND_SUCCESS", "REFUND_FAILED"];
    }

    if (cafeteriaId) {
      whereClause.cafeteriaId = cafeteriaId;
    }

    const refunds = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Order,
          attributes: ['id', 'billId', 'totalAmount', 'status', 'createdAt']
        }
      ],
      order: [["refundedAt", "DESC"]],
      limit: 50
    });

    return res.json({
      success: true,
      count: refunds.length,
      data: refunds
    });

  } catch (error) {
    console.error("❌ Get refund history error:", error);
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch refund history",
      error: error.message
    });
  }
};