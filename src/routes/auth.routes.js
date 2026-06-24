import express from "express";
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


// Disabled legacy insecure register endpoint - authentication must use Google, Apple, or OTP
router.post("/register", (req, res) => {
  return res.status(405).json({
    success: false,
    message: "Registration via email/password is disabled. Please use Google Sign-In, Apple Sign-In, or OTP instead."
  });
});
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/apple", appleLogin);
router.post("/refresh-token", refreshToken);

//✅ OTP ROUTES (FIXED)
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);


export default router;
