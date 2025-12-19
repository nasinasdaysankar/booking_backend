import express from "express";
import { confirmPayment } from "../controllers/paymentController.js";
import { auth } from "../middleware/auth.js"; // ⬅️ Add this import

const router = express.Router();

// 🔥 FIXED: Added 'auth' middleware here
// This populates req.user so confirmPayment can read req.user.id
router.post("/confirm", auth, confirmPayment);

export default router;