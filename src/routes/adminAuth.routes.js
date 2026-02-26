import express from "express";
import { adminLogin, resetAdminPassword } from "../controllers/adminAuth.controller.js";
import { refreshToken } from "../controllers/refreshTokenController.js";

const router = express.Router();

// 🔐 ADMIN LOGIN ONLY
router.post("/login", adminLogin);
router.post("/refresh-token", refreshToken);

// 🔧 TEMPORARY: Password reset (REMOVE AFTER USE!)
router.post("/reset-password", resetAdminPassword);

export default router;
