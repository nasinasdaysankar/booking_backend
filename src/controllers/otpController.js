import nodemailer from "nodemailer";
import crypto from "crypto";
import { User } from "../models/index.js";
import jwt from "jsonwebtoken";
import { getCache, setCache, delCache } from "../config/redis.js";
import { CACHE_KEYS } from "../utils/cache.js";

// ============================================
// OTP TTL: 5 minutes
// ============================================
const OTP_TTL = 300; // 5 minutes in seconds

export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email.endsWith("@alliance.edu.in")) {
      return res.status(400).json({ message: "Only university email allowed" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    // ✅ STORE OTP IN REDIS (auto-expires in 5 minutes)
    const cacheKey = CACHE_KEYS.OTP(email);
    await setCache(cacheKey, { otp, email }, OTP_TTL);

    // Also update DB (fallback for Redis unavailability)
    const expiry = Date.now() + 5 * 60 * 1000;
    await User.upsert({ email, otp, otpExpiry: expiry });

    const transporter = nodemailer.createTransport({
      service: "Outlook365",
      auth: {
        user: process.env.OUTLOOK_EMAIL,
        pass: process.env.OUTLOOK_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.OUTLOOK_EMAIL,
      to: email,
      subject: "Your Login OTP",
      text: `Your OTP is ${otp}`,
    });

    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    res.status(500).json({ message: "OTP sending failed", error: err });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // ✅ CHECK REDIS FIRST (fast path)
    const cacheKey = CACHE_KEYS.OTP(email);
    const cachedOtp = await getCache(cacheKey);

    if (cachedOtp && cachedOtp.otp === otp) {
      // ✅ OTP valid from Redis — delete it
      await delCache(cacheKey);

      // Look up or create user
      let user = await User.findOne({ where: { email } });
      if (!user) {
        user = await User.create({ email });
      }

      // Clear OTP from DB too
      user.otp = null;
      user.otpExpiry = null;
      await user.save();

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({ message: "Login success", token, user });
    }

    // ✅ FALLBACK: Check database (if Redis was down when OTP was sent)
    const user = await User.findOne({ where: { email } });
    if (!user || user.otp !== otp || Date.now() > user.otpExpiry) {
      return res.status(400).json({ message: "Invalid or Expired OTP" });
    }

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // Clean up Redis key if it exists
    await delCache(cacheKey);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login success", token, user });

  } catch (err) {
    console.error("❌ OTP verification error:", err);
    res.status(500).json({ message: "OTP verification failed", error: err.message });
  }
};
