import cron from "node-cron";
import { MenuItem } from "../models/index.js";
import logger from "../utils/logger.js";
import { clearMenuCache } from "../utils/cache.js";

/**
 * ⏰ STOCK AUTO-UPDATE SCHEDULER
 * Resets stock to defaultStockQuantity for items with autoStockUpdate enabled
 * Runs daily at midnight (00:00)
 */
export const initStockScheduler = () => {
  logger.info("⏰ Stock Auto-Update Scheduler Initialized (Daily at Midnight)");

  // Run at 00:00 every day (Midnight) in Asia/Kolkata timezone
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        logger.info("🔄 [SCHEDULER] Starting daily stock auto-update reset...");

        // Find all menu items that have autoStockUpdate enabled
        const itemsToUpdate = await MenuItem.findAll({
          where: {
            autoStockUpdate: true,
            isDeleted: false,
          },
        });

        if (itemsToUpdate.length === 0) {
          logger.info("ℹ️ [SCHEDULER] No items found for stock auto-update.");
          return;
        }

        let updatedCount = 0;
        const cafeteriaIdsToClearCache = new Set();

        for (const item of itemsToUpdate) {
          await item.update({
            stock: item.defaultStockQuantity,
          });
          cafeteriaIdsToClearCache.add(item.cafeteriaId);
          updatedCount++;
        }

        // Clear cache for affected cafeterias
        for (const cafeteriaId of cafeteriaIdsToClearCache) {
          await clearMenuCache(cafeteriaId);
        }

        logger.info(`✅ [SCHEDULER] Successfully reset stock for ${updatedCount} items across ${cafeteriaIdsToClearCache.size} cafeterias.`);
      } catch (error) {
        logger.error("❌ Stock Auto-Update Scheduler Error:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );
};
