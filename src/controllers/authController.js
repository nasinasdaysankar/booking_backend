import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/index.js";

dotenv.config();

// ================= JWT GENERATOR =================
const signToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ================= REGISTER =================
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const domain = email.split("@")[1];

    // Allow only college emails
    if (domain !== "alliance.edu.in" && domain !== "ced.alliance.edu.in") {
      return res.status(400).json({
        message:
          "Only college emails are allowed (@alliance.edu.in / @ced.alliance.edu.in)",
      });
    }

    // Assign role
    const role = domain === "alliance.edu.in" ? "faculty" : "student";

    // Check existing user
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
    });

    const token = signToken(user);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

// ================= LOGIN =================
export const login = async (req, res) => {
  try {
    console.log("🔥 LOGIN CONTROLLER HIT", req.body);

    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = signToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      message: "Login failed",
    });
  }
};
