import express from "express";
import {
  register,
  login,
  googleLogin,
  appleLogin,
} from "../controllers/authController.js";
import { refreshToken } from "../controllers/refreshTokenController.js";

const router = express.Router();


router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/apple", appleLogin);
router.post("/refresh-token", refreshToken);

//✅ OTP ROUTES (FIXED)
// router.post("/send-otp", sendOtp);
// router.post("/verify-otp", verifyOtp);
// router.post("/save-fcm", saveFcmForOtp);


export default router;
