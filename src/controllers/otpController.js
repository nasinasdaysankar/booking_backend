import nodemailer from "nodemailer";
import crypto from "crypto";
import { User } from "../models/index.js";
import jwt from "jsonwebtoken";

export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email.endsWith("@alliance.edu.in")) {
      return res.status(400).json({ message: "Only university email allowed" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
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
  const { email, otp } = req.body;
  const user = await User.findOne({ where: { email } });

  if (!user || user.otp !== otp || Date.now() > user.otpExpiry) {
    return res.status(400).json({ message: "Invalid or Expired OTP" });
  }

  user.otp = null;
  user.otpExpiry = null;
  await user.save();

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.json({ message: "Login success", token, user });
};
