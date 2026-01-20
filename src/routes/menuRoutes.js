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
import { auth, requireRole } from "../middleware/auth.js"; // ✅ Correct imports

const router = express.Router();

// ==================== PUBLIC ROUTES (No Auth Required) ====================

// 🔵 USER: Get public menu for specific cafeteria (no auth needed)
router.get("/public/:cafeteriaId", getPublicMenuByCafeteria);

// 🟡 Get today's specials for specific cafeteria (no auth needed)
router.get("/today-specials/:id", getTodaySpecials);

// 🟠 Get all menu items (generic) - no auth needed
router.get("/", getAllMenuItems);

// ==================== PROTECTED ROUTES (Auth Required) ====================

// 🟢 ADMIN: Get their own cafeteria menu (requires auth + admin role)
router.get("/my-menu", auth, requireRole(["admin"]), getMyMenu);

// 🟡 Get most loved items for specific cafeteria (requires auth)
router.get("/most-loved", auth, getMostLovedItems);

// 🟡 Search by category (requires auth)
router.get("/category/:category", auth, getBeveragesMenu);

// 🔴 LEGACY (keep for backwards compatibility - requires auth)
router.get("/cafeteria/:id", auth, getMenuByCafeteria);

// ==================== ADMIN WRITE ROUTES (Require Auth + Admin Role) ====================

// ✅ Add single item
router.post("/add", auth, requireRole(["admin"]), addMenuItem);

// ✅ Add bulk items
router.post("/add/bulk", auth, requireRole(["admin"]), addBulkMenuItems);

// ✅ Update item
router.put("/update/:id", auth, requireRole(["admin"]), updateMenuItem);

// ✅ Soft delete item
router.delete("/delete/:id", auth, requireRole(["admin"]), deleteMenuItem);

// ✅ Restore deleted item
router.put("/restore/:id", auth, requireRole(["admin"]), restoreMenuItem);

// ✅ Get deleted items (for admin to see what was deleted)
router.get("/deleted", auth, requireRole(["admin"]), getDeletedMenuItems);

export default router;