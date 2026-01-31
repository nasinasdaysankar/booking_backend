
import cron from "node-cron";
import { Order, UserFcmToken, sequelize } from "../models/index.js";
import admin from "../config/firebaseAdmin.js";
import { Op } from "sequelize";

export const initNotificationScheduler = () => {
    console.log("⏰ Notification Scheduler Initialized (Cron)");

    // Run every minute
    cron.schedule("* * * * *", async () => {
        try {
            // Find orders that are READY and were updated 10-11 minutes ago
            // (Meaning ~10 minutes have passed since they became ready)
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);

            const staleOrders = await Order.findAll({
                where: {
                    status: "READY",
                    updatedAt: {
                        [Op.lt]: tenMinutesAgo,
                        [Op.gt]: elevenMinutesAgo,
                    },
                },
            });

            if (staleOrders.length === 0) return;

            console.log(`⏰ Found ${staleOrders.length} orders pending pickup > 10 mins`);

            for (const order of staleOrders) {
                const userTokens = await UserFcmToken.findAll({
                    where: { userId: order.studentId },
                });

                if (userTokens.length > 0) {
                    const tokens = userTokens.map((t) => t.fcmToken);

                    await admin.messaging().sendEachForMulticast({
                        tokens,
                        notification: {
                            title: "⏳ 10 Minutes Left!",
                            body: `Hurry! Order #${order.id} is waiting. Please pick it up soon.`,
                        },
                        data: {
                            orderId: String(order.id),
                            status: "READY",
                        },
                        android: { priority: "high" },
                    });

                    console.log(`🔔 Sent reminder for Order #${order.id}`);
                }
            }
        } catch (error) {
            console.error("❌ Notification Cron Error:", error);
        }
    });
};
