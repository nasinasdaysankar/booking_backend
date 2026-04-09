import express from "express";
import { auth, requireRole } from "../middleware/auth.js";
import {
  getProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  getArchivedProducts,
  restoreProduct,
  getProductBatches,
  addStock,
  previewUsage,
  recordUsage,
  getTransactions,
  getLowStockAlerts,
  updateBatch,
  getAllTransactions,
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

// ─── Archived / Restore ─────────────────────────────────────────
// GET  /api/inventory/archived                — list archived products
// PUT  /api/inventory/products/:id/restore    — restore archived product back to active
router.get("/archived", ...adminAuth, getArchivedProducts);
router.put("/products/:id/restore", ...adminAuth, restoreProduct);

// ─── Batches ────────────────────────────────────────────────
// GET  /api/inventory/products/:id/batches   — FIFO batch list
router.get("/products/:id/batches", ...adminAuth, getProductBatches);

// ─── Stock In ───────────────────────────────────────────────
// POST /api/inventory/products/:id/stock     — add stock (creates new batch)
// PUT  /api/inventory/products/:id/batches/:batchId — edit batch (quantity/unitCost) directly
router.post("/products/:id/stock", ...adminAuth, addStock);
router.put("/products/:id/batches/:batchId", ...adminAuth, updateBatch);

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

// ─── Overall Transactions ───────────────────────────────────
// GET  /api/inventory/transactions    — full log across all products
router.get("/transactions", ...adminAuth, getAllTransactions);

export default router;
