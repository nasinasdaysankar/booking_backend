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

// ============================================
// 🗑️ DELETE ADMIN ACCOUNT (Required for App Store / Play Store)
// ============================================
/**
 * DELETE /api/admin/delete-account
 * Permanently delete admin account
 * - Anonymizes admin info
 * - Deletes FCM tokens
 * - Required for App Store and Play Store compliance
 */
export const deleteAdminAccount = async (req, res) => {
  try {
    const adminId = req.user.id;
    console.log(`🗑️ [DELETE ADMIN ACCOUNT] Admin ${adminId} requested account deletion`);

    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    // Import additional models for cleanup
    const { AdminFcmToken } = await import("../models/index.js");

    // ====================================
    // 1. DELETE FCM TOKENS (Push notifications)
    // ====================================
    const deletedTokens = await AdminFcmToken.destroy({
      where: { adminId }
    });
    console.log(`   ✅ Deleted ${deletedTokens} FCM tokens`);

    // ====================================
    // 2. ANONYMIZE ADMIN DATA
    // We don't hard delete to maintain audit trail
    // ====================================
    const anonymizedStaffId = `deleted_${adminId}_${Date.now()}`;
    const hashedDeletedPassword = await bcrypt.hash(`deleted_${Date.now()}`, 10);

    await admin.update({
      staffId: anonymizedStaffId,
      password: hashedDeletedPassword,
      // Keep cafeteriaId for audit purposes
    });
    console.log(`   ✅ Anonymized admin data`);

    // ====================================
    // ALTERNATIVELY: HARD DELETE
    // Uncomment if you want complete deletion
    // ====================================
    // await admin.destroy();
    // console.log(`   ✅ Admin record deleted`);

    console.log(`🗑️ [DELETE ADMIN ACCOUNT] Account deletion completed for admin ${adminId}`);

    return res.json({
      success: true,
      message: "Your admin account has been deleted successfully",
    });

  } catch (err) {
    console.error("❌ deleteAdminAccount error:", err);
    res.status(500).json({
      success: false,
      message: "Account deletion failed: " + err.message
    });
  }
};
