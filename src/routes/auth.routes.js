import express from "express";
import { register, login,googleLogin,sendOtp,verifyOtp } from "../controllers/authController.js";

const router = express.Router();

// ✅ PUBLIC ROUTES (NO AUTH MIDDLEWARE)
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin); 
router.post("/auth/send-otp", sendOtp);
router.post("/auth/verify-otp", verifyOtp);


export default router;
