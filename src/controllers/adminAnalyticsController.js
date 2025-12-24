import { sequelize } from "../models/index.js"; // ✅ named export from models

export const getTrendData = async (req, res) => {
  try {
    const range = req.query.range || "daily";

    let groupBy;
    let dateFormat;

    if (range === "daily") {
      groupBy = `DATE("createdAt")`;
      dateFormat = "YYYY-MM-DD";
    } else if (range === "weekly") {
      groupBy = `DATE_TRUNC('week', "createdAt")`;
      dateFormat = "YYYY-MM-DD";
    } else {
      groupBy = `DATE_TRUNC('month', "createdAt")`;
      dateFormat = "YYYY-MM";
    }

    const [results] = await sequelize.query(`
      SELECT 
        TO_CHAR(${groupBy}, '${dateFormat}') AS date,
        SUM("totalAmount")::FLOAT AS revenue,
        COUNT(*)::INT AS orders
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY ${groupBy}
      ORDER BY ${groupBy}
    `);

    return res.status(200).json(results);
  } catch (error) {
    console.error("❌ Trend Error:", error);
    return res.status(500).json({ message: "Trend fetch failed" });
  }
};
