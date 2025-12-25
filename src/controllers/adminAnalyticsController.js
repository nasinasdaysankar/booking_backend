import { sequelize } from "../models/index.js";
import { QueryTypes } from "sequelize"; // ✅ ADD THIS


export const getTrendData = async (req, res) => {
  try {
    const range = req.query.range || "daily";
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Admin not linked to cafeteria" });
    }

    let dateExpr;

    if (range === "daily") {
      dateExpr = `DATE("createdAt")`;
    } else if (range === "weekly") {
      dateExpr = `DATE_TRUNC('week', "createdAt")`;
    } else {
      dateExpr = `DATE_TRUNC('month', "createdAt")`;
    }

    const [results] = await sequelize.query(
      `
      SELECT 
        ${dateExpr} AS date,
        SUM("totalAmount")::FLOAT AS revenue,
        COUNT(id)::INT AS orders
      FROM orders
      WHERE 
        "cafeteriaId" = :cafeteriaId
        AND "paymentStatus" = 'SUCCESS'
        AND "status" IN ('READY', 'PREPARING')
      GROUP BY date
      ORDER BY date ASC
      `,
      {
        replacements: { cafeteriaId }
      }
    );

    return res.json(results);
  } catch (err) {
    console.error("❌ Trend Error:", err.message);
    return res.status(500).json({
      message: "Trend fetch failed",
      error: err.message
    });
  }
};


export const getTopItems = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    const items = await sequelize.query(
      `
      SELECT 
        mi.name AS label,
        SUM(oi.quantity)::INT AS count
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      JOIN menu_items mi ON mi.id = oi."menuItemId"
      WHERE 
        o."cafeteriaId" = :cafeteriaId
        AND o."paymentStatus" = 'SUCCESS'
      GROUP BY mi.name
      ORDER BY count DESC
      LIMIT 6
      `,
      {
        replacements: { cafeteriaId },
        type: QueryTypes.SELECT,
      }
    );

    if (!items || items.length === 0) {
      return res.json([]);
    }

    const total = items.reduce((sum, i) => sum + i.count, 0);

    const response = items.map((i) => ({
      label: i.label,
      count: i.count,
      percentage: total > 0 ? Math.round((i.count / total) * 100) : 0,
    }));

    return res.json(response);
  } catch (err) {
    console.error("❌ Top items SQL error:", err.message);
    return res.status(500).json({
      message: "Failed to fetch top items",
      error: err.message,
    });
  }
};


export const getOrdersOverview = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { range = "weekly", from, to } = req.query;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    let groupExpr;
    let labelExpr;

    if (range === "daily") {
      groupExpr = `DATE("createdAt")`;
      labelExpr = `TO_CHAR("createdAt", 'DD Mon')`;
    } else if (range === "monthly") {
      groupExpr = `DATE_TRUNC('month', "createdAt")`;
      labelExpr = `TO_CHAR("createdAt", 'Mon YYYY')`;
    } else {
      // weekly (default)
      groupExpr = `DATE("createdAt")`;
      labelExpr = `TO_CHAR("createdAt", 'Dy')`;
    }

    const rows = await sequelize.query(
      `
      SELECT
        ${labelExpr} AS label,
        COUNT(*)::INT AS count
      FROM orders
      WHERE
        "cafeteriaId" = :cafeteriaId
        AND "paymentStatus" = 'SUCCESS'
        AND (
          (:from IS NULL OR "createdAt" >= :from)
          AND (:to IS NULL OR "createdAt" <= :to)
        )
      GROUP BY ${groupExpr}, label
      ORDER BY ${groupExpr}
      `,
      {
        replacements: {
          cafeteriaId,
          from: from ?? null,
          to: to ?? null,
        },
        type: QueryTypes.SELECT,
      }
    );

    return res.json(rows);
  } catch (err) {
    console.error("❌ Orders overview error:", err.message);
    return res.status(500).json({
      message: "Failed to fetch orders overview",
      error: err.message,
    });
  }
};