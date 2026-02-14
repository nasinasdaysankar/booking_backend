// ============================================
// 🔥 REDIS-BACKED RESPONSE CACHE UTILITY
// Replaces node-cache with Redis for high-speed
// distributed caching
// ============================================

import { getCache, setCache, delCache, delCachePattern } from "../config/redis.js";

// ============================================
// TTL CONSTANTS (seconds)
// ============================================
const MENU_TTL = 60;         // 1 minute cache for menus
const CAFETERIA_TTL = 300;   // 5 minutes for cafeteria list
const BANNER_TTL = 300;      // 5 minutes for banners
const ANALYTICS_TTL = 120;   // 2 minutes for analytics
const STATS_TTL = 60;        // 1 minute for admin stats

// ============================================
// 📦 CACHE PREFIXES (namespace keys in Redis)
// ============================================
export const CACHE_KEYS = {
  MENU_PUBLIC: (cafeteriaId) => `menu:public:${cafeteriaId}`,
  MENU_ALL: "menu:all",
  CAFETERIAS_ALL: "cafeterias:all",
  BANNERS_ALL: "banners:all",
  AUTH: (userId) => `auth:${userId}`,
  OTP: (email) => `otp:${email}`,
  MOST_LOVED: (cafeteriaId) => `menu:loved:${cafeteriaId || "all"}`,
  TODAY_SPECIAL: (cafeteriaId) => `menu:special:${cafeteriaId}`,
  ANALYTICS_TREND: (cafeteriaId, range) => `analytics:trend:${cafeteriaId}:${range}`,
  ANALYTICS_TOP: (cafeteriaId, range) => `analytics:top:${cafeteriaId}:${range}`,
  ANALYTICS_OVERVIEW: (cafeteriaId, range) => `analytics:overview:${cafeteriaId}:${range}`,
  ANALYTICS_PEAK: (cafeteriaId, range) => `analytics:peak:${cafeteriaId}:${range}`,
  ANALYTICS_COMMISSION: (cafeteriaId) => `analytics:commission:${cafeteriaId}`,
  ADMIN_STATS: (cafeteriaId, range) => `admin:stats:${cafeteriaId}:${range}`,
};

// ============================================
// 📦 MENU CACHE
// ============================================
export const menuCacheGet = (key) => getCache(key);
export const menuCacheSet = (key, data) => setCache(key, data, MENU_TTL);

// ============================================
// 📦 CAFETERIA CACHE
// ============================================
export const cafeteriaCacheGet = (key) => getCache(key);
export const cafeteriaCacheSet = (key, data) => setCache(key, data, CAFETERIA_TTL);

// ============================================
// 📦 BANNER CACHE
// ============================================
export const bannerCacheGet = (key) => getCache(key);
export const bannerCacheSet = (key, data) => setCache(key, data, BANNER_TTL);

// ============================================
// 📦 ANALYTICS CACHE
// ============================================
export const analyticsCacheGet = (key) => getCache(key);
export const analyticsCacheSet = (key, data) => setCache(key, data, ANALYTICS_TTL);

// ============================================
// 📦 ADMIN STATS CACHE
// ============================================
export const statsCacheGet = (key) => getCache(key);
export const statsCacheSet = (key, data) => setCache(key, data, STATS_TTL);

// ============================================
// 🗑️ CACHE INVALIDATION HELPERS
// ============================================

/**
 * Clear menu cache for a specific cafeteria
 * Call this when menu items are added/updated/deleted
 */
export const clearMenuCache = async (cafeteriaId) => {
  if (cafeteriaId) {
    await delCache(CACHE_KEYS.MENU_PUBLIC(cafeteriaId));
    await delCache(CACHE_KEYS.MOST_LOVED(cafeteriaId));
    await delCache(CACHE_KEYS.TODAY_SPECIAL(cafeteriaId));
  }
  await delCache(CACHE_KEYS.MENU_ALL);
  await delCachePattern("menu:*");
  console.log(`🗑️ Redis cache cleared: menu for cafeteria ${cafeteriaId || 'all'}`);
};

/**
 * Clear all cafeteria cache
 * Call this when cafeteria details are updated
 */
export const clearCafeteriaCache = async () => {
  await delCachePattern("cafeterias:*");
  console.log("🗑️ Redis cache cleared: all cafeterias");
};

/**
 * Clear banner cache
 * Call this when banners are updated
 */
export const clearBannerCache = async () => {
  await delCache(CACHE_KEYS.BANNERS_ALL);
  console.log("🗑️ Redis cache cleared: all banners");
};

/**
 * Clear analytics cache for a cafeteria
 * Call this when orders change
 */
export const clearAnalyticsCache = async (cafeteriaId) => {
  await delCachePattern(`analytics:*:${cafeteriaId}:*`);
  await delCachePattern(`admin:stats:${cafeteriaId}:*`);
  console.log(`🗑️ Redis cache cleared: analytics for cafeteria ${cafeteriaId}`);
};

// ============================================
// 📊 CACHE STATS (for debugging)
// ============================================
export { getCacheStats } from "../config/redis.js";
