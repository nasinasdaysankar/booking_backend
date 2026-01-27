// import express from "express";
// import { auth } from "../middleware/auth.js";
// import {
//   scanStaticCafeteriaQR,
//   confirmOrderPickup,
// } from "../controllers/userOrderController.js";
// import { getUserStreak } from "../controllers/userStreakController.js";
// import { updateProfile } from "../controllers/userProfileController.js";
// import { getUserRefundHistory } from "../controllers/adminRefundController.js"; // 🔥 ADD THIS

// const router = express.Router();

// // QR
// router.post("/orders/scan-qr", auth, scanStaticCafeteriaQR);
// router.post("/orders/confirm-pickup", auth, confirmOrderPickup);

// // STREAK
// router.get("/streak/:cafeteriaId", auth, getUserStreak);

// // PROFILE
// router.put("/profile", auth, updateProfile);

// // ================================
// // 🔥 USER REFUND HISTORY
// // ================================
// router.get("/refunds/history", auth, getUserRefundHistory);

// export default router;
import express from "express";
import { auth } from "../middleware/auth.js";
import {
  scanStaticCafeteriaQR,
  confirmOrderPickup,
} from "../controllers/userOrderController.js";
import { getUserStreak } from "../controllers/userStreakController.js";
import {
  updateProfile,
  getProfile,
  deleteAccount  // ✅ ADD THIS
} from "../controllers/userProfileController.js";
import { getUserRefundHistory } from "../controllers/adminRefundController.js";

const router = express.Router();

// QR
router.post("/orders/scan-qr", auth, scanStaticCafeteriaQR);
router.post("/orders/confirm-pickup", auth, confirmOrderPickup);

// STREAK
router.get("/streak/:cafeteriaId", auth, getUserStreak);

// PROFILE
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);

// ============================================
// 🗑️ ACCOUNT DELETION (Required by App Store / Play Store)
// ============================================
router.delete("/delete-account", auth, deleteAccount);

// REFUND HISTORY
router.get("/refunds/history", auth, getUserRefundHistory);

export default router;