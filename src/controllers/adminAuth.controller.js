import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/index.js";

export const adminLogin = async (req, res) => {
  try {
    const { staffId, password } = req.body;

    console.log("🔐 [ADMIN LOGIN] Attempt started");
    console.log("   📋 Staff ID received:", staffId);
    console.log("   📋 Password received:", password ? "***hidden***" : "EMPTY");

    if (!staffId || !password) {
      console.log("❌ [ADMIN LOGIN] Missing credentials");
      return res.status(400).json({ message: "Missing credentials" });
    }

    const admin = await Admin.findOne({ where: { staffId } });

    if (!admin) {
      console.log("❌ [ADMIN LOGIN] Admin not found for Staff ID:", staffId);
      return res.status(401).json({ message: "Invalid Staff ID or Password" });
    }

    if (admin.is_active === false) {
      console.log("❌ [ADMIN LOGIN] Admin account is suspended:", staffId);
      return res.status(403).json({ message: "Account has been suspended. Please contact Superadmin." });
    }

    console.log("✅ [ADMIN LOGIN] Admin found:");
    console.log("   📋 Admin ID:", admin.id);
    console.log("   📋 Staff ID:", admin.staffId);
    console.log("   📋 Role:", admin.role);
    console.log("   📋 Cafeteria ID:", admin.cafeteriaId);
    console.log("   📋 Password hash starts with:", admin.password?.substring(0, 10));

    const isMatch = await bcrypt.compare(password, admin.password);
    console.log("🔍 [ADMIN LOGIN] Password comparison result:", isMatch);

    if (!isMatch) {
      console.log("❌ [ADMIN LOGIN] Password mismatch for Staff ID:", staffId);
      return res.status(401).json({ message: "Invalid Staff ID or Password" });
    }

    const accessToken = jwt.sign(
      {
        id: admin.id,
        role: admin.role,
        cafeteriaId: admin.cafeteriaId,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const refreshToken = jwt.sign(
      {
        id: admin.id,
        role: admin.role,
        cafeteriaId: admin.cafeteriaId,
      },
      process.env.JWT_REFRESH_SECRET || 'cafeteria-refresh-secret-key',
      { expiresIn: "7d" }
    );

    console.log("✅ [ADMIN LOGIN] Login successful for Staff ID:", staffId);

    return res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: admin.id,
        staffId: admin.staffId,
        cafeteriaId: admin.cafeteriaId,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("❌ [ADMIN LOGIN] ERROR:", err);
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

