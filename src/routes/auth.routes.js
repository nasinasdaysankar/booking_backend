import express from "express";
import { register, login } from "../controllers/authController.js";

const router = express.Router();

// 🔥 THESE TWO ROUTES ARE REQUIRED
router.post("/register", register);
router.post("/login", login);

export default router;
