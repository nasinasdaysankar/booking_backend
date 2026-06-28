import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  googleLogin,
  appleLogin,
  sendOtp,
  verifyOtp,
} from "../controllers/authController.js";
import { refreshToken } from "../controllers/refreshTokenController.js";

const router = express.Router();

// Stricter rate limiting for heavy/costly auth operations (login/google/apple)
const authHeavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 login attempts per 15 minutes per IP
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.ENABLE_RATE_LIMIT === "false"
});

// Relaxed rate limiting for lightweight token refresh
const authLightLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 token refreshes per 15 minutes per IP
  message: { success: false, message: "Too many refresh attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.ENABLE_RATE_LIMIT === "false"
});

// Disabled legacy insecure register endpoint - authentication must use Google, Apple, or OTP
router.post("/register", authHeavyLimiter, (req, res) => {
  return res.status(405).json({
    success: false,
    message: "Registration via email/password is disabled. Please use Google Sign-In, Apple Sign-In, or OTP instead."
  });
});
router.post("/login", authHeavyLimiter, login);
router.post("/google", authHeavyLimiter, googleLogin);
router.post("/apple", authHeavyLimiter, appleLogin);
router.post("/refresh-token", authLightLimiter, refreshToken);

// Disabled legacy auth OTP routes - user login must use Google or Apple Sign-In
router.post("/send-otp", authHeavyLimiter, (req, res) => {
  return res.status(405).json({
    success: false,
    message: "OTP authentication is disabled. Please use Google or Apple Sign-In."
  });
});
router.post("/verify-otp", authHeavyLimiter, (req, res) => {
  return res.status(405).json({
    success: false,
    message: "OTP authentication is disabled. Please use Google or Apple Sign-In."
  });
});

export default router;
