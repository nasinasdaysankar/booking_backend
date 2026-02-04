import express from "express";
import { adminLogin, resetAdminPassword } from "../controllers/adminAuth.controller.js";

const router = express.Router();

// 🔐 ADMIN LOGIN ONLY
router.post("/login", adminLogin);

// 🔧 TEMPORARY: Password reset (REMOVE AFTER USE!)
router.post("/reset-password", resetAdminPassword);

export default router;
