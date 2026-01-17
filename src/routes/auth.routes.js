import express from "express";
import { register, login,googleLogin } from "../controllers/authController.js";

const router = express.Router();

// ✅ PUBLIC ROUTES (NO AUTH MIDDLEWARE)
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin); // ✅ ADD THIS

export default router;
