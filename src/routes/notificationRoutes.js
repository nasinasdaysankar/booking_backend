import express from "express";
import { auth } from "../middleware/auth.js";
import { AdminFcmToken, UserFcmToken } from "../models/index.js";

const router = express.Router();

/**
 * ======================================================
 * SAVE / UPDATE ADMIN FCM TOKEN
 * ======================================================
 * Called after admin login (with JWT)
 */
router.post("/save-token", auth, async (req, res) => {
  try {
    console.log("📥 /save-token API HIT");

    console.log("🧾 req.user:", req.user);
    console.log("📦 req.body:", req.body);

    const { token } = req.body;
    const { id: adminId, cafeteriaId } = req.user;

    if (!token) {
      console.log("❌ FCM token missing");
      return res.status(400).json({ message: "FCM token missing" });
    }

    console.log("💾 Replacing FCM token in DB:", {
      adminId,
      cafeteriaId,
      token,
    });

    /**
     * 🔥 IMPORTANT FIX
     * Remove old tokens for this admin + cafeteria
     * (prevents sending notifications to old phones)
     */
    const deletedCount = await AdminFcmToken.destroy({
      where: {
        adminId,
        cafeteriaId,
      },
    });

    console.log(`🧹 Removed ${deletedCount} old FCM tokens`);

    /**
     * ✅ Save fresh token
     */
    const savedToken = await AdminFcmToken.create({
      adminId,
      cafeteriaId,
      fcmToken: token,
    });

    console.log("✅ New FCM token saved:", savedToken.dataValues);

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving FCM token:", err);
    return res.status(500).json({ message: "Failed to save FCM token" });
  }
});

/**
 * ======================================================
 * (OPTIONAL) REMOVE TOKEN ON LOGOUT
 * ======================================================
 * Call this when admin logs out
 */
router.post("/remove-token", auth, async (req, res) => {
  try {
    const { id: adminId, cafeteriaId } = req.user;

    console.log("🧹 Removing FCM token for admin:", adminId);

    const deleted = await AdminFcmToken.destroy({
      where: {
        adminId,
        cafeteriaId,
      },
    });

    console.log(`🧹 Tokens removed: ${deleted}`);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error removing token:", err);
    res.status(500).json({ message: "Failed to remove token" });
  }
});


/* ================= USER TOKEN ================= */
router.post("/save-user-token", auth, async (req, res) => {
  try {
    console.log("📥 /save-user-token API HIT");

    const { token } = req.body;
    const { id: userId } = req.user;

    if (!token) {
      return res.status(400).json({ message: "Token missing" });
    }

    await UserFcmToken.upsert({
      userId,
      fcmToken: token,
    });

    console.log("✅ User FCM token saved");
    res.json({ success: true });
  } catch (e) {
    console.error("❌ User FCM error:", e);
    res.status(500).json({ message: "Failed to save user token" });
  }
});

export default router;
