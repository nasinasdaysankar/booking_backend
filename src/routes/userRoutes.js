import express from "express";
import { auth } from "../middleware/auth.js";
import {
  scanStaticCafeteriaQR,
  confirmOrderPickup,
} from "../controllers/userOrderController.js";
import { getUserStreak } from "../controllers/userStreakController.js";
import { updateProfile } from "../controllers/userProfileController.js";

const router = express.Router();

// QR
router.post("/orders/scan-qr", auth, scanStaticCafeteriaQR);
router.post("/orders/confirm-pickup", auth, confirmOrderPickup);

// 🔥 STREAK ROUTE (THIS IS THE KEY)
router.get("/streak/:cafeteriaId", auth, getUserStreak);

router.put(
  "/profile",
  auth,
  updateProfile
);

export default router;
