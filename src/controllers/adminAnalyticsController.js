// import { sequelize } from "../models/index.js";
// import { QueryTypes } from "sequelize"; // ✅ ADD THIS


// export const getTrendData = async (req, res) => {
//   try {
//     const { range = "daily", from, to } = req.query;
//     const cafeteriaId = req.user.cafeteriaId;

//     if (!cafeteriaId) {
//       return res.status(400).json({ message: "Admin not linked to cafeteria" });
//     }

//     let dateExpr;
//     let whereDate = "";

//     if (range === "daily") {
//       dateExpr = `DATE("createdAt")`;
//     } 
//     else if (range === "weekly") {
//       dateExpr = `DATE_TRUNC('week', "createdAt")`;
//     } 
//     else if (range === "monthly") {
//       dateExpr = `DATE_TRUNC('month', "createdAt")`;
//     } 
//     else if (range === "custom") {
//       dateExpr = `DATE("createdAt")`;
//       whereDate = `
//         AND (
//           (:from IS NULL OR "createdAt" >= :from)
//           AND (:to IS NULL OR "createdAt" <= :to)
//         )
//       `;
//     } 
//     else {
//       dateExpr = `DATE("createdAt")`;
//     }

//     const rows = await sequelize.query(
//       `
//       SELECT 
//         ${dateExpr} AS date,
//         SUM("totalAmount")::FLOAT AS revenue,
//         COUNT(id)::INT AS orders
//       FROM orders
//       WHERE 
//         "cafeteriaId" = :cafeteriaId
//         AND "paymentStatus" = 'SUCCESS'
//         ${whereDate}
//       GROUP BY date
//       ORDER BY date ASC
//       `,
//       {
//         replacements: {
//           cafeteriaId,
//           from: from ?? null,
//           to: to ?? null,
//         },
//         type: QueryTypes.SELECT,
//       }
//     );

//     return res.json(rows);
//   } catch (err) {
//     console.error("❌ Trend Error:", err.message);
//     return res.status(500).json({
//       message: "Trend fetch failed",
//       error: err.message,
//     });
//   }
// };


// export const getTopItems = async (req, res) => {
//   try {
//     const cafeteriaId = req.user.cafeteriaId;
//     const { from, to } = req.query;

//     if (!cafeteriaId) {
//       return res.status(400).json({ message: "Cafeteria not linked" });
//     }

//     const items = await sequelize.query(
//       `
//       SELECT 
//         mi.name AS label,
//         SUM(oi.quantity)::INT AS count
//       FROM order_items oi
//       JOIN orders o ON o.id = oi."orderId"
//       JOIN menu_items mi ON mi.id = oi."menuItemId"
//       WHERE 
//         o."cafeteriaId" = :cafeteriaId
//         AND o."paymentStatus" = 'SUCCESS'
//         AND (
//           (:from IS NULL OR o."createdAt" >= :from)
//           AND (:to IS NULL OR o."createdAt" <= :to)
//         )
//       GROUP BY mi.name
//       ORDER BY count DESC
//       LIMIT 6
//       `,
//       {
//         replacements: { cafeteriaId, from: from ?? null, to: to ?? null },
//         type: QueryTypes.SELECT,
//       }
//     );

//     const total = items.reduce((s, i) => s + i.count, 0);

//     return res.json(
//       items.map((i) => ({
//         label: i.label,
//         count: i.count,
//         percentage: total ? Math.round((i.count / total) * 100) : 0,
//       }))
//     );
//   } catch (err) {
//     return res.status(500).json({ message: "Failed to fetch top items" });
//   }
// };



// export const getOrdersOverview = async (req, res) => {
//   try {
//     const cafeteriaId = req.user.cafeteriaId;
//     const { range = "weekly", from, to } = req.query;

//     if (!cafeteriaId) {
//       return res.status(400).json({ message: "Cafeteria not linked" });
//     }

//     let groupExpr;
//     let labelExpr;

//     if (range === "daily") {
//       groupExpr = `DATE("createdAt")`;
//       labelExpr = `TO_CHAR("createdAt", 'DD Mon')`;
//     } else if (range === "monthly") {
//       groupExpr = `DATE_TRUNC('month', "createdAt")`;
//       labelExpr = `TO_CHAR("createdAt", 'Mon YYYY')`;
//     } else {
//       // weekly (default)
//       groupExpr = `DATE("createdAt")`;
//       labelExpr = `TO_CHAR("createdAt", 'Dy')`;
//     }

//     const rows = await sequelize.query(
//       `
//       SELECT
//         ${labelExpr} AS label,
//         COUNT(*)::INT AS count
//       FROM orders
//       WHERE
//         "cafeteriaId" = :cafeteriaId
//         AND "paymentStatus" = 'SUCCESS'
//         AND (
//           (:from IS NULL OR "createdAt" >= :from)
//           AND (:to IS NULL OR "createdAt" <= :to)
//         )
//       GROUP BY ${groupExpr}, label
//       ORDER BY ${groupExpr}
//       `,
//       {
//         replacements: {
//           cafeteriaId,
//           from: from ?? null,
//           to: to ?? null,
//         },
//         type: QueryTypes.SELECT,
//       }
//     );

