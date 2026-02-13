
import cron from "node-cron";
import { Order, UserFcmToken, sequelize } from "../models/index.js";
import admin from "../config/firebaseAdmin.js";
import { Op, Transaction } from "sequelize";

export const initNotificationScheduler = () => {
    console.log("⏰ Notification Scheduler Initialized (Cron)");

    // Run every 15 seconds for faster notification delivery
    // Format: second minute hour day month weekday
    cron.schedule("*/15 * * * * *", async () => {
        try {
            const now = Date.now();
            const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
            const twentyMinutesAgo = new Date(now - 20 * 60 * 1000);

            // ====================================================
            // 1. REMINDER (10 MINS LEFT) - OPTIMIZED
            // ====================================================
            let ordersToRemind = [];

            await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
                const reminderOrders = await Order.findAll({
                    where: {
                        status: "READY",
                        updatedAt: { [Op.lt]: tenMinutesAgo },
                        tenMinReminderSent: false,
                    },
                    lock: t.LOCK.UPDATE,
                    skipLocked: true,
                    transaction: t,
                });

                if (reminderOrders.length > 0) {
                    console.log(`⏰ Found ${reminderOrders.length} orders for 10-min reminder`);
                    for (const order of reminderOrders) {
                        await order.update({ tenMinReminderSent: true }, { silent: true, transaction: t });
                        ordersToRemind.push(order);
                    }
                }
            });

            // Process outside transaction
            for (const order of ordersToRemind) {
                try {
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
                        console.log(`🔔 Sent 10-min reminder for Order #${order.id}`);
                    }
                } catch (err) {
                    console.error(`⚠️ Failed to send reminder for #${order.id}:`, err.message);
                }
            }

            // ====================================================
            // 2. EXPIRATION (20 MINS ELAPSED) - OPTIMIZED
            // ====================================================
            let ordersToExpire = [];

            await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
                const expiredOrders = await Order.findAll({
                    where: {
                        status: "READY",
                        updatedAt: { [Op.lt]: twentyMinutesAgo },
                        expirationNotificationSent: false,
                    },
                    lock: t.LOCK.UPDATE,
                    skipLocked: true,
                    transaction: t,
                });

                if (expiredOrders.length > 0) {
                    console.log(`☠️ Found ${expiredOrders.length} expired orders (>20 mins)`);
                    for (const order of expiredOrders) {
                        await order.update({ expirationNotificationSent: true }, { silent: true, transaction: t });
                        ordersToExpire.push(order);
                    }
                }
            });

            // Process outside transaction
            for (const order of ordersToExpire) {
                try {
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
                                body: "You didn't pick up the order within 20 mins.",
                            },
                            data: {
                                orderId: String(order.id),
                                status: "READY",
                                type: "ORDER_EXPIRED"
                            },
                            android: { priority: "high" },
                        });
                        console.log(`🔔 Sent expiration alert for Order #${order.id}`);
                    }
                    console.log(`⚠️ Order #${order.id} expired notification processed`);
                } catch (err) {
                    console.error(`⚠️ Failed to send expiration for #${order.id}:`, err.message);
                }
            }

        } catch (error) {
            console.error("❌ Notification Cron Error:", error);
        }
    });
};
