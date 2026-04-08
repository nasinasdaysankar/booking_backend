/**
 * 📦 Inventory Controller
 * Handles raw materials inventory (Sugar, Oil, Flour...) — separate from menu items.
 */

import { InventoryProduct, InventoryBatch, InventoryTransaction, sequelize } from "../models/index.js";
import { Op } from "sequelize";
import {
  addInventory,
  consumeInventory,
  previewConsumption,
  getTotalStock,
} from "../utils/inventoryService.js";

// ─────────────────────────────────────────
// GET ALL PRODUCTS
// ─────────────────────────────────────────
export const getProducts = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { includeInactive } = req.query;

    const whereClause = { cafeteriaId };
    if (!includeInactive) whereClause.isActive = true;

    const products = await InventoryProduct.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    // Attach total stock to each product
    const productsWithStock = await Promise.all(
      products.map(async (p) => {
        const totalStock = await getTotalStock(p.id);
        const isLowStock =
          p.lowStockThreshold > 0 && totalStock <= p.lowStockThreshold;
        return {
          ...p.toJSON(),
          totalStock,
          isLowStock,
        };
      })
    );

    return res.json({ success: true, data: productsWithStock });
  } catch (err) {
    console.error("❌ getProducts error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// CREATE PRODUCT
// ─────────────────────────────────────────
export const createProduct = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { name, unit, category, lowStockThreshold } = req.body;

    if (!name || !unit) {
      return res.status(400).json({ success: false, message: "Name and unit are required" });
    }

    // Check duplicate name for this cafeteria
    const existing = await InventoryProduct.findOne({
      where: { cafeteriaId, name: { [Op.iLike]: name.trim() }, isActive: true },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: `Product "${name}" already exists` });
    }

    const product = await InventoryProduct.create({
      cafeteriaId,
      name: name.trim(),
      unit,
      category: category?.trim() || null,
      lowStockThreshold: parseFloat(lowStockThreshold) || 0,
    });

    return res.status(201).json({ success: true, data: { ...product.toJSON(), totalStock: 0, isLowStock: false } });
  } catch (err) {
    console.error("❌ createProduct error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// UPDATE PRODUCT
// ─────────────────────────────────────────
export const updateProduct = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;
    const { name, unit, category, lowStockThreshold } = req.body;

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (name) product.name = name.trim();
    if (unit) product.unit = unit;
    if (category !== undefined) product.category = category?.trim() || null;
    if (lowStockThreshold !== undefined) product.lowStockThreshold = parseFloat(lowStockThreshold) || 0;

    await product.save();
    return res.json({ success: true, data: product });
  } catch (err) {
    console.error("❌ updateProduct error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// ARCHIVE (SOFT DELETE) PRODUCT
// ─────────────────────────────────────────
export const archiveProduct = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    product.isActive = false;
    await product.save();

    return res.json({ success: true, message: `"${product.name}" archived successfully` });
  } catch (err) {
    console.error("❌ archiveProduct error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET ARCHIVED PRODUCTS
// ─────────────────────────────────────────
export const getArchivedProducts = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;

    const products = await InventoryProduct.findAll({
      where: { cafeteriaId, isActive: false },
      order: [["updated_at", "DESC"]], // Most recently archived first
    });

    const productsWithStock = await Promise.all(
      products.map(async (p) => {
        const totalStock = await getTotalStock(p.id);
        return { ...p.toJSON(), totalStock };
      })
    );

    return res.json({ success: true, count: productsWithStock.length, data: productsWithStock });
  } catch (err) {
    console.error("❌ getArchivedProducts error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// RESTORE ARCHIVED PRODUCT
// ─────────────────────────────────────────
export const restoreProduct = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId, isActive: false } });
    if (!product) {
      return res.status(404).json({ success: false, message: "Archived product not found" });
    }

    product.isActive = true;
    await product.save();

    return res.json({
      success: true,
      message: `"${product.name}" restored to active inventory`,
      data: product,
    });
  } catch (err) {
    console.error("❌ restoreProduct error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



// ─────────────────────────────────────────
// GET BATCHES FOR A PRODUCT (FIFO ordered)
// ─────────────────────────────────────────
export const getProductBatches = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const batches = await InventoryBatch.findAll({
      where: { productId: id },
      order: [["created_at", "ASC"]], // Oldest first = FIFO order
    });

    const totalStock = await getTotalStock(id);

    const batchData = batches.map((b) => ({
      ...b.toJSON(),
      totalValue: parseFloat((Number(b.quantityRemaining) * Number(b.unitCost)).toFixed(2)),
      isDepleted: Number(b.quantityRemaining) === 0,
    }));

    return res.json({
      success: true,
      product: { ...product.toJSON(), totalStock },
      data: batchData,
    });
  } catch (err) {
    console.error("❌ getProductBatches error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// ADD STOCK  —  Creates a new batch (IN)
// ─────────────────────────────────────────
export const addStock = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;
    const { quantity, unitCost, note } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const { batch, totalStock } = await addInventory(
      parseInt(id),
      parseFloat(quantity),
      parseFloat(unitCost) || 0,
      note || null
    );

    const isLowStock = product.lowStockThreshold > 0 && totalStock <= product.lowStockThreshold;

    return res.status(201).json({
      success: true,
      message: `Added ${quantity} ${product.unit} of ${product.name}`,
      data: { batch, totalStock, isLowStock },
    });
  } catch (err) {
    console.error("❌ addStock error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// PREVIEW CONSUMPTION  —  Dry-run FIFO
// ─────────────────────────────────────────
export const previewUsage = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const preview = await previewConsumption(parseInt(id), parseFloat(quantity));

    return res.json({
      success: true,
      product: { id: product.id, name: product.name, unit: product.unit },
      preview,
    });
  } catch (err) {
    console.error("❌ previewUsage error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// RECORD USAGE  —  FIFO consumption (OUT)
// ─────────────────────────────────────────
export const recordUsage = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;
    const { quantity, note } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const result = await consumeInventory(
      parseInt(id),
      parseFloat(quantity),
      note || null
    );

    const isLowStock =
      product.lowStockThreshold > 0 && result.remainingStock <= product.lowStockThreshold;

    return res.json({
      success: true,
      message: `Used ${quantity} ${product.unit} of ${product.name}. COGS: ₹${result.totalCogs}`,
      data: {
        ...result,
        isLowStock,
        product: { id: product.id, name: product.name, unit: product.unit },
      },
    });
  } catch (err) {
    console.error("❌ recordUsage error:", err);
    if (err.message.includes("Insufficient stock")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// GET TRANSACTION HISTORY
// ─────────────────────────────────────────
export const getTransactions = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;
    const { type, limit = 100, offset = 0, from, to } = req.query;

    const product = await InventoryProduct.findOne({ where: { id, cafeteriaId } });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const where = { productId: id };
    if (type && ["IN", "OUT"].includes(type.toUpperCase())) {
      where.type = type.toUpperCase();
    }
    if (from) where.createdAt = { ...where.createdAt, [Op.gte]: new Date(from) };
    if (to) where.createdAt = { ...where.createdAt, [Op.lte]: new Date(to) };

    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Running totals for summary
    const allTx = await InventoryTransaction.findAll({ where: { productId: id } });
    const totalIn = allTx
      .filter((t) => t.type === "IN")
      .reduce((s, t) => s + Number(t.quantity), 0);
    const totalOut = allTx
      .filter((t) => t.type === "OUT")
      .reduce((s, t) => s + Number(t.quantity), 0);
    const totalCogsSpent = allTx
      .filter((t) => t.type === "OUT")
      .reduce((s, t) => s + Number(t.totalCost || 0), 0);
    const totalInvestment = allTx
      .filter((t) => t.type === "IN")
      .reduce((s, t) => s + Number(t.totalCost || 0), 0);

    return res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        unit: product.unit,
        totalStock: await getTotalStock(id),
      },
      summary: {
        totalIn: parseFloat(totalIn.toFixed(3)),
        totalOut: parseFloat(totalOut.toFixed(3)),
        totalCogsSpent: parseFloat(totalCogsSpent.toFixed(2)),
        totalInvestment: parseFloat(totalInvestment.toFixed(2)),
      },
      count,
      data: rows,
    });
  } catch (err) {
    console.error("❌ getTransactions error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────
// LOW STOCK ALERTS  —  All low items
// ─────────────────────────────────────────
export const getLowStockAlerts = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;

    const products = await InventoryProduct.findAll({
      where: { cafeteriaId, isActive: true, lowStockThreshold: { [Op.gt]: 0 } },
    });

    const lowStockItems = [];
    for (const p of products) {
      const totalStock = await getTotalStock(p.id);
      if (totalStock <= Number(p.lowStockThreshold)) {
        lowStockItems.push({
          id: p.id,
          name: p.name,
          unit: p.unit,
          totalStock,
          lowStockThreshold: Number(p.lowStockThreshold),
          shortage: parseFloat((Number(p.lowStockThreshold) - totalStock).toFixed(3)),
        });
      }
    }

    return res.json({ success: true, count: lowStockItems.length, data: lowStockItems });
  } catch (err) {
    console.error("❌ getLowStockAlerts error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
