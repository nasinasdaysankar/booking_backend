import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/index.js";
import admin from "../config/firebaseAdmin.js";


dotenv.config();

// Generate JWT Token
const signToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};


export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "ID token missing" });
    }

    // 🔐 Verify Firebase ID Token
    const decoded = await admin.auth().verifyIdToken(idToken);

    const email = decoded.email;
    const name = decoded.name || "Google User";

    // ✅ ONLY GOOGLE USERS — DEFAULT ROLE
    const role = "student";

    // 🔎 Find or create user
    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        name,
        email,
        role,               // ✅ ENUM SAFE
        passwordHash: null, // Google users don’t need password
      });
    }

    const token = signToken(user);

    return res.json({
      message: "Google login successful 🎉",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    console.error("❌ Google auth error:", err);
    return res.status(401).json({
      message: "Google authentication failed",
    });
  }
};

/* ===========================================================
   📌 REGISTER ONLY UNIVERSITY EMAILS
   - alliance.edu.in → FACULTY
   - ced.alliance.edu.in → STUDENT
=========================================================== */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required ❗" });

    const domain = email.split("@")[1]?.toLowerCase();

    // ================= NEW DOMAIN LOGIC =================
    let role;
    if (domain === "alliance.edu.in") {
      role = "faculty";
    } else if (domain === "gmail.com") {
      role = "student";
    } else {
      return res.status(400).json({
        message: "Use @alliance.edu.in for Faculty or @gmail.com for Students."
      });
    }
    // ===================================================

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "Email already registered ❗" });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      role
    });

    const token = signToken(user);

    res.status(201).json({
      message: "Registration Successful 🎉",
      token,
      user: { id: user.id, name: user.name, email: user.email, role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Register error ❌" });
  }
};
/* ===========================================================
   📌 LOGIN (email + password)
=========================================================== */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid email or password ❌" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Invalid email or password ❌" });

    const token = signToken(user);

    res.json({
      message: "Login Successful 🚀",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Login error ❌" });
  }
};


export const sendOtp = async (req, res) => {
  console.log("📥 /send-otp HIT");
  console.log("📦 Body:", req.body);

  try {
    const { email } = req.body;

    if (!email) {
      console.log("❌ Email missing");
      return res.status(400).json({ message: "Email required" });
    }

    let user = await User.findOne({ where: { email } });
    console.log("👤 Existing user:", user ? user.email : "NOT FOUND");

    if (!user) {
      console.log("🆕 Creating new user");
      user = await User.create({
        email,
        role: "student",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("🔐 Generated OTP:", otp);

    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    console.log("✅ OTP saved in DB");

    // ⚠️ TEMPORARY: NO EMAIL, JUST LOG
    console.log("📧 OTP SENT (DEV MODE):", otp);

    return res.status(200).json({
      message: "OTP sent successfully",
    });

  } catch (err) {
    console.error("🔥 SEND OTP ERROR:", err);
    return res.status(500).json({ message: "OTP send failed" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (
      user.otpCode !== otp ||
      !user.otpExpiry ||
      new Date() > user.otpExpiry
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.otpCode = null;
    user.otpExpiry = null;
    await user.save();

    const token = signToken(user);

    res.json({
      message: "Login successful 🎉",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OTP verification failed" });
  }
};
