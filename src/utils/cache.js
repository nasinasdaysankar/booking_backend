// ============================================
// 🔥 RESPONSE CACHE UTILITY
// For caching frequently accessed data
// ============================================

import NodeCache from "node-cache";

// Different caches for different data types
export const menuCache = new NodeCache({
  stdTTL: 60,       // 1 minute cache for menus
  checkperiod: 30,
  useClones: false
});

export const cafeteriaCache = new NodeCache({
  stdTTL: 300,      // 5 minutes cache for cafeteria list
  checkperiod: 60,
  useClones: false
});

export const bannerCache = new NodeCache({
  stdTTL: 300,      // 5 minutes cache for banners
  checkperiod: 60,
  useClones: false
});

// ============================================
// 🗑️ CACHE INVALIDATION HELPERS
// ============================================

/**
 * Clear menu cache for a specific cafeteria
 * Call this when menu items are added/updated/deleted
 */
export const clearMenuCache = (cafeteriaId) => {
  if (cafeteriaId) {
    menuCache.del(`menu_${cafeteriaId}`);
  }
  menuCache.del("menu_all");
  console.log(`🗑️ Cache cleared: menu for cafeteria ${cafeteriaId || 'all'}`);
};

/**
 * Clear all cafeteria cache
 * Call this when cafeteria details are updated
 */
export const clearCafeteriaCache = () => {
  cafeteriaCache.flushAll();
  console.log("🗑️ Cache cleared: all cafeterias");
};

/**
 * Clear banner cache
 * Call this when banners are updated
 */
export const clearBannerCache = () => {
  bannerCache.flushAll();
  console.log("🗑️ Cache cleared: all banners");
};

// ============================================
// 📊 CACHE STATS (for debugging)
// ============================================
export const getCacheStats = () => ({
  menu: menuCache.getStats(),
  cafeteria: cafeteriaCache.getStats(),
  banner: bannerCache.getStats(),
});
