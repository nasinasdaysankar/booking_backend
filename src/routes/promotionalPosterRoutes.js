import express from "express";
import multer from "multer";
import {
  uploadPoster,
  getAllPosters,
  getActivePosters,
  deletePoster,
  togglePosterStatus,
} from "../controllers/promotionalPosterController.js";
import { superadminAuth, auth } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public Route
router.get("/active", getActivePosters);

// Super Admin Routes
router.get("/", superadminAuth, getAllPosters);
router.post("/upload", superadminAuth, upload.single("image"), uploadPoster);
router.delete("/:id", superadminAuth, deletePoster);
router.patch("/:id/toggle", superadminAuth, togglePosterStatus);

export default router;
