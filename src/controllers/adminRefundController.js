import { Payment, Order, sequelize } from "../models/index.js"; // ✅ Import sequelize from models

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
        status: refund.refund_status,
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
    // ✅ FETCH EXISTING REFUND STATUS
    // ====================================
    const axios = (await import("axios")).default;

    const refundResponse = await axios.get(
      `https://sandbox.cashfree.com/pg/orders/${payment.cashfreeOrderId}/refunds/${payment.refundId}`,
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_SANDBOX_CLIENT_ID,
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
        { status: "REFUND_SUCCESS" },
        { where: { id: orderId } }
      );

      console.log(`✅ [REFUND SUCCESS] Updated in DB`);
    } else if (refundStatus === "FAILED") {
      await Payment.update(
        { status: refundStatus },
        { where: { id: payment.id } }
      );

      await Order.update(
        { status: "REFUND_FAILED" },
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
// ✅ GET REFUND HISTORY (FIXED)
// ===================================================================
export const getRefundHistory = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;

    console.log(`📋 [REFUND HISTORY] Fetching for cafeteria: ${cafeteriaId}`);

    // ✅ Use exact column names from database
    const refunds = await sequelize.query(
      `
      SELECT 
        p.id as "paymentId",
        p."refundId",
        p."refundAmount",
        p.status as "refundStatus",
        p."refundedAt",
        o.id as "orderId",
        o."billId",
        o."totalAmount",
        o.status as "orderStatus",
        o."createdAt"
      FROM payments p
      JOIN orders o 
        ON p."orderId" = o.id
      WHERE 
        o."cafeteriaId" = :cafeteriaId
        AND p."refundId" IS NOT NULL
      ORDER BY p."refundedAt" DESC
      `,
      {
        replacements: { cafeteriaId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`✅ Found ${refunds.length} refunds`);

    return res.json({
      success: true,
      count: refunds.length,
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


// ======================================================
// ✅ USER REFUND HISTORY
// ======================================================
export const getUserRefundHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📋 [USER REFUNDS] Fetching for user: ${userId}`);

    const refunds = await sequelize.query(
      `
      SELECT 
        p."refundId",
        p."refundAmount",
        p.status AS "refundStatus",
        p."refundedAt",
        o.id AS "orderId",
        o."billId",
        o."totalAmount",
        o.status AS "orderStatus",
        o."createdAt"
      FROM payments p
      JOIN orders o ON p."orderId" = o.id
      WHERE 
        o."userId" = :userId
        AND p."refundId" IS NOT NULL
      ORDER BY p."refundedAt" DESC
      `,
      {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`✅ USER refunds found: ${refunds.length}`);

    return res.json({
      success: true,
      count: refunds.length,
      data: refunds,
    });
  } catch (error) {
    console.error("❌ USER REFUND HISTORY ERROR", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch refund history",
      error: error.message,
    });
  }
};
