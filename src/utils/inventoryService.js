/**
 * 📦 FIFO Inventory Service
 * Raw materials management (Sugar, Oil, Flour, etc.)
 * Implements First-In-First-Out batch consumption logic.
 */

import { InventoryBatch, InventoryTransaction, InventoryProduct, sequelize } from "../models/index.js";
import { Op } from "sequelize";

// ─────────────────────────────────────────────────────────
// ADD INVENTORY  —  Creates a new stock batch (IN)
// ─────────────────────────────────────────────────────────
/**
 * @param {number} productId
 * @param {number} quantity
 * @param {number} unitCost   - cost per unit (₹)
 * @param {string} note       - optional admin note
 * @param {object} t          - Sequelize transaction (optional)
 * @returns {object} { batch, totalStock }
 */
export async function addInventory(productId, quantity, unitCost, note = null, t = null) {
  const opts = t ? { transaction: t } : {};

  // 1. Create new FIFO batch
  const batch = await InventoryBatch.create(
    {
      productId,
      quantityRemaining: quantity,
      unitCost: unitCost || 0,
    },
    opts
  );

  // 2. Log IN transaction
  await InventoryTransaction.create(
    {
      productId,
      quantity,
      type: "IN",
      unitCost: unitCost || 0,
      totalCost: quantity * (unitCost || 0),
      note,
      batchId: batch.id,
    },
    opts
  );

  // 3. Compute updated total stock
  const totalStock = await getTotalStock(productId, t);

  return { batch, totalStock };
}

// ─────────────────────────────────────────────────────────
// CONSUME INVENTORY  —  FIFO deduction (OUT)
// ─────────────────────────────────────────────────────────
/**
 * Deducts quantity from batches oldest-first.
 * @returns {object} { totalCogs, consumedBatches, remainingStock }
 * @throws Error if insufficient stock
 */
export async function consumeInventory(productId, quantity, note = null, t = null) {
  const opts = t ? { transaction: t, lock: true } : { transaction: await sequelize.transaction(), lock: true };
  const internalTx = !t;
  const usedTx = opts.transaction;

  try {
    // Fetch batches FIFO order (oldest first), with row-level lock
    const batches = await InventoryBatch.findAll({
      where: {
        productId,
        quantityRemaining: { [Op.gt]: 0 },
      },
      order: [["created_at", "ASC"]],
      transaction: usedTx,
      lock: usedTx.LOCK?.UPDATE ?? true,
    });

    // Check sufficiency
    const available = batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    if (available < quantity) {
      throw new Error(
        `Insufficient stock. Requested: ${quantity}, Available: ${parseFloat(available.toFixed(3))}`
      );
    }

    // FIFO deduction loop
    let remaining = quantity;
    let totalCogs = 0;
    const consumedBatches = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const batchQty = Number(batch.quantityRemaining);
      const consume = Math.min(batchQty, remaining);
      const cost = consume * Number(batch.unitCost);

      totalCogs += cost;
      remaining -= consume;

      consumedBatches.push({
        batchId: batch.id,
        consumed: parseFloat(consume.toFixed(3)),
        unitCost: Number(batch.unitCost),
        cost: parseFloat(cost.toFixed(2)),
        batchCreatedAt: batch.createdAt,
      });

      // Update batch
      batch.quantityRemaining = parseFloat((batchQty - consume).toFixed(3));
      await batch.save({ transaction: usedTx });
    }

    // Log OUT transaction
    await InventoryTransaction.create(
      {
        productId,
        quantity,
        type: "OUT",
        unitCost: null, // FIFO uses weighted cost across batches
        totalCost: parseFloat(totalCogs.toFixed(2)),
        note,
        batchId: null,
      },
      { transaction: usedTx }
    );

    const remainingStock = await getTotalStock(productId, usedTx);

    if (internalTx) await usedTx.commit();

    return {
      totalCogs: parseFloat(totalCogs.toFixed(2)),
      consumedBatches,
      remainingStock,
    };
  } catch (err) {
    if (internalTx) await usedTx.rollback();
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// PREVIEW CONSUMPTION  —  Dry-run, no DB writes
// ─────────────────────────────────────────────────────────
/**
 * Shows which batches would be consumed and the total COGS.
 * Does NOT modify any rows.
 */
export async function previewConsumption(productId, quantity) {
  const batches = await InventoryBatch.findAll({
    where: {
      productId,
      quantityRemaining: { [Op.gt]: 0 },
    },
    order: [["created_at", "ASC"]],
  });

  const available = batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
  const sufficient = available >= quantity;

  let remaining = quantity;
  let totalCogs = 0;
  const consumedBatches = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    const batchQty = Number(batch.quantityRemaining);
    const consume = Math.min(batchQty, remaining);
    const cost = consume * Number(batch.unitCost);

    totalCogs += cost;
    remaining -= consume;

    consumedBatches.push({
      batchId: batch.id,
      available: parseFloat(batchQty.toFixed(3)),
      consumed: parseFloat(consume.toFixed(3)),
      unitCost: Number(batch.unitCost),
      cost: parseFloat(cost.toFixed(2)),
      batchCreatedAt: batch.createdAt,
    });
  }

  return {
    sufficient,
    available: parseFloat(available.toFixed(3)),
    requested: quantity,
    totalCogs: parseFloat(totalCogs.toFixed(2)),
    consumedBatches,
  };
}

// ─────────────────────────────────────────────────────────
// GET TOTAL STOCK  —  Sum of remaining batch quantities
// ─────────────────────────────────────────────────────────
export async function getTotalStock(productId, t = null) {
  const opts = t ? { transaction: t } : {};
  const result = await InventoryBatch.findOne({
    where: { productId },
    attributes: [
      [sequelize.fn("COALESCE", sequelize.fn("SUM", sequelize.col("quantity_remaining")), 0), "total"],
    ],
    ...opts,
  });
  return parseFloat(Number(result?.dataValues?.total ?? 0).toFixed(3));
}
