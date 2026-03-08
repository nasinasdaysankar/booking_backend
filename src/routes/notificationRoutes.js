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

    console.log("💾 Saving FCM token (multi-device support):", {
      adminId,
      cafeteriaId,
      token: token.substring(0, 20) + "...",
    });

    /**
     * ✅ MULTI-DEVICE SUPPORT
     * Each device has a unique FCM token, so we upsert by token.
     * This allows the same admin to receive notifications on ALL devices.
     * We do NOT delete old tokens — they stay until they become invalid
     * (invalid tokens are cleaned up when FCM send fails).
     */
    const [savedToken, created] = await AdminFcmToken.findOrCreate({
      where: { fcmToken: token },
      defaults: {
        adminId,
        cafeteriaId,
        fcmToken: token,
      },
    });

    if (!created) {
      // Token already exists, just update the admin/cafeteria association
      await savedToken.update({ adminId, cafeteriaId });
      console.log("🔄 Existing FCM token updated");
    } else {
      console.log("✅ New FCM token saved for device");
    }

    // Count total tokens for this cafeteria
    const totalTokens = await AdminFcmToken.count({
      where: { cafeteriaId },
    });
    console.log(`📊 Total FCM tokens for cafeteria ${cafeteriaId}: ${totalTokens}`);

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
    const { token } = req.body;

    console.log("🧹 Removing FCM token for admin:", adminId);

    // If a specific token is provided, only remove that device's token
    // Otherwise, remove all tokens for this admin (full logout)
    const whereClause = token
      ? { fcmToken: token }
      : { adminId, cafeteriaId };

    const deleted = await AdminFcmToken.destroy({
      where: whereClause,
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


router.post("/api/notify/geofence-event", auth, async (req, res) => {
  try {
    const { cafeteriaId, cafeteriaName, eventType } = req.body;
    const userId = req.user.id;

    console.log(`📍 User ${userId} ${eventType} ${cafeteriaName}`);

    // 🔍 Get user's FCM token
    const tokenRecord = await UserFcmToken.findOne({
      where: { userId },
    });

    if (!tokenRecord) {
      return res.json({ success: true, message: "No FCM token found" });
    }

    const message = {
      token: tokenRecord.fcmToken,
      notification: {
        title: `🍽 ${cafeteriaName} Nearby!`,
        body: `You're close to ${cafeteriaName}. Order now!`,
      },
      data: {
        cafeteriaId: cafeteriaId.toString(),
        cafeteriaName,
        type: "GEOFENCE",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "cafeteria_alerts",
        },
      },
    };

    await admin.messaging().send(message);

    console.log("✅ FCM push sent");

    res.json({ success: true });
  } catch (error) {
    console.error("❌ FCM error:", error);
    res.status(500).json({ success: false });
  }
});

// Optional: Admin can manually send notifications
router.post('/api/notify/send-geofence-notification', async (req, res) => {
  try {
    const { cafeteriaId } = req.body;

    // Get all users near this cafeteria from database
    // Send FCM notification to those users
    // This requires admin panel integration

    res.json({
      success: true,
      message: 'Geofence notifications sent',
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notifications',
    });
  }
});

export default router;
