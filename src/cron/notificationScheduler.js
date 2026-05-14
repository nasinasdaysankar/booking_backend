
import cron from "node-cron";
import { Order, UserFcmToken, Cafeteria, sequelize } from "../models/index.js";
import admin from "../config/firebaseAdmin.js";
import { Op, Transaction } from "sequelize";
import { updateOrderStatusInSheet } from "../utils/googleSheets.js";

export const initNotificationScheduler = () => {
    console.log("⏰ Notification Scheduler Initialized (Cron)");

    // Run every 15 seconds for faster notification delivery
    // Format: second minute hour day month weekday
    cron.schedule("*/15 * * * * *", async () => {
        try {
            const now = Date.now();

            let ordersToRemind = [];
            let ordersToExpire = [];

            // ─── Step 1: Pre-fetch all cafeteria buffer times (no lock needed) ───
            const allCafeterias = await Cafeteria.findAll({ attributes: ["id", "bufferTime"] });
            const bufferMap = {};
            for (const c of allCafeterias) {
                bufferMap[c.id] = c.bufferTime || 20;
            }

            // ─── Step 2: Lock READY orders WITHOUT a join (PG forbids FOR UPDATE on outer joins) ───
            await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
                const readyOrders = await Order.findAll({
                    where: {
                        status: "READY",
                        orderType: "DINE_IN", // 🚀 DELIVERY orders don't expire/remind like Dine-in
                        [Op.or]: [
                            { tenMinReminderSent: false },
                            { expirationNotificationSent: false }
                        ]
                    },
                    lock: t.LOCK.UPDATE,
                    skipLocked: true,
                    transaction: t,
                });

                for (const order of readyOrders) {
                    const bufferTime = bufferMap[order.cafeteriaId] ?? 20;
                    const bufferMs = bufferTime * 60 * 1000;
                    const halfBufferMs = bufferMs / 2;
                    const elapsedMs = now - new Date(order.updatedAt).getTime();

                    // Attach bufferTime so notification senders can use it
                    order._bufferTime = bufferTime;

                    if (!order.expirationNotificationSent && elapsedMs >= bufferMs) {
                        console.log(`☠️ Order #${order.id} expired (> ${bufferTime} mins)`);
                        await order.update({ status: "EXPIRED", expirationNotificationSent: true }, { silent: true, transaction: t });
                        updateOrderStatusInSheet(order.id, "EXPIRED").catch(err =>
                            console.error("⚠️ Sheets expiration update error:", err.message)
                        );
                        ordersToExpire.push(order);
                    } else if (!order.tenMinReminderSent && elapsedMs >= halfBufferMs) {
                        console.log(`⏰ Order #${order.id} ready for halfway reminder`);
                        await order.update({ tenMinReminderSent: true }, { silent: true, transaction: t });
                        ordersToRemind.push(order);
                    }
                }
            });

            // Process Reminders outside transaction
            for (const order of ordersToRemind) {
                try {
                    const userTokens = await UserFcmToken.findAll({
                        where: { userId: order.studentId },
                        order: [['updatedAt', 'DESC']],
                        limit: 1
                    });

                    if (userTokens.length > 0) {
                        const token = userTokens[0].fcmToken;
                        const bufferTime = order._bufferTime ?? 20;
                        const bufferMs = bufferTime * 60 * 1000;
                        const expiryTimestamp = new Date(order.updatedAt).getTime() + bufferMs;
                        const expiryTimeISO = new Date(expiryTimestamp).toISOString();

                        const halfBufferMs = Math.round(bufferTime / 2);
                        const reminderBody = `Hurry! You have only ${halfBufferMs} mins left to pick up Order #${order.dailyOrderNumber ?? order.id}, or it will be cancelled without a refund.`;
                        await admin.messaging().send({
                            token,
                            // 🚨 REMOVED top-level 'notification' for the permanent solution.
                            // The app will manually show a BigText alert from the data payload.
                            data: {
                                title: `⏳ ${halfBufferMs} Minutes Left!`,
                                body: `Hurry! You have only ${halfBufferMs} mins left to pick up Order #${order.dailyOrderNumber ?? order.id}, or it will be cancelled without a refund.`,
                                orderId: String(order.id),
                                status: "READY",
                                type: "ORDER_STATUS_UPDATE",
                                expiryTimestamp: String(expiryTimestamp),
                                expiryTimeISO: expiryTimeISO,
                            },
                            android: {
                                priority: "high",
                            },
                        });
                        console.log(`🔔 Sent ${halfBufferMs}-min reminder for Order #${order.id}`);
                    }
                } catch (err) {
                    console.error(`⚠️ Failed to send reminder for #${order.id}:`, err.message);
                }
            }

            // Process Expirations outside transaction
            for (const order of ordersToExpire) {
                try {
                    const userTokens = await UserFcmToken.findAll({
                        where: { userId: order.studentId },
                        order: [['updatedAt', 'DESC']],
                        limit: 1
                    });

                    if (userTokens.length > 0) {
                        const token = userTokens[0].fcmToken;
                        const bufferTime = order._bufferTime ?? 20;
                        const expiredBody = `You didn't pick up the order within ${bufferTime} mins. As per policy, no refund is provided.`;
                        await admin.messaging().send({
                            token,
                            notification: {
                                title: "⏳ Pickup Window Closed",
                                body: expiredBody,
                            },
                            data: {
                                orderId: String(order.id),
                                status: "READY",
                                type: "ORDER_EXPIRED"
                            },
                            android: {
                                priority: "high",
                                notification: {
                                    channelId: "high_importance_channel",
                                    body: expiredBody,
                                },
                            },
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
