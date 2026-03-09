import cron from "node-cron";
import { Order, UserFcmToken, sequelize } from "../models/index.js";
import admin from "../config/firebaseAdmin.js";
import { Op, Transaction } from "sequelize";

let isJobRunning = false;

export const initNotificationScheduler = () => {
  console.log("⏰ Notification Scheduler Initialized (Cron)");

  // Run every 30 seconds (more stable)
  cron.schedule("*/30 * * * * *", async () => {

    if (isJobRunning) {
      console.log("⚠️ Previous cron still running. Skipping...");
      return;
    }

    try {
      isJobRunning = true;

      // ✅ Check DB connection before running job
      await sequelize.authenticate();

      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
      const twentyMinutesAgo = new Date(now - 20 * 60 * 1000);

      // ====================================================
      // 1️⃣ 10 MIN REMINDER
      // ====================================================

      let ordersToRemind = [];

      await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (t) => {
          const reminderOrders = await Order.findAll({
            where: {
              status: "READY",
              updated_at: { [Op.lt]: tenMinutesAgo },
              tenMinReminderSent: false,
            },
            lock: t.LOCK.UPDATE,
            skipLocked: true,
            transaction: t,
          });

          for (const order of reminderOrders) {
            await order.update(
              { tenMinReminderSent: true },
              { silent: true, transaction: t }
            );

            ordersToRemind.push(order);
          }
        }
      );

      for (const order of ordersToRemind) {
        try {
          const userToken = await UserFcmToken.findOne({
            where: { userId: order.studentId },
            order: [["updatedAt", "DESC"]],
          });

          if (userToken) {
            await admin.messaging().send({
              token: userToken.fcmToken,
              notification: {
                title: "⏳ 10 Minutes Left!",
                body: `Hurry! Order #${order.id} is waiting.`,
              },
              data: { orderId: String(order.id) },
            });

            console.log(`🔔 Reminder sent for Order #${order.id}`);
          }
        } catch (err) {
          console.error(`⚠️ Reminder failed for order ${order.id}`, err.message);
        }
      }

      // ====================================================
      // 2️⃣ ORDER EXPIRATION
      // ====================================================

      let ordersToExpire = [];

      await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (t) => {
          const expiredOrders = await Order.findAll({
            where: {
              status: "READY",
              updated_at: { [Op.lt]: twentyMinutesAgo },
              expirationNotificationSent: false,
            },
            lock: t.LOCK.UPDATE,
            skipLocked: true,
            transaction: t,
          });

          for (const order of expiredOrders) {
            await order.update(
              {
                status: "EXPIRED",
                expirationNotificationSent: true,
              },
              { silent: true, transaction: t }
            );

            ordersToExpire.push(order);
          }
        }
      );

      for (const order of ordersToExpire) {
        try {
          const userToken = await UserFcmToken.findOne({
            where: { userId: order.studentId },
            order: [["updatedAt", "DESC"]],
          });

          if (userToken) {
            await admin.messaging().send({
              token: userToken.fcmToken,
              notification: {
                title: "⏳ Pickup Window Closed",
                body: "You didn't pick up the order within 20 mins.",
              },
              data: {
                orderId: String(order.id),
                type: "ORDER_EXPIRED",
              },
            });

            console.log(`☠️ Expiration sent for Order #${order.id}`);
          }
        } catch (err) {
          console.error(`⚠️ Expiration failed for order ${order.id}`, err.message);
        }
      }

    } catch (error) {
      console.error("❌ Notification Cron Error:", error.message);
    } finally {
      isJobRunning = false;
    }
  });
};