import { sequelize } from "../models/index.js";

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
