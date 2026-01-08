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
//   getMostLovedItems
// } from "../controllers/menuController.js";
// import { updateCategoryBulk } from "../controllers/menuController.js";
// import multer from "multer";



// const router = express.Router();
// const upload = multer({ dest: "uploads/" });


// router.post("/add", addMenuItem);              // Single add
// router.post("/add/bulk", addBulkMenuItems);    // Bulk Add (CATEGORY SUPPORTED) ✔
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




// export default router;


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
  deleteMenuItem
} from "../controllers/menuController.js";
import { updateCategoryBulk } from "../controllers/menuController.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });


router.post("/add", addMenuItem);              // Single add
router.post("/add/bulk", addBulkMenuItems);    // Bulk Add (CATEGORY SUPPORTED) ✔
router.get("/", getAllMenuItems);
router.get("/category/:category", getBeveragesMenu);
router.get("/cafeteria/:id", getMenuByCafeteria);
router.put("/update-image/:id", updateSingleImage);
router.put("/update-images", updateMultipleImages);
router.put("/update-category", updateCategoryBulk);
router.put("/update-image-url", updateImageById);
router.post("/upload-bulk-images", upload.array("images"), uploadBulkImages);
router.put("/update/:id", updateMenuItem);
router.get("/most-loved", getMostLovedItems);
router.delete("/delete/:id", deleteMenuItem);


export default router;
