import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User, Admin } from "../models/index.js";

dotenv.config();

// middleware/auth.js
export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
       return res.status(401).json({ success: false, message: "Token missing" });
    }

    const token = header.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

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
    req.user = {
      id: account.id,
      role: account.role, 
      cafeteriaId: account.cafeteriaId || null,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
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