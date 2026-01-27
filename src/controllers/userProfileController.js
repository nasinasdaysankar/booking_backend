// import { User } from "../models/index.js";

// export const updateProfile = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { name, phone } = req.body;

//     const user = await User.findByPk(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     await user.update({
//       name: name ?? user.name,
//       phone: phone ?? user.phone,
//     });

//     return res.json({
//       success: true,
//       message: "Profile updated successfully",
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         role: user.role,
//       },
//     });
//   } catch (err) {
//     console.error("❌ updateProfile error:", err);
//     res.status(500).json({ message: "Profile update failed" });
//   }
// };
import { User } from "../models/index.js";

// ✅ GET USER PROFILE
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "phone", "role"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ getProfile error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// EXISTING updateProfile function
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.update({
      name: name ?? user.name,
      phone: phone ?? user.phone,
    });

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ updateProfile error:", err);
    res.status(500).json({ message: "Profile update failed" });
  }
};

// ============================================
// 🗑️ DELETE ACCOUNT (Required for App Store / Play Store)
// ============================================
/**
 * DELETE /api/user/delete-account
 * Permanently delete user account and anonymize data
 * - Anonymizes personal info (GDPR compliant)
 * - Retains order history with anonymized user reference
 * - Deletes FCM tokens and streaks
 * - Required for App Store and Play Store compliance
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🗑️ [DELETE ACCOUNT] User ${userId} requested account deletion`);

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Import additional models for cleanup
    const { UserFcmToken, UserStreak, OrderFeedback } = await import("../models/index.js");

    // ====================================
    // 1. DELETE FCM TOKENS (Push notifications)
    // ====================================
    const deletedTokens = await UserFcmToken.destroy({
      where: { userId }
    });
    console.log(`   ✅ Deleted ${deletedTokens} FCM tokens`);

    // ====================================
    // 2. DELETE USER STREAKS
    // ====================================
    const deletedStreaks = await UserStreak.destroy({
      where: { userId }
    });
    console.log(`   ✅ Deleted ${deletedStreaks} streak records`);

    // ====================================
    // 3. DELETE ORDER FEEDBACK (studentId is NOT NULL)
    // ====================================
    const deletedFeedback = await OrderFeedback.destroy({
      where: { studentId: userId }
    });
    console.log(`   ✅ Deleted ${deletedFeedback} order feedback records`);

    // ====================================
    // 4. ANONYMIZE USER DATA (GDPR Compliant)
    // Instead of hard delete, we anonymize to keep order history
    // ====================================
    const anonymizedEmail = `deleted_${userId}_${Date.now()}@deleted.velish.app`;
    const anonymizedPhone = null;
    const anonymizedName = "Deleted User";

    await user.update({
      name: anonymizedName,
      email: anonymizedEmail,
      phone: anonymizedPhone,
      googleId: null,
      // Add a flag to mark account as deleted (optional)
    });
    console.log(`   ✅ Anonymized user data`);

    // ====================================
    // 5. ALTERNATIVELY: HARD DELETE USER
    // Uncomment below if you want complete deletion
    // Note: This may fail if there are order references
    // ====================================
    // await user.destroy();
    // console.log(`   ✅ User record deleted`);

    console.log(`🗑️ [DELETE ACCOUNT] Account deletion completed for user ${userId}`);

    return res.json({
      success: true,
      message: "Your account has been deleted successfully",
    });

  } catch (err) {
    console.error("❌ deleteAccount error:", err);
    res.status(500).json({
      success: false,
      message: "Account deletion failed: " + err.message
    });
  }
};