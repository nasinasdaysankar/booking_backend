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