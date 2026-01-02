import express from "express";
import { auth } from "../middleware/auth.js";
import { AdminFcmToken } from "../models/index.js";

const router = express.Router();

router.post("/save-token", auth, async (req, res) => {
  try {
    const { token } = req.body;
    const { id: adminId, cafeteriaId } = req.user;

    if (!token) {
      return res.status(400).json({ message: "FCM token required" });
    }

    await AdminFcmToken.upsert({
      adminId,
      cafeteriaId,
      fcmToken: token,
    });

    res.json({ success: true });
  } catch (e) {
    console.error("❌ Save FCM token error:", e);
    res.status(500).json({ message: "Failed to save FCM token" });
  }
});

export default router;
