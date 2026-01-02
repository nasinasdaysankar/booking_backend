import express from "express";
import { auth } from "../middleware/auth.js";
import { AdminFcmToken } from "../models/index.js";

const router = express.Router();

router.post("/save-token", auth, async (req, res) => {
  try {
    console.log("📥 /save-token API HIT");

    console.log("🧾 req.user:", req.user);
    console.log("📦 req.body:", req.body);

    const { token } = req.body;
    const { id: adminId, cafeteriaId } = req.user;

    if (!token) {
      console.log("❌ FCM token missing in request");
      return res.status(400).json({ message: "Token missing" });
    }

    console.log("💾 Saving FCM token to DB:", {
      adminId,
      cafeteriaId,
      token,
    });

    const result = await AdminFcmToken.upsert({
      adminId,
      cafeteriaId,
      fcmToken: token,
    });

    console.log("✅ FCM token saved/updated:", result);

    res.json({ success: true });
  } catch (e) {
    console.error("❌ Error saving FCM token:", e);
    res.status(500).json({ message: "Failed to save token" });
  }
});


export default router;
