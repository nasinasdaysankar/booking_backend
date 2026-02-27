// ===================================================================
// FILE: controllers/upiController.js
// Auto Collect + UPI Intent Payment Controller
// ===================================================================

import { UpiPayment, Order, OrderItem, sequelize, AdminFcmToken } from "../models/index.js";
import { emitNewOrder } from "../socket.js";
import admin from "../config/firebaseAdmin.js";
import crypto from "crypto";
import dayjs from "dayjs";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

// Generate cafeteria prefix for Bill ID
const getCafeteriaPrefix = (cafeteriaId) => {
    if (!cafeteriaId) return "GEN";
    switch (Number(cafeteriaId)) {
        case 1: return "AA"; // Anathahara
        case 2: return "AR"; // Aromos
        case 3: return "DP"; // Dhanapani
        case 4: return "FC"; // Foodclub
        default: return "GEN";
    }
};

// Generate random alphanumeric string
const generateRandomString = (length) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Generate KOT number for cafeteria
const generateKotNumber = async (cafeteriaId, transaction) => {
    const [result] = await sequelize.query(
        `
    INSERT INTO kot_counters ("cafeteriaid", "counter")
    VALUES (:cafeteriaId, 1)
    ON CONFLICT ("cafeteriaid")
    DO UPDATE SET "counter" = kot_counters."counter" + 1
    RETURNING "counter";
    `,
        {
            replacements: { cafeteriaId },
            transaction,
        }
    );

    const counter = result[0].counter;
    return `KOT-${cafeteriaId}-${String(counter).padStart(5, "0")}`;
};

// ===================================================================
// 1️⃣ CREATE UPI PAYMENT
// Called by Flutter app when user taps "Pay"
// Returns VPA details for UPI Intent
// ===================================================================
export const createUpiPayment = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const {
            cafeteriaId,
            amount,
            items,
            isParcel,
            parcelAmount,
            platformFee,
            gstAmount,
        } = req.body;

        const studentId = req.user.id;
        const studentName = req.user.name || "Customer";

        console.log("🔵 [UPI] Create payment request:", {
            cafeteriaId,
            amount,
            studentId,
            itemCount: items?.length,
        });

        // Validate required fields
        if (!cafeteriaId || !amount || !items || items.length === 0) {
            await t.rollback();
            return res.status(400).json({
                success: false,
                message: "Missing required fields: cafeteriaId, amount, items",
            });
        }

        // 1️⃣ Generate unique Bill ID
        const prefix = getCafeteriaPrefix(cafeteriaId);
        const randomStr = generateRandomString(8);
        const timestamp = Date.now().toString().slice(-4);
        const billId = `${prefix}-${randomStr}${timestamp}`;

        // 2️⃣ Generate unique transaction reference (for UPI)
        const transactionRef = `VEL${Date.now()}${generateRandomString(4)}`;

        // 3️⃣ Generate VPA (Virtual Payment Address)
        // Format: velish_<transactionRef>@cashfree
        // Get VPA from environment variable (configured in .env)
        const vpa = process.env.CASHFREE_VPA || `velish.canteen@okaxis`;

        if (!process.env.CASHFREE_VPA) {
            console.warn("⚠️ [UPI] Using placeholder VPA. Set CASHFREE_VPA in .env for production.");
        }

        // 4️⃣ Create Order record
        const order = await Order.create(
            {
                cashfreeOrderId: transactionRef, // Using transactionRef as unique order ID
                billId,
                studentId,
                cafeteriaId,
                totalAmount: amount,
                status: "PENDING_PAYMENT",
                paymentStatus: "PENDING",
                isParcel: Boolean(isParcel),
                parcelAmount: Number(parcelAmount) || 0,
                platformFee: Number(platformFee) || 0,
                gstAmount: Number(gstAmount) || 0,
            },
            { transaction: t }
        );

        console.log("✅ [UPI] Order created:", order.id);

        // 5️⃣ Create UpiPayment record
        const upiPayment = await UpiPayment.create(
            {
                orderId: order.id,
                vpa,
                payeeName: "Velish Canteen",
                amount,
                transactionRef,
                status: "PENDING",
                expiresAt: dayjs().add(15, "minutes").toDate(), // 15 min expiry
            },
            { transaction: t }
        );

        console.log("✅ [UPI] UpiPayment created:", upiPayment.id);

        // 6️⃣ Create OrderItems
        const itemsToCreate = items.map((item) => ({
            orderId: order.id,
            menuItemId: item.menuItemId || item.id || null,
            name: item.name,
            quantity: item.quantity || item.qty,
            priceAtOrder: item.price,
            imageUrl: item.imageUrl || item.img || null,
            isParcel: Boolean(item.isParcelSelected),
        }));

        await OrderItem.bulkCreate(itemsToCreate, { transaction: t });
        console.log(`✅ [UPI] Created ${itemsToCreate.length} order items`);

        await t.commit();

        // 7️⃣ Return payment details for UPI Intent
        return res.json({
            success: true,
            payment: {
                orderId: order.id,
                billId,
                transactionRef,
                vpa,
                payeeName: "Velish Canteen",
                amount: parseFloat(amount).toFixed(2),
                transactionNote: `Order ${billId}`,
                expiresAt: upiPayment.expiresAt,
            },
        });

    } catch (err) {
        if (!t.finished) await t.rollback();
        console.error("❌ [UPI] Create payment error:", err);
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
};

