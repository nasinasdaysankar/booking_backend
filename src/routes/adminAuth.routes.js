import express from "express";
import { adminLogin } from "../controllers/adminAuth.controller.js";
import { refreshToken } from "../controllers/refreshTokenController.js";

const router = express.Router();

// 🔐 ADMIN LOGIN ONLY
router.post("/login", adminLogin);
router.post("/refresh-token", refreshToken);

//edited code
export default router;
