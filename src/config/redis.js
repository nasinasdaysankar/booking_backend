// ============================================
// 🔥 REDIS CONNECTION & CACHE HELPERS
// High-speed temporary storage for caching
// ============================================

import Redis from "ioredis";

// ============================================
// 🔗 REDIS CONNECTION
// ============================================
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient;
let redisAvailable = false;

try {
    redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 5) {
                console.warn("⚠️ Redis: Max retries reached, running without Redis");
                return null; // stop retrying
            }
            return Math.min(times * 200, 2000); // exponential backoff
        },
        lazyConnect: true,
    });

    redisClient.on("connect", () => {
        redisAvailable = true;
        console.log("✅ Redis connected");
    });

    redisClient.on("error", (err) => {
        redisAvailable = false;
        console.warn("⚠️ Redis error:", err.message);
    });

    redisClient.on("close", () => {
        redisAvailable = false;
        console.warn("⚠️ Redis connection closed");
    });
} catch (err) {
    console.warn("⚠️ Redis initialization failed:", err.message);
    redisClient = null;
}

// ============================================
// 🛠️ CACHE HELPERS (Graceful Fallback)
// If Redis is down, these return null (cache miss)
// ============================================

/**
 * Get cached data from Redis
 * @param {string} key - Cache key
 * @returns {Object|null} Parsed JSON or null on miss/error
 */
export const getCache = async (key) => {
    if (!redisAvailable || !redisClient) return null;
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.warn(`⚠️ Redis GET error [${key}]:`, err.message);
        return null;
    }
};

/**
 * Set data in Redis cache
 * @param {string} key - Cache key
 * @param {*} value - Data to cache (will be JSON.stringify'd)
 * @param {number} ttl - Time to live in seconds (default: 60)
 */
export const setCache = async (key, value, ttl = 60) => {
    if (!redisAvailable || !redisClient) return;
    try {
        await redisClient.set(key, JSON.stringify(value), "EX", ttl);
    } catch (err) {
        console.warn(`⚠️ Redis SET error [${key}]:`, err.message);
    }
};

/**
 * Delete specific key(s) from Redis
 * @param  {...string} keys - Keys to delete
 */
export const delCache = async (...keys) => {
    if (!redisAvailable || !redisClient) return;
    try {
        await redisClient.del(...keys);
    } catch (err) {
        console.warn(`⚠️ Redis DEL error:`, err.message);
    }
};

/**
 * Delete all keys matching a pattern (e.g., "menu:*")
 * @param {string} pattern - Glob pattern
 */
export const delCachePattern = async (pattern) => {
    if (!redisAvailable || !redisClient) return;
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(...keys);
        }
    } catch (err) {
        console.warn(`⚠️ Redis pattern DEL error [${pattern}]:`, err.message);
    }
};

/**
 * Check if Redis is connected
 */
export const isRedisReady = () => redisAvailable;

/**
 * Connect to Redis (call during server startup)
 */
export const connectRedis = async () => {
    if (!redisClient) return false;
    try {
        await redisClient.connect();
        return true;
    } catch (err) {
        console.warn("⚠️ Redis connect failed:", err.message);
        return false;
    }
};

/**
 * Get Redis cache stats
 */
export const getCacheStats = async () => {
    if (!redisAvailable || !redisClient) return { status: "unavailable" };
    try {
        const info = await redisClient.info("stats");
        const keyCount = await redisClient.dbsize();
        return { status: "connected", keyCount, info: info.substring(0, 500) };
    } catch {
        return { status: "error" };
    }
};

export default redisClient;
