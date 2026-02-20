import express from "express";
import {
    getInventoryByCafeteria,
    getLowStockItems,
    updateStock,
    bulkRestock,
    getStockHistory,
    initializeInventory,
    bulkInitializeInventory,
    updateInventorySettings,
} from "../controllers/inventoryController.js";

const router = express.Router();

// Get all inventory for a cafeteria
router.get("/:cafeteriaId", getInventoryByCafeteria);

// Get low stock items
router.get("/low-stock/:cafeteriaId", getLowStockItems);

// Get stock change history for a menu item
router.get("/history/:menuItemId", getStockHistory);

// Initialize inventory for a single menu item
router.post("/initialize", initializeInventory);

// Bulk initialize inventory for all menu items in a cafeteria
router.post("/bulk-initialize/:cafeteriaId", bulkInitializeInventory);

// Update stock (restock / wastage / manual adjust)
router.put("/:menuItemId/stock", updateStock);

// Bulk restock
router.put("/bulk-restock", bulkRestock);

// Update inventory settings (threshold, unit, autoDisable)
router.put("/:menuItemId/settings", updateInventorySettings);

export default router;
