import express from "express";
import { submitAppFeedback, getAllAppFeedback } from "../controllers/appFeedbackController.js";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// User routes
router.post("/app", auth, submitAppFeedback);

// Superadmin routes
router.get("/all", auth, requireRole(["superadmin"]), getAllAppFeedback);

export default router;
