import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User, Admin } from "../models/index.js";
import { getCache, setCache, delCache } from "../config/redis.js";
import { CACHE_KEYS } from "../utils/cache.js";

dotenv.config();

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
    // ============================================
    const cacheKey = CACHE_KEYS.AUTH(payload.id);
    const cachedUser = await getCache(cacheKey);
    
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }

    // ============================================
    // 🔍 CACHE MISS - Query Database
    // ============================================
    // Check Admin table first using the ID from the token
    let account = await Admin.findByPk(payload.id);

    if (!account) {
      // If not an admin, check the User table
      account = await User.findByPk(payload.id);
    }

    if (!account) {
      return res.status(401).json({ success: false, message: "Account not found" });
    }

    // Attach normalized data to the request
    const userData = {
      id: account.id,
      role: account.role, 
      cafeteriaId: account.cafeteriaId || null,
    };

    // ============================================
    // ✅ CACHE THE USER DATA IN REDIS
    // ============================================
    await setCache(cacheKey, userData, AUTH_TTL);
    
    req.user = userData;
    next();
  } catch (err) {
    console.error("❌ [AUTH MIDDLEWARE] Error:", err.message);
    console.error("   Stack:", err.stack);
    if (!process.env.JWT_SECRET) {
       console.error("❌ [CRITICAL] JWT_SECRET is NOT defined in environment variables!");
    } else {
       console.log("   JWT_SECRET is defined (length: " + process.env.JWT_SECRET.length + ")");
    }
    return res.status(401).json({ success: false, message: "Invalid or expired token: " + err.message });
  }
};

// ================= ROLE GUARD =================
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Check if the user's role is in the allowed list
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have the required permissions",
      });
    }

    next();
  };
};

// ============================================
// 🗑️ HELPER: Clear user from cache (on logout/delete)
// ============================================
export const clearAuthCache = async (userId) => {
  await delCache(CACHE_KEYS.AUTH(userId));
};







// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// import { User, Admin } from "../models/index.js";

// dotenv.config();

// // ==================== MAIN AUTH MIDDLEWARE ====================
// /**
//  * Verifies JWT token and attaches user data to req.user
//  * Sets: req.user.id, req.user.role, req.user.cafeteriaId
//  */
// export const auth = async (req, res, next) => {
//   try {
//     const header = req.headers.authorization;
    
//     if (!header || !header.startsWith("Bearer ")) {
//       console.error("❌ No authorization header");
//       return res.status(401).json({ 
//         success: false, 
//         message: "Token missing - please login first" 
//       });
//     }

//     const token = header.split(" ")[1];
    
//     if (!token) {
//       console.error("❌ Empty token");
//       return res.status(401).json({ 
//         success: false, 
//         message: "Invalid token format" 
//       });
//     }

//     let payload;
//     try {
//       payload = jwt.verify(token, process.env.JWT_SECRET);
//     } catch (err) {
//       console.error("❌ JWT verification failed:", err.message);
//       return res.status(401).json({ 
//         success: false, 
//         message: "Invalid or expired token - please login again" 
//       });
//     }

//     if (!payload.id) {
//       console.error("❌ No ID in token payload");
//       return res.status(401).json({ 
//         success: false, 
//         message: "Invalid token structure" 
//       });
//     }

//     // ✅ Check Admin table first
//     let account = await Admin.findByPk(payload.id);

//     if (!account) {
//       // ✅ If not an admin, check the User table
//       account = await User.findByPk(payload.id);
//     }

//     if (!account) {
//       console.error("❌ Account not found for ID:", payload.id);
//       return res.status(401).json({ 
//         success: false, 
//         message: "Account not found - please login again" 
//       });
//     }

//     // ✅ Attach normalized data to the request
//     req.user = {
//       id: account.id,
//       role: account.role,
//       cafeteriaId: account.cafeteriaId || null,
//       email: account.email,
//       name: account.name,
//     };

//     console.log(`✅ Authenticated: ${account.role} (ID: ${account.id})`);
//     next();

//   } catch (err) {
//     console.error("❌ Auth middleware error:", err.message);
//     return res.status(500).json({ 
//       success: false, 
//       message: "Authentication error" 
//     });
//   }
// };

// // ==================== ROLE-BASED ACCESS CONTROL ====================
// /**
//  * Checks if user has one of the required roles
//  * Usage: requireRole(["admin"]) or requireRole(["admin", "superadmin"])
//  */
// export const requireRole = (roles = []) => {
//   return (req, res, next) => {
//     if (!req.user || !req.user.role) {
//       console.error("❌ No user in request");
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized - user not authenticated",
//       });
//     }

//     // ✅ Check if the user's role is in the allowed list
//     if (!roles.includes(req.user.role)) {
//       console.error(`❌ Insufficient permissions: User has '${req.user.role}', needs one of: ${roles.join(", ")}`);
//       return res.status(403).json({
//         success: false,
//         message: `Forbidden: You need one of these roles: ${roles.join(", ")}`,
//       });
//     }

//     console.log(`✅ Role check passed: ${req.user.role}`);
//     next();
//   };
// };

// // ==================== CONVENIENCE MIDDLEWARE ====================
// /**
//  * Quick middleware for admin-only routes
//  * Usage: app.get("/route", auth, adminOnly, handler)
//  */
// export const adminOnly = requireRole(["admin"]);

// /**
//  * Quick middleware for user-only routes
//  * Usage: app.get("/route", auth, userOnly, handler)
//  */
// export const userOnly = requireRole(["user"]);

// // ==================== CAFETERIA VERIFICATION ====================
// /**
//  * Ensures admin is linked to a cafeteria
//  * Usage: app.get("/route", auth, adminOnly, requireCafeteria, handler)
//  */
// export const requireCafeteria = (req, res, next) => {
//   if (!req.user.cafeteriaId) {
//     console.error("❌ Admin not linked to cafeteria");
//     return res.status(403).json({
//       success: false,
//       message: "Your admin account is not linked to any cafeteria. Contact support.",
//     });
//   }

//   console.log(`✅ Cafeteria check passed: ${req.user.cafeteriaId}`);
//   next();
// };

// // ==================== OPTIONAL: SUPER ADMIN CHECK ====================
// /**
//  * For future use if you have multiple admin levels
//  */
// export const superAdminOnly = requireRole(["superadmin"]);

// // ==================== ERROR HANDLER FOR ASYNC ROUTES ====================
// /**
//  * Wrapper for async route handlers to catch errors
//  * Usage: router.get("/route", auth, asyncHandler(async (req, res) => { ... }))
//  */
// export const asyncHandler = (fn) => (req, res, next) => {
//   Promise.resolve(fn(req, res, next)).catch(next);
// };