//     return res.json(rows);
//   } catch (err) {
//     console.error("❌ Orders overview error:", err.message);
//     return res.status(500).json({
//       message: "Failed to fetch orders overview",
//       error: err.message,
//     });
//   }
// };

// // ================= PEAK HOURS ANALYTICS =================
// export const getPeakHours = async (req, res) => {
//   try {
//     const { range = "daily", from, to } = req.query;
//     const cafeteriaId = req.user.cafeteriaId;

//     if (!cafeteriaId) {
//       return res.status(400).json({ message: "Cafeteria not linked" });
//     }

//     let whereDate = "";

//     // 🔥 DAILY → only today
//     if (range === "daily") {
//       whereDate = `
//         AND "createdAt"::date = CURRENT_DATE
//       `;
//     }

//     // 🔥 WEEKLY → last 7 days
//     else if (range === "weekly") {
//       whereDate = `
//         AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days'
//       `;
//     }

//     // 🔥 MONTHLY → current month
//     else if (range === "monthly") {
//       whereDate = `
//         AND DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)
//       `;
//     }

//     // 🔥 CUSTOM (calendar)
//     else if (range === "custom") {
//       whereDate = `
//         AND (
//           (:from IS NULL OR "createdAt" >= :from)
//           AND (:to IS NULL OR "createdAt" <= :to)
//         )
//       `;
//     }

//     const rows = await sequelize.query(
//       `
//       SELECT
//         EXTRACT(HOUR FROM "createdAt")::INT AS hour,
//         COUNT(*)::INT AS orders
//       FROM orders
//       WHERE
//         "cafeteriaId" = :cafeteriaId
//         AND "paymentStatus" = 'SUCCESS'
//         ${whereDate}
//       GROUP BY hour
//       ORDER BY hour ASC
//       `,
//       {
//         replacements: {
//           cafeteriaId,
//           from: from ?? null,
//           to: to ?? null,
//         },
//         type: QueryTypes.SELECT,
//       }
//     );

//     return res.json(rows);
//   } catch (err) {
//     console.error("❌ Peak Hours Error:", err.message);
//     return res.status(500).json({
//       message: "Failed to fetch peak hours",
//       error: err.message,
//     });
//   }
// };



import { sequelize } from "../models/index.js";
import { QueryTypes } from "sequelize";

