import express from "express";
import {
  // register,
  // login,
  // googleLogin,
  sendOtp,
  verifyOtp,
  saveFcmForOtp,
} from "../controllers/authController.js";

const router = express.Router();

//
// router.post("/register", register);
// router.post("/login", login);
// router.post("/google", googleLogin);

//✅ OTP ROUTES (FIXED)
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/save-fcm", saveFcmForOtp);


export default router;
