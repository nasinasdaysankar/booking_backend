import express from "express";
import {
  addMenuItem,
  addBulkMenuItems,
  getAllMenuItems,
  getBeveragesMenu,
  getMenuByCafeteria,
  updateSingleImage,
  updateMultipleImages,
  updateImageById,
  uploadBulkImages,
  updateMenuItem,
  getMostLovedItems,
  deleteMenuItem,
  getDeletedMenuItems,
  getTodaySpecials,
  restoreMenuItem,
  updateCategoryBulk,
  getPublicMenuByCafeteria,
  replaceMenuImage,
  validateCartItems, // ✅ Pre-payment cart validation
} from "../controllers/menuController.js";
import multer from "multer";
import { eitherAuth, eitherAdminAuth } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// 🔐 Admin/Superadmin only routes for menu modification
router.post("/add", eitherAdminAuth, addMenuItem);
router.post("/add/bulk", eitherAdminAuth, addBulkMenuItems);
router.put("/update-image/:id", eitherAdminAuth, updateSingleImage);
router.put("/update-images", eitherAdminAuth, updateMultipleImages);
router.put("/update-category", eitherAdminAuth, updateCategoryBulk);
router.put("/update-image-url", eitherAdminAuth, updateImageById);
router.post("/upload-bulk-images", eitherAdminAuth, upload.array("images"), uploadBulkImages);
router.put("/update/:id", eitherAdminAuth, updateMenuItem);
router.delete("/delete/:id", eitherAdminAuth, deleteMenuItem);
router.put("/restore/:id", eitherAdminAuth, restoreMenuItem);
router.get('/deleted', eitherAdminAuth, getDeletedMenuItems);

// 🔐 Authenticated user/delivery/admin routes for menu consumption
router.get("/", eitherAuth, getAllMenuItems);
router.get("/category/:category", eitherAuth, getBeveragesMenu);
router.get("/cafeteria/:id", eitherAuth, getMenuByCafeteria);
router.get("/most-loved", eitherAuth, getMostLovedItems);
router.get("/today-specials/:id", eitherAuth, getTodaySpecials);
router.post("/validate-cart", eitherAuth, validateCartItems);

// 🔓 Public read endpoint (keeps rate limiting from app.js)
router.get("/public/:cafeteriaId", getPublicMenuByCafeteria);

export default router;
