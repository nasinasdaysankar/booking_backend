import { Inventory, InventoryLog, MenuItem, Cafeteria } from "../models/index.js";
import { Op } from "sequelize";

// ================= GET ALL INVENTORY FOR A CAFETERIA =================
export const getInventoryByCafeteria = async (req, res) => {
    try {
        const { cafeteriaId } = req.params;

        const inventory = await Inventory.findAll({
            where: { cafeteriaId },
            include: [
                {
                    model: MenuItem,
                    as: "menuItem",
                    attributes: ["id", "name", "price", "category", "imageUrl", "isAvailable", "isDeleted"],
                    where: { isDeleted: false },
                },
            ],
            order: [["currentStock", "ASC"]], // Low stock first
        });

        res.json({ success: true, data: inventory });
    } catch (err) {
        console.error("❌ getInventoryByCafeteria error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= GET LOW STOCK ITEMS =================
export const getLowStockItems = async (req, res) => {
    try {
        const { cafeteriaId } = req.params;

        const lowStock = await Inventory.findAll({
            where: {
                cafeteriaId,
                [Op.and]: [
                    {
                        currentStock: {
                            [Op.lte]: Inventory.sequelize.col("lowStockThreshold"),
                        },
                    },
                ],
            },
            include: [
                {
                    model: MenuItem,
                    as: "menuItem",
                    attributes: ["id", "name", "price", "category", "imageUrl", "isAvailable"],
                    where: { isDeleted: false },
                },
            ],
            order: [["currentStock", "ASC"]],
        });

        res.json({ success: true, data: lowStock });
    } catch (err) {
        console.error("❌ getLowStockItems error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= UPDATE STOCK (RESTOCK SINGLE ITEM) =================
export const updateStock = async (req, res) => {
    try {
        const { menuItemId } = req.params;
        const { quantity, reason, changeType } = req.body;
        // changeType: RESTOCK, MANUAL_ADJUST, WASTAGE

        const inventory = await Inventory.findOne({ where: { menuItemId } });

        if (!inventory) {
            return res.status(404).json({ success: false, message: "Inventory record not found" });
        }

        const previousStock = inventory.currentStock;
        const newStock = changeType === "WASTAGE"
            ? Math.max(0, previousStock - Math.abs(quantity))
            : previousStock + quantity;

        // Update inventory
        await inventory.update({
            currentStock: newStock,
            lastRestockedAt: changeType === "RESTOCK" ? new Date() : inventory.lastRestockedAt,
        });

        // Log the change
        await InventoryLog.create({
            menuItemId: parseInt(menuItemId),
            cafeteriaId: inventory.cafeteriaId,
            changeType: changeType || "RESTOCK",
            quantity: changeType === "WASTAGE" ? -Math.abs(quantity) : quantity,
            previousStock,
            newStock,
            reason: reason || null,
        });

        // Re-enable item if stock is now available and was auto-disabled
        if (newStock > 0 && inventory.autoDisable) {
            await MenuItem.update(
                { isAvailable: true },
                { where: { id: menuItemId } }
            );
        }

        // Auto-disable if stock is 0
        if (newStock <= 0 && inventory.autoDisable) {
            await MenuItem.update(
                { isAvailable: false },
                { where: { id: menuItemId } }
            );
        }

        res.json({
            success: true,
            message: "Stock updated successfully",
            data: {
                menuItemId: parseInt(menuItemId),
                previousStock,
                newStock,
                changeType: changeType || "RESTOCK",
            },
        });
    } catch (err) {
        console.error("❌ updateStock error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= BULK RESTOCK =================
export const bulkRestock = async (req, res) => {
    try {
        const { items } = req.body;
        // items: [{ menuItemId, quantity, reason }]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Items array is required" });
        }

        const results = [];

        for (const item of items) {
            const inventory = await Inventory.findOne({
                where: { menuItemId: item.menuItemId },
            });

            if (!inventory) {
                results.push({ menuItemId: item.menuItemId, success: false, message: "Not found" });
                continue;
            }

            const previousStock = inventory.currentStock;
            const newStock = previousStock + item.quantity;

            await inventory.update({
                currentStock: newStock,
                lastRestockedAt: new Date(),
            });

            await InventoryLog.create({
                menuItemId: item.menuItemId,
                cafeteriaId: inventory.cafeteriaId,
                changeType: "RESTOCK",
                quantity: item.quantity,
                previousStock,
                newStock,
                reason: item.reason || "Bulk restock",
            });

            // Re-enable item if needed
            if (newStock > 0 && inventory.autoDisable) {
                await MenuItem.update(
                    { isAvailable: true },
                    { where: { id: item.menuItemId } }
                );
            }

            results.push({
                menuItemId: item.menuItemId,
                success: true,
                previousStock,
                newStock,
            });
        }

        res.json({ success: true, message: "Bulk restock completed", data: results });
    } catch (err) {
        console.error("❌ bulkRestock error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= GET STOCK HISTORY =================
export const getStockHistory = async (req, res) => {
    try {
        const { menuItemId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const logs = await InventoryLog.findAndCountAll({
            where: { menuItemId },
            order: [["createdAt", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({
            success: true,
            data: logs.rows,
            total: logs.count,
        });
    } catch (err) {
        console.error("❌ getStockHistory error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= INITIALIZE INVENTORY FOR MENU ITEM =================
export const initializeInventory = async (req, res) => {
    try {
        const { menuItemId, cafeteriaId, currentStock, lowStockThreshold, unit, autoDisable } = req.body;

        // Check if inventory already exists
        const existing = await Inventory.findOne({ where: { menuItemId } });
        if (existing) {
            return res.status(400).json({ success: false, message: "Inventory already exists for this item" });
        }

        const inventory = await Inventory.create({
            menuItemId,
            cafeteriaId,
            currentStock: currentStock || 0,
            lowStockThreshold: lowStockThreshold || 5,
            unit: unit || "plates",
            autoDisable: autoDisable !== undefined ? autoDisable : true,
            lastRestockedAt: currentStock > 0 ? new Date() : null,
        });

        // Log initial stock
        if (currentStock > 0) {
            await InventoryLog.create({
                menuItemId,
                cafeteriaId,
                changeType: "RESTOCK",
                quantity: currentStock,
                previousStock: 0,
                newStock: currentStock,
                reason: "Initial stock setup",
            });
        }

        res.status(201).json({ success: true, data: inventory });
    } catch (err) {
        console.error("❌ initializeInventory error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= BULK INITIALIZE INVENTORY =================
export const bulkInitializeInventory = async (req, res) => {
    try {
        const { cafeteriaId } = req.params;

        // Find all menu items without inventory for this cafeteria
        const menuItems = await MenuItem.findAll({
            where: { cafeteriaId, isDeleted: false },
            include: [
                {
                    model: Inventory,
                    as: "inventory",
                    required: false,
                },
            ],
        });

        const itemsWithoutInventory = menuItems.filter((item) => !item.inventory);

        if (itemsWithoutInventory.length === 0) {
            return res.json({ success: true, message: "All items already have inventory", created: 0 });
        }

        const inventoryRecords = itemsWithoutInventory.map((item) => ({
            menuItemId: item.id,
            cafeteriaId,
            currentStock: 0,
            lowStockThreshold: 5,
            unit: "plates",
            autoDisable: true,
        }));

        await Inventory.bulkCreate(inventoryRecords);

        res.json({
            success: true,
            message: `Initialized inventory for ${itemsWithoutInventory.length} items`,
            created: itemsWithoutInventory.length,
        });
    } catch (err) {
        console.error("❌ bulkInitializeInventory error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ================= UPDATE INVENTORY SETTINGS =================
export const updateInventorySettings = async (req, res) => {
    try {
        const { menuItemId } = req.params;
        const { lowStockThreshold, unit, autoDisable } = req.body;

        const inventory = await Inventory.findOne({ where: { menuItemId } });
        if (!inventory) {
            return res.status(404).json({ success: false, message: "Inventory not found" });
        }

        const updates = {};
        if (lowStockThreshold !== undefined) updates.lowStockThreshold = lowStockThreshold;
        if (unit !== undefined) updates.unit = unit;
        if (autoDisable !== undefined) updates.autoDisable = autoDisable;

        await inventory.update(updates);

        res.json({ success: true, message: "Settings updated", data: inventory });
    } catch (err) {
        console.error("❌ updateInventorySettings error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
