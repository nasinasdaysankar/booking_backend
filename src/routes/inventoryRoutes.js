import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import {
  getProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  getProductBatches,
  addStock,
  previewUsage,
  recordUsage,
  getTransactions,
  getLowStockAlerts,
} from "../controllers/inventoryController.js";

const router = express.Router();

// All routes require admin auth
const adminAuth = [auth, requireRole(["admin"])];

// ─── Products ───────────────────────────────────────────────
// GET  /api/inventory/products               — list all products
// POST /api/inventory/products               — create product
// PUT  /api/inventory/products/:id           — update product
// DEL  /api/inventory/products/:id           — soft-archive product
router.get("/products", ...adminAuth, getProducts);
router.post("/products", ...adminAuth, createProduct);
router.put("/products/:id", ...adminAuth, updateProduct);
router.delete("/products/:id", ...adminAuth, archiveProduct);

// ─── Batches ────────────────────────────────────────────────
// GET  /api/inventory/products/:id/batches   — FIFO batch list
router.get("/products/:id/batches", ...adminAuth, getProductBatches);

// ─── Stock In ───────────────────────────────────────────────
// POST /api/inventory/products/:id/stock     — add stock (creates new batch)
router.post("/products/:id/stock", ...adminAuth, addStock);

// ─── Consumption ────────────────────────────────────────────
// POST /api/inventory/products/:id/preview   — dry-run COGS preview
// POST /api/inventory/products/:id/consume   — FIFO deduction
router.post("/products/:id/preview", ...adminAuth, previewUsage);
router.post("/products/:id/consume", ...adminAuth, recordUsage);

// ─── Transaction History ────────────────────────────────────
// GET  /api/inventory/products/:id/transactions  — full log with summary
//   Query: ?type=IN|OUT  ?limit=100 ?offset=0 ?from=ISO ?to=ISO
router.get("/products/:id/transactions", ...adminAuth, getTransactions);

// ─── Low Stock Alerts ───────────────────────────────────────
// GET  /api/inventory/low-stock              — all items below threshold
router.get("/low-stock", ...adminAuth, getLowStockAlerts);

export default router;
