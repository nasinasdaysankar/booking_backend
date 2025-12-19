import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/index.js";

export const adminLogin = async (req, res) => {
  try {
    const { staffId, password } = req.body;

    if (!staffId || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const admin = await Admin.findOne({ where: { staffId } });
    if (!admin) {
      return res.status(401).json({ message: "Invalid Staff ID or Password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid Staff ID or Password" });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        role: admin.role,
        cafeteriaId: admin.cafeteriaId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      user: {
        id: admin.id,
        staffId: admin.staffId,
        cafeteriaId: admin.cafeteriaId,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
