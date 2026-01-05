import express from "express";
import { auth } from "../middleware/auth.js";
import { UserFcmToken } from "../models/index.js";

const router = express.Router();

router.post("/save-user-token", auth, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;

  if (!token) return res.status(400).json({ message: "Token missing" });

  await UserFcmToken.upsert({
    userId,
    fcmToken: token,
  });

  console.log("✅ USER FCM token saved:", userId);
  res.json({ success: true });
});

export default router;
