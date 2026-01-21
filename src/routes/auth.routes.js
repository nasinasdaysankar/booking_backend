import express from "express";
import {
  //register,
  //login,
  //googleLogin,
  sendOtp,
  verifyOtp
} from "../controllers/authController.js";

const router = express.Router();

// PUBLIC AUTH ROUTES
// router.post("/register", register);
// router.post("/login", login);
// router.post("/google", googleLogin);

// ✅ OTP ROUTES (FIXED)
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

export default router;
