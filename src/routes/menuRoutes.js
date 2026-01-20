// import express from "express";
// import {
//   addMenuItem,
//   addBulkMenuItems,
//   getAllMenuItems,
//   getBeveragesMenu,
//   getMenuByCafeteria,
//   updateSingleImage,
//   updateMultipleImages,
//   updateImageById,
//   uploadBulkImages,
//   updateMenuItem,
//   getMostLovedItems,
//   deleteMenuItem,
//   getDeletedMenuItems,
//   getTodaySpecials,
//   restoreMenuItem,  // ✅ ADD THIS
//   updateCategoryBulk,
// } from "../controllers/menuController.js";
// import multer from "multer";

// const router = express.Router();
// const upload = multer({ dest: "uploads/" });

// router.post("/add", addMenuItem);              
// router.post("/add/bulk", addBulkMenuItems);    
// router.get("/", getAllMenuItems);
// router.get("/category/:category", getBeveragesMenu);
// router.get("/cafeteria/:id", getMenuByCafeteria);
// router.put("/update-image/:id", updateSingleImage);
// router.put("/update-images", updateMultipleImages);
// router.put("/update-category", updateCategoryBulk);
// router.put("/update-image-url", updateImageById);
// router.post("/upload-bulk-images", upload.array("images"), uploadBulkImages);
// router.put("/update/:id", updateMenuItem);
// router.get("/most-loved", getMostLovedItems);
// router.delete("/delete/:id", deleteMenuItem);
// router.put("/restore/:id", restoreMenuItem);    // ✅ ADD THIS - Restore deleted item
// router.get('/deleted', getDeletedMenuItems);
// router.get("/today-specials/:id", getTodaySpecials);

// export default router;







import express from "express";
import {
  addMenuItem,
  addBulkMenuItems,
  getAllMenuItems,
  getBeveragesMenu,
  getMenuByCafeteria,
  getMyMenu,
  getPublicMenuByCafeteria,
  updateMenuItem,
  deleteMenuItem,
  restoreMenuItem,
  getDeletedMenuItems,
  getTodaySpecials,
  getMostLovedItems,
} from "../controllers/menuController.js";
import { authMiddleware, adminOnly } from "../middleware/auth.js"; // Your auth middleware
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ==================== PUBLIC ROUTES ====================

// 🟢 ADMIN: Get their own cafeteria menu (requires auth)
router.get("/my-menu", authMiddleware, adminOnly, getMyMenu);

// 🔵 USER: Get public menu for specific cafeteria (no auth needed)
router.get("/public/:cafeteriaId", getPublicMenuByCafeteria);

// 🟡 Get today's specials for specific cafeteria
router.get("/today-specials/:id", getTodaySpecials);

// 🟡 Get most loved items for specific cafeteria
router.get("/most-loved", getMostLovedItems);

// 🟡 Search by category
router.get("/category/:category", getBeveragesMenu);

// 🔴 LEGACY (keep for backwards compatibility)
router.get("/cafeteria/:id", getMenuByCafeteria);

// 🟠 Get all menu items (generic)
router.get("/", getAllMenuItems);

// ==================== ADMIN WRITE ROUTES (require auth) ====================

// Add single item
router.post("/add", authMiddleware, adminOnly, addMenuItem);

// Add bulk items
router.post("/add/bulk", authMiddleware, adminOnly, addBulkMenuItems);

// Update item
router.put("/update/:id", authMiddleware, adminOnly, updateMenuItem);

// Soft delete item
router.delete("/delete/:id", authMiddleware, adminOnly, deleteMenuItem);

// Restore deleted item
router.put("/restore/:id", authMiddleware, adminOnly, restoreMenuItem);

// Get deleted items (for admin to see what was deleted)
router.get("/deleted", authMiddleware, adminOnly, getDeletedMenuItems);

export default router;