import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/index.js";

dotenv.config();

// Generate JWT Token
const signToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
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
