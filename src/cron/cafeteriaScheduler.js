import cron from "node-cron";
import { Cafeteria } from "../models/index.js";
import { Op } from "sequelize";
import logger from "../utils/logger.js";
import { emitCafeteriaUpdate } from "../socket.js";
import { clearCafeteriaCache, clearMenuCache } from "../utils/cache.js";

/**
 * ⏰ CAFETERIA SCHEDULER
 * Automatically toggles isOpen status based on openTime and closeTime
 */
export const initCafeteriaScheduler = () => {
  logger.info("⏰ Cafeteria Scheduler Initialized (Every Minute)");

  // Run every minute at the start of the minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      // Get current time in HH:mm format (24h) in Asia/Kolkata timezone
      const options = { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false };
      const formatter = new Intl.DateTimeFormat("en-US", options);
      const parts = formatter.formatToParts(now);
      const hour = parts.find(p => p.type === "hour").value;
      const minute = parts.find(p => p.type === "minute").value;
      const currentTime = `${hour}:${minute}`;
      
      // Fetch all cafeterias that HAVE a schedule set
      const cafeterias = await Cafeteria.findAll({
        where: {
          openTime: { [Op.ne]: null },
          closeTime: { [Op.ne]: null }
        }
      });

      for (const cafe of cafeterias) {
        if (!cafe.openTime || !cafe.closeTime) continue;

        // Determine if cafeteria should be open (supports overnight shifts crossing midnight)
        let shouldBeOpen = false;
        if (cafe.openTime <= cafe.closeTime) {
          shouldBeOpen = currentTime >= cafe.openTime && currentTime < cafe.closeTime;
        } else {
          shouldBeOpen = currentTime >= cafe.openTime || currentTime < cafe.closeTime;
        }

        if (cafe.isOpen !== shouldBeOpen) {
          logger.info(`🔄 [SCHEDULER] Toggling ${cafe.name} to ${shouldBeOpen ? "OPEN" : "CLOSED"} (Current: ${currentTime}, Schedule: ${cafe.openTime}-${cafe.closeTime})`);
          await cafe.update({ isOpen: shouldBeOpen });

          // Emit real-time update to all connected clients
          emitCafeteriaUpdate(cafe.id, {
            isOpen: shouldBeOpen,
            isOffline: cafe.isOffline,
            isBusy: cafe.isBusy
          });

          // 🗑️ Clear Cache instantly
          await clearCafeteriaCache();
          await clearMenuCache(cafe.id);
        }
      }
    } catch (error) {
      logger.error("❌ Cafeteria Scheduler Error:", error);
    }
  });
};