// ===================================================================
// 2️⃣ HANDLE AUTO COLLECT WEBHOOK
// Called by Cashfree when payment is received
// ===================================================================
export const handleAutoCollectWebhook = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        console.log("🔔 [WEBHOOK] Auto Collect webhook received");
        console.log("📦 [WEBHOOK] Body:", JSON.stringify(req.body, null, 2));

        // TODO: Verify webhook signature from Cashfree
        // const signature = req.headers["x-webhook-signature"];
        // Implement signature verification for production

        const {
            event,
            utr,
            amount,
            vpa,
            remitterVpa,
            remitterName,
            transferMode,
            creditRefNo,
        } = req.body;

        // For testing: Accept custom test format too
        const eventType = event || req.body.type || "PAYMENT_SUCCESS";
        const utrNumber = utr || req.body.utrNumber || creditRefNo;
        const receivedAmount = amount || req.body.amount;
        const receivedVpa = vpa || req.body.vpa;

        console.log("🔍 [WEBHOOK] Parsed:", {
            eventType,
            utrNumber,
            receivedAmount,
            receivedVpa,
        });

        // Find UpiPayment by transactionRef or match by amount + timing
        // For production, you'd match by VPA or creditRefNo
        let upiPayment = await UpiPayment.findOne({
            where: {
                status: "PENDING",
            },
            order: [["createdAt", "DESC"]], // Most recent pending payment
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!upiPayment) {
            console.warn("⚠️ [WEBHOOK] No matching pending payment found");
            await t.rollback();
            return res.status(200).json({
                success: true,
                message: "No pending payment matched",
            });
        }

        // Update UpiPayment
        await upiPayment.update(
            {
                status: "SUCCESS",
                utrNumber,
                senderVpa: remitterVpa,
                senderName: remitterName,
                webhookReceivedAt: new Date(),
                webhookPayload: req.body,
            },
            { transaction: t }
        );

        console.log("✅ [WEBHOOK] UpiPayment updated:", upiPayment.id);

        // Generate KOT number
        const order = await Order.findByPk(upiPayment.orderId, { transaction: t });
        const kotNumber = await generateKotNumber(order.cafeteriaId, t);

        // Update Order status
        await order.update(
            {
                status: "PAID",
                paymentStatus: "SUCCESS",
                kotNumber,
            },
            { transaction: t }
        );

        console.log("✅ [WEBHOOK] Order updated to PAID:", order.id, "KOT:", kotNumber);

        await t.commit();

        // 🔔 Send notifications (async, non-blocking)
        (async () => {
            try {
                // Emit socket event
                emitNewOrder(order.cafeteriaId, {
                    orderId: order.id,
                    id: order.id,
                    billId: order.billId,
                    kotNumber,
                    totalAmount: order.totalAmount,
                    status: order.status,
                    createdAt: order.createdAt,
                });

                // Send FCM to admin
                const adminTokens = await AdminFcmToken.findAll({
                    where: { cafeteriaId: order.cafeteriaId },
                });

                if (adminTokens.length > 0) {
                    await admin.messaging().sendEachForMulticast({
                        tokens: adminTokens.map((t) => t.fcmToken),
                        notification: {
                            title: "🍽 New UPI Order",
                            body: `KOT ${kotNumber} • ₹${order.totalAmount}`,
                        },
                        android: {
                            priority: "high",
                            notification: { channelId: "high_importance_channel" },
                        },
                    });
                    console.log("🔔 [WEBHOOK] FCM sent to admins");
                }
            } catch (notifyErr) {
                console.error("⚠️ [WEBHOOK] Notification error:", notifyErr);
            }
        })();

        return res.status(200).json({
            success: true,
            message: "Payment processed",
            orderId: order.id,
            kotNumber,
        });

    } catch (err) {
        if (!t.finished) await t.rollback();
        console.error("❌ [WEBHOOK] Error:", err);
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
};

