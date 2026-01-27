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
  restoreMenuItem,  // ✅ ADD THIS
  updateCategoryBulk,
  getPublicMenuByCafeteria,
} from "../controllers/menuController.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/add", addMenuItem);              
router.post("/add/bulk", addBulkMenuItems);    
 router.get("/", getAllMenuItems);
router.get("/category/:category", getBeveragesMenu);
// router.get("/cafeteria/:id", getMenuByCafeteria);
router.put("/update-image/:id", updateSingleImage);
router.put("/update-images", updateMultipleImages);
router.put("/update-category", updateCategoryBulk);
router.put("/update-image-url", updateImageById);
router.post("/upload-bulk-images", upload.array("images"), uploadBulkImages);
router.put("/update/:id", updateMenuItem);
router.get("/most-loved", getMostLovedItems);
router.delete("/delete/:id", deleteMenuItem);
router.put("/restore/:id", restoreMenuItem);    // ✅ ADD THIS - Restore deleted item
router.get('/deleted', getDeletedMenuItems);
router.get("/today-specials/:id", getTodaySpecials);
// 🚀 PUBLIC MENU (NO AUTH)
router.get("/public/:cafeteriaId", getPublicMenuByCafeteria);


export default router;





