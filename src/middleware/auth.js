import jwt from "jsonwebtoken";
import { User, Admin } from "../models/index.js";
import { getCache, setCache, delCache } from "../config/redis.js";
import { CACHE_KEYS } from "../utils/cache.js";

// ============================================
// 🔥 AUTH CACHE TTL (seconds)
// ============================================
const AUTH_TTL = 300; // 5 minutes cache

// middleware/auth.js
export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
       return res.status(401).json({ success: false, message: "Token missing" });
    }

    const token = header.split(" ")[1];
    
    // 🔥 DEBUG LOGGING
    if (!token) {
        console.error("❌ [AUTH] Token extraction failed - Header:", header);
    } else {
       // Only log first 20 chars for security, unless it's malformed then we need to see it
       console.log("🔍 [AUTH] Verifying token:", token.substring(0, 20) + "..."); 
       console.log("   Token Length:", token.length);
    }
    
    // Check for common issues
    if (token.includes('"')) console.warn("⚠️ [AUTH] Token contains quotes!");

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ============================================
    // ✅ CHECK REDIS CACHE FIRST (Skip DB query)
    // Use a type-prefixed key for delivery partners to avoid ID collisions
    // with regular users who may share the same numeric ID.
    // ============================================
    const isDeliveryToken = payload.role === "DELIVERY";
    const cacheKey = isDeliveryToken
      ? CACHE_KEYS.AUTH_DELIVERY(payload.id)
      : CACHE_KEYS.AUTH(payload.id);
    const cachedUser = await getCache(cacheKey);

    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }

    // ============================================
    // 🔍 CACHE MISS - Query Database
    // ============================================
    let account = null;
    let userType = null;
    let role = payload.role;

    // Use the role in the token to decide which table to query
    if (role === "superadmin" || role === "admin" || role === "manager" || role === "staff") {
      account = await Admin.findByPk(payload.id);
      userType = "admin";
    } else if (role === "USER") {
      account = await User.findByPk(payload.id);
      userType = "user";
    } else if (role === "DELIVERY") {
      const { DeliveryPartner } = await import("../models/index.js");
      account = await DeliveryPartner.findByPk(payload.id);
      userType = "delivery";
    }

    // Fallback: If role wasn't clear, try all (Legacy support)
    if (!account) {
      account = await Admin.findByPk(payload.id);
      if (account) { userType = "admin"; role = account.role; }
    }
    if (!account) {
      account = await User.findByPk(payload.id);
      if (account) { userType = "user"; role = "USER"; }
    }
    if (!account) {
      const { DeliveryPartner } = await import("../models/index.js");
      account = await DeliveryPartner.findByPk(payload.id);
      if (account) { userType = "delivery"; role = "DELIVERY"; }
    }

    if (!account) {
      console.error(`❌ [AUTH] Account not found for ID: ${payload.id} with role: ${role}`);
      return res.status(401).json({ success: false, message: "Account not found" });
    }

    // Attach normalized data to the request
    const userData = {
      id: account.id,
      role: role,
      userType: userType,
      cafeteriaId: account.cafeteriaId || null,
    };

    console.log(`🛡️ [AUTH] User verified: ID ${userData.id}, Role: ${userData.role}, Type: ${userData.userType}`);

    // ============================================
    // ✅ CACHE THE USER DATA IN REDIS
    // ============================================
    await setCache(cacheKey, userData, AUTH_TTL);

    req.user = userData;
    next();
  } catch (err) {
    console.error("❌ [AUTH MIDDLEWARE] Error:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * requireRole - Simple middleware to check user roles
 * @param {Array} roles - Array of allowed roles
 */
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      console.error("🚫 [ROLE] No user or role found in request");
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 🔥 DEBUG LOG
    console.log(`🔑 [ROLE] Checking if user role '${req.user.role}' is in [${roles.join(', ')}]`);

    // Check if the user's role is in the allowed list
    if (!roles.includes(req.user.role)) {
      console.warn(`🛑 [ROLE] Access DENIED for role: ${req.user.role}`);
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have the required permissions",
      });
    }

    console.log(`✅ [ROLE] Access GRANTED for role: ${req.user.role}`);
    next();
  };
};