// ===================================================================
// 3️⃣ VERIFY PAYMENT STATUS
// Called by Flutter app to poll for payment confirmation
// ===================================================================
export const verifyPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        console.log("🔍 [VERIFY] Checking payment status for order:", orderId);

        const order = await Order.findByPk(orderId, {
            include: [
                {
                    model: UpiPayment,
                    attributes: ["status", "utrNumber", "expiresAt"],
                },
            ],
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        const upiPayment = order.UpiPayment;

        // Check if expired
        if (upiPayment && upiPayment.status === "PENDING" && dayjs().isAfter(upiPayment.expiresAt)) {
            await upiPayment.update({ status: "EXPIRED" });
            return res.json({
                success: true,
                status: "EXPIRED",
                message: "Payment expired. Please try again.",
            });
        }

        // Return current status
        return res.json({
            success: true,
            status: order.paymentStatus,
            orderStatus: order.status,
            kotNumber: order.kotNumber || null,
            billId: order.billId,
            utrNumber: upiPayment?.utrNumber || null,
            isPaymentComplete: order.paymentStatus === "SUCCESS",
        });

    } catch (err) {
        console.error("❌ [VERIFY] Error:", err);
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
};

// ===================================================================
// 4️⃣ MANUAL PAYMENT CONFIRMATION (For Testing)
// Simulates webhook for testing purposes
// ===================================================================
export const simulatePaymentSuccess = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { orderId } = req.body;

        console.log("🧪 [TEST] Simulating payment success for order:", orderId);

        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        // Fetch associated UPI payment separately to avoid join locking issues
        if (order) {
            order.UpiPayment = await UpiPayment.findOne({
                where: { orderId: order.id },
                transaction: t
            });
        }

        if (!order) {
            await t.rollback();
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        if (order.paymentStatus === "SUCCESS") {
            await t.rollback();
            return res.json({
                success: true,
                message: "Already paid",
                kotNumber: order.kotNumber,
            });
        }

        // Generate KOT
        const kotNumber = await generateKotNumber(order.cafeteriaId, t);

        // Update Order
        await order.update(
            {
                status: "PAID",
                paymentStatus: "SUCCESS",
                kotNumber,
            },
            { transaction: t }
        );

        // Update UpiPayment
        if (order.UpiPayment) {
            await order.UpiPayment.update(
                {
                    status: "SUCCESS",
                    utrNumber: `TEST_${Date.now()}`,
                    webhookReceivedAt: new Date(),
                },
                { transaction: t }
            );
        }

        await t.commit();

        console.log("✅ [TEST] Payment simulated successfully. KOT:", kotNumber);

        return res.json({
            success: true,
            message: "Payment simulated successfully",
            kotNumber,
            orderId: order.id,
        });

    } catch (err) {
        if (!t.finished) await t.rollback();
        console.error("❌ [TEST] Error:", err);
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
};
