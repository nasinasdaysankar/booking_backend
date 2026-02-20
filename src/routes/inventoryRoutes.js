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
    getIngredients,
    addIngredient,
    updateIngredient,
    deleteIngredient,
} from "../controllers/inventoryController.js";

const router = express.Router();

// ================= 🧪 INGREDIENT ROUTES (must be before /:cafeteriaId catch-all) =================

// Get all ingredients for a menu item
router.get("/ingredients/:menuItemId", getIngredients);

// Add an ingredient to a menu item
router.post("/ingredients/:menuItemId", addIngredient);

// Update an ingredient
router.put("/ingredients/item/:id", updateIngredient);

// Delete an ingredient
router.delete("/ingredients/item/:id", deleteIngredient);

// ================= INVENTORY ROUTES =================

// Get low stock items
router.get("/low-stock/:cafeteriaId", getLowStockItems);

// Get stock change history for a menu item
router.get("/history/:menuItemId", getStockHistory);

// Initialize inventory for a single menu item
router.post("/initialize", initializeInventory);

// Bulk initialize inventory for all menu items in a cafeteria
router.post("/bulk-initialize/:cafeteriaId", bulkInitializeInventory);

// Bulk restock
router.put("/bulk-restock", bulkRestock);

// Update stock (restock / wastage / manual adjust)
router.put("/:menuItemId/stock", updateStock);

// Update inventory settings (threshold, unit, autoDisable)
router.put("/:menuItemId/settings", updateInventorySettings);

// Get all inventory for a cafeteria (MUST be last — catch-all)
router.get("/:cafeteriaId", getInventoryByCafeteria);

export default router;
