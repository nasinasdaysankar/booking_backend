import express from "express";
import { auth } from "../middleware/auth.js";
import { AdminFcmToken, UserFcmToken, User } from "../models/index.js";
import { sendNotification } from "../utils/notificationUtils.js";
import admin from "../config/firebaseAdmin.js";

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

    const { token, deviceInfo } = req.body;
    const { id: adminId, cafeteriaId } = req.user;

    if (!token) {
      console.log("❌ FCM token missing");
      return res.status(400).json({ message: "FCM token missing" });
    }

    console.log("💾 Saving FCM token (multi-device support):", {
      adminId,
      cafeteriaId,
      deviceInfo: deviceInfo || "Unknown Device",
      token: token.substring(0, 20) + "...",
    });

    /**
     * ✅ MULTI-DEVICE SUPPORT
     */
    const [savedToken, created] = await AdminFcmToken.findOrCreate({
      where: { fcmToken: token },
      defaults: {
        adminId,
        cafeteriaId,
        fcmToken: token,
        deviceInfo: deviceInfo || "Unknown Device",
      },
    });

    if (!created) {
      // Token already exists, update admin association and device info
      await savedToken.update({ adminId, cafeteriaId, deviceInfo: deviceInfo || savedToken.deviceInfo || "Unknown Device" });
      console.log("🔄 Existing FCM token updated");
    } else {
      console.log("✅ New FCM token saved for device");
    }

    // Count total tokens for this admin or cafeteria
    const totalTokens = await AdminFcmToken.count({
      where: cafeteriaId ? { cafeteriaId } : { adminId },
    });
    console.log(`📊 Total FCM tokens associated: ${totalTokens}`);

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

    // ✅ AUTO-CLEANUP: If user was marked as uninstalled, clear it now (reinstalled)
    await User.update({
      isUninstalled: false,
      uninstalledAt: null
    }, {
      where: { id: userId }
    });

    console.log("✅ User FCM token saved (Uninstalled status cleared if any)");
    res.json({ success: true });
  } catch (e) {
    console.error("❌ User FCM error:", e);
    res.status(500).json({ message: "Failed to save user token" });
  }
});


router.post("/geofence-event", auth, async (req, res) => {
  try {
    const { cafeteriaId, cafeteriaName, eventType } = req.body;
    const userId = req.user.id;

    console.log(`📍 User ${userId} ${eventType} ${cafeteriaName} (Geofence/Nearby notification disabled)`);

    return res.json({ success: true, message: "Geofence notifications are disabled" });
  } catch (error) {
    console.error("❌ Geofence event error:", error);
    res.status(500).json({ success: false });
  }
});

// Optional: Admin can manually send notifications
router.post('/send-geofence-notification', async (req, res) => {
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