// ============================================
// 👑 SUPERADMIN AUTH (Secure JWT)
// ============================================
export const superadminAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Superadmin token missing" });
    }

    const token = header.split(" ")[1];
    
    // Verify using the dedicated superadmin secret
    const payload = jwt.verify(token, process.env.SUPERADMIN_JWT_SECRET);

    if (payload.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: "Access denied: Not a superadmin" });
    }

    req.user = {
      id: payload.id,
      role: 'superadmin'
    };
    
    next();
  } catch (err) {
    console.error("❌ [SUPERADMIN AUTH] Error:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired superadmin token" });
  }
};

// ============================================
// 🗑️ HELPER: Clear user from cache (on logout/delete)
// ============================================
export const clearAuthCache = async (userId, userType = "user") => {
  await delCache(CACHE_KEYS.AUTH(userId));
  if (userType === "delivery") {
    await delCache(CACHE_KEYS.AUTH_DELIVERY(userId));
  }
};

// ============================================
// 🔑 INTERNAL WEBHOOK AUTH (API Key)
// ============================================
export const verifyWebhookKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const internalSecret = process.env.WEBHOOK_API_KEY;

  if (!apiKey || apiKey !== internalSecret) {
    console.error("❌ [WEBHOOK AUTH] Invalid or missing API key");
    return res.status(401).json({ success: false, message: "Unauthorized webhook access" });
  }

  next();
};


// ==================== ERROR HANDLER FOR ASYNC ROUTES ====================
/**
 * Wrapper for async route handlers to catch errors
 * Usage: router.get("/route", auth, asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
 
// Middleware that allows EITHER regular admin (JWT_SECRET) OR superadmin (SUPERADMIN_JWT_SECRET)
export const eitherAdminAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Token missing" });
  }
  const token = header.split(" ")[1];
 
  // 1. Try Superadmin first
  try {
    const payload = jwt.verify(token, process.env.SUPERADMIN_JWT_SECRET);
    if (payload.role === 'superadmin') {
      req.user = { id: payload.id, role: 'superadmin', userType: 'admin' };
      return next();
    }
  } catch (_) {}
 
  // 2. Try Regular Admin
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role === 'admin' || payload.role === 'superadmin') {
      req.user = { 
        id: payload.id, 
        role: payload.role || 'admin', 
        cafeteriaId: payload.cafeteriaId || null,
        userType: 'admin'
      };
      return next();
    }
  } catch (_) {}
 
  return res.status(401).json({ success: false, message: "Unauthorized: Access denied" });
};

// Middleware that allows ANY authenticated user (Superadmin, Regular Admin, or Regular User)
export const eitherAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Token missing" });
    }
    const token = header.split(" ")[1];

    // 1. Try Superadmin first (Master key / Dashboard)
    try {
      const payload = jwt.verify(token, process.env.SUPERADMIN_JWT_SECRET);
      if (payload.role === 'superadmin') {
        req.user = { 
          id: payload.id, 
          role: 'superadmin',
          userType: 'admin' 
        };
        return next();
      }
    } catch (_) {}

    // 2. Try Regular JWT (Admin App / User App)
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      
      const cacheKey = CACHE_KEYS.AUTH(payload.id);
      let userData = await getCache(cacheKey);

      if (!userData) {
        let userType = "admin";
        let account = await Admin.findByPk(payload.id);

        if (!account) {
          userType = "user";
          account = await User.findByPk(payload.id);
        }

        if (!account) {
          return res.status(401).json({ success: false, message: "Account not found" });
        }

        userData = {
          id: account.id,
          role: account.role,
          userType,
          cafeteriaId: account.cafeteriaId || null,
        };
        await setCache(cacheKey, userData, AUTH_TTL);
      }

      req.user = userData;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, message: "Unauthorized: " + err.message });
    }
  } catch (error) {
    console.error("❌ [eitherAuth] Error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};