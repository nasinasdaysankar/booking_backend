import { MenuItem, Banner, sequelize } from "../models/index.js";
import { Op } from "sequelize";
import { clearBannerCache, clearMenuCache } from "./cache.js";

/**
 * Automatically syncs banner visibility based on item availability in a category.
 * A banner is visible only if at least one available item exists in that category.
 * (Stock levels are ignored per user request - banners stay ON during stock-outs).
 */
export const syncCategoryBanner = async (cafeteriaId, categoryName) => {
  if (!categoryName) return;

  try {
    const cid = Number(cafeteriaId);
    const normalizedCategory = categoryName.toLowerCase().trim();

    // 1. Count items matching the category and isAvailable toggle
    const count = await MenuItem.count({
      where: {
        cafeteriaId: cid,
        category: sequelize.where(
          sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("category"))),
          normalizedCategory
        ),
        isDeleted: false,
        isAvailable: true
      }
    });

    const shouldBeVisible = count > 0;

    // 2. Find and update banners with matching name
    const [updatedCount] = await Banner.update(
      { isVisible: shouldBeVisible },
      {
        where: {
          cafeteriaId: cid,
          name: sequelize.where(
            sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("name"))),
            normalizedCategory
          )
        }
      }
    );

    if (updatedCount > 0) {
      console.log(`✅ [BANNER_SYNC] Category "${categoryName}" visibility synced to: ${shouldBeVisible}`);
      
      // 🗑️ IMPORTANT: Clear Redis cache so changes are visible immediately
      await clearBannerCache();
      await clearMenuCache(cid);
    } else {
      console.log(`ℹ️ [BANNER_SYNC] No banner found matching category "${categoryName}" for cafeteria ${cid}`);
    }
  } catch (err) {
    console.error(`❌ [BANNER_SYNC] Failed for category "${categoryName}":`, err.message);
  }
};