export const getTrendData = async (req, res) => {
  try {
    const { range = "daily", from, to } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Admin not linked to cafeteria" });
    }

    let dateExpr;
    let whereDate = "";
    let groupByExpr;
    let orderByExpr;

    // 🔴 DAILY → Hourly breakdown (0-23)
    if (range === "daily") {
      dateExpr = `EXTRACT(HOUR FROM "createdAt")::INT`;
      groupByExpr = `EXTRACT(HOUR FROM "createdAt")::INT`;
      orderByExpr = `EXTRACT(HOUR FROM "createdAt")::INT`;
      whereDate = `AND "createdAt"::date = CURRENT_DATE`;
    } 
    // 🟡 WEEKLY → Date-wise (last 7 days)
    else if (range === "weekly") {
      dateExpr = `DATE("createdAt")`;
      groupByExpr = `DATE("createdAt")`;
      orderByExpr = `DATE("createdAt")`;
      whereDate = `AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days'`;
    } 
    // 🟢 MONTHLY → Date-wise (current month)
    else if (range === "monthly") {
      dateExpr = `DATE("createdAt")`;
      groupByExpr = `DATE("createdAt")`;
      orderByExpr = `DATE("createdAt")`;
      whereDate = `AND DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)`;
    } 
    // 🔵 CUSTOM → Date-wise (user selected range)
    else if (range === "custom") {
      dateExpr = `DATE("createdAt")`;
      groupByExpr = `DATE("createdAt")`;
      orderByExpr = `DATE("createdAt")`;
      whereDate = `
        AND (
          (:from IS NULL OR "createdAt" >= :from)
          AND (:to IS NULL OR "createdAt" <= :to)
        )
      `;
    } 
    else {
      dateExpr = `DATE("createdAt")`;
      groupByExpr = `DATE("createdAt")`;
      orderByExpr = `DATE("createdAt")`;
    }

    const rows = await sequelize.query(
      `
      SELECT 
        ${dateExpr} AS date,
        SUM("totalAmount")::FLOAT AS revenue,
        COUNT(id)::INT AS orders
      FROM orders
      WHERE 
        "cafeteriaId" = :cafeteriaId
        AND "paymentStatus" = 'SUCCESS'
        ${whereDate}
      GROUP BY ${groupByExpr}
      ORDER BY ${orderByExpr} ASC
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

    // 🔴 For DAILY range, ensure we have all 24 hours (fill missing hours with 0)
    if (range === "daily") {
      const completeData = [];
      for (let hour = 0; hour < 24; hour++) {
        const existing = rows.find(r => r.date === hour);
        completeData.push({
          date: hour,
          revenue: existing?.revenue ?? 0,
          orders: existing?.orders ?? 0
        });
      }
      return res.json(completeData);
    }

    return res.json(rows);
  } catch (err) {
    console.error("❌ Trend Error:", err.message);
    return res.status(500).json({
      message: "Trend fetch failed",
      error: err.message,
    });
  }
};


export const getTopItems = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { from, to, range = "daily" } = req.query;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    let whereDate = "";

    if (range === "daily") {
      whereDate = `AND o."createdAt"::date = CURRENT_DATE`;
    } else if (range === "weekly") {
      whereDate = `AND o."createdAt" >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === "monthly") {
      whereDate = `AND DATE_TRUNC('month', o."createdAt") = DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR o."createdAt" >= :from)
          AND (:to IS NULL OR o."createdAt" <= :to)
        )
      `;
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
        ${whereDate}
      GROUP BY mi.name
      ORDER BY count DESC
      LIMIT 6
      `,
      {
        replacements: { cafeteriaId, from: from ?? null, to: to ?? null },
        type: QueryTypes.SELECT,
      }
    );

    const total = items.reduce((s, i) => s + i.count, 0);

    return res.json(
      items.map((i) => ({
        label: i.label,
        count: i.count,
        percentage: total ? Math.round((i.count / total) * 100) : 0,
      }))
    );
  } catch (err) {
    console.error("❌ Top items error:", err.message);
    return res.status(500).json({ message: "Failed to fetch top items" });
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
    let orderExpr;
    let whereDate = "";

    // 🔴 DAILY → Hourly breakdown (0-23)
    if (range === "daily") {
      groupExpr = `EXTRACT(HOUR FROM "createdAt")::INT`;
      labelExpr = `EXTRACT(HOUR FROM "createdAt")::INT || ':00'`;
      orderExpr = `EXTRACT(HOUR FROM "createdAt")::INT`;
      whereDate = `AND "createdAt"::date = CURRENT_DATE`;
    } 
    // 🟡 WEEKLY → Date-wise (day of week names)
    else if (range === "weekly") {
      groupExpr = `DATE("createdAt")`;
      labelExpr = `TO_CHAR("createdAt", 'DD Mon')`;
      orderExpr = `DATE("createdAt")`;
      whereDate = `AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days'`;
    } 
    // 🟢 MONTHLY → Date-wise (all days in month)
    else if (range === "monthly") {
      groupExpr = `DATE("createdAt")`;
      labelExpr = `TO_CHAR("createdAt", 'DD Mon')`;
      orderExpr = `DATE("createdAt")`;
      whereDate = `AND DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)`;
    } 
    // 🔵 CUSTOM → Date-wise
    else if (range === "custom") {
      groupExpr = `DATE("createdAt")`;
      labelExpr = `TO_CHAR("createdAt", 'DD Mon')`;
      orderExpr = `DATE("createdAt")`;
      whereDate = `
        AND (
          (:from IS NULL OR "createdAt" >= :from)
          AND (:to IS NULL OR "createdAt" <= :to)
        )
      `;
    } 
    else {
      groupExpr = `DATE("createdAt")`;
      labelExpr = `TO_CHAR("createdAt", 'DD Mon')`;
      orderExpr = `DATE("createdAt")`;
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
        ${whereDate}
      GROUP BY ${groupExpr}
      ORDER BY ${orderExpr}
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

// ================= PEAK HOURS ANALYTICS =================
export const getPeakHours = async (req, res) => {
  try {
    const { range = "daily", from, to } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    let whereDate = "";

    // 🔴 DAILY → only today (hourly)
    if (range === "daily") {
      whereDate = `
        AND "createdAt"::date = CURRENT_DATE
      `;
    }
    // 🟡 WEEKLY → last 7 days (but still hourly? or daily peak?)
    else if (range === "weekly") {
      whereDate = `
        AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days'
      `;
    }
    // 🟢 MONTHLY → current month
    else if (range === "monthly") {
      whereDate = `
        AND DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)
      `;
    }
    // 🔵 CUSTOM (calendar)
    else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR "createdAt" >= :from)
          AND (:to IS NULL OR "createdAt" <= :to)
        )
      `;
    }

    const rows = await sequelize.query(
      `
      SELECT
        EXTRACT(HOUR FROM "createdAt")::INT AS hour,
        COUNT(*)::INT AS orders
      FROM orders
      WHERE
        "cafeteriaId" = :cafeteriaId
        AND "paymentStatus" = 'SUCCESS'
        ${whereDate}
      GROUP BY hour
      ORDER BY hour ASC
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
    console.error("❌ Peak Hours Error:", err.message);
    return res.status(500).json({
      message: "Failed to fetch peak hours",
      error: err.message,
    });
  }
};