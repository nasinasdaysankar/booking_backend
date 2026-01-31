
import cron from "node-cron";
import { Order, UserFcmToken, sequelize } from "../models/index.js";
import admin from "../config/firebaseAdmin.js";
import { Op } from "sequelize";

export const initNotificationScheduler = () => {
    console.log("⏰ Notification Scheduler Initialized (Cron)");

    // Run every minute
    cron.schedule("* * * * *", async () => {
        try {
            const now = Date.now();
            const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
            const elevenMinutesAgo = new Date(now - 11 * 60 * 1000);
            const twentyMinutesAgo = new Date(now - 20 * 60 * 1000);
            const twentyOneMinutesAgo = new Date(now - 21 * 60 * 1000);

            // ====================================================
            // 1. REMINDER (10 MINS LEFT)
            // ====================================================
            const reminderOrders = await Order.findAll({
                where: {
                    status: "READY",
                    updatedAt: { [Op.lt]: tenMinutesAgo, [Op.gt]: elevenMinutesAgo },
                    // Ensure we haven't sent it already (Sentinel: -1)
                    etaMinutes: { [Op.ne]: -1 },
                },
            });

            if (reminderOrders.length > 0) {
                console.log(`⏰ Found ${reminderOrders.length} orders for 10-min reminder`);
                for (const order of reminderOrders) {
                    try {
                        // 🔥 LIMIT TO 1 LATEST TOKEN to prevent duplicates
                        const userTokens = await UserFcmToken.findAll({
                            where: { userId: order.studentId },
                            order: [['updatedAt', 'DESC']],
                            limit: 1
                        });

                        if (userTokens.length > 0) {
                            const token = userTokens[0].fcmToken;

                            await admin.messaging().send({
                                token,
                                notification: {
                                    title: "⏳ 10 Minutes Left!",
                                    body: `Hurry! Order #${order.id} is waiting. Please pick it up soon.`,
                                },
                                data: { orderId: String(order.id), status: "READY" },
                                android: { priority: "high" },
                            });
                            console.log(`🔔 Sent 10-min reminder for Order #${order.id} to latest device`);
                        }

                        // ✅ MARK AS SENT (Use etaMinutes as sentinel)
                        // 🤫 Use silent: true to avoid resetting updatedAt (preserving expiration timer)
                        await order.update({ etaMinutes: -1 }, { silent: true });

                    } catch (err) {
                        console.error(`⚠️ Failed to send reminder for #${order.id}:`, err.message);
                    }
                }
            }

            // ====================================================
            // 2. EXPIRATION (20 MINS ELAPSED)
            // ====================================================
            const expiredOrders = await Order.findAll({
                where: {
                    status: "READY",
                    updatedAt: { [Op.lt]: twentyMinutesAgo }, // Strictly older than 20 mins
                },
            });

            if (expiredOrders.length > 0) {
                console.log(`☠️ Found ${expiredOrders.length} expired orders (>20 mins)`);

                for (const order of expiredOrders) {
                    // 1. Notify User FIRST
                    // 🔥 LIMIT TO 1 LATEST TOKEN
                    const userTokens = await UserFcmToken.findAll({
                        where: { userId: order.studentId },
                        order: [['updatedAt', 'DESC']],
                        limit: 1
                    });

                    if (userTokens.length > 0) {
                        const token = userTokens[0].fcmToken;

                        await admin.messaging().send({
                            token,
                            notification: {
                                title: "⏳ Pickup Window Closed",
                                body: "You didn't pick up the order within 20 mins. The order is now cancelled and no refund will be issued.",
                            },
                            data: {
                                orderId: String(order.id),
                                status: "CANCELLED",
                                type: "ORDER_EXPIRED"
                            },
                            android: { priority: "high" },
                        });
                        console.log(`🔔 Sent expiration alert for Order #${order.id} to latest device`);
                    }

                    // 2. Update Status to CANCELLED
                    // We set a custom refundReason so we know WHY it was cancelled
                    await order.update({
                        status: "CANCELLED",
                        refundReason: "Pickup window expired (No Refund)"
                    });

                    console.log(`❌ Order #${order.id} marked as CANCELLED (Expired)`);
                }
            }

        } catch (error) {
            console.error("❌ Notification Cron Error:", error);
        }
    });
};
