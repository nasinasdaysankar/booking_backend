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

    // 🔴 DAILY → Hourly breakdown (0-23) in IST
    if (range === "daily") {
      dateExpr = `EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT`;
      groupByExpr = `EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT`;
      orderByExpr = `EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT`;
      whereDate = `AND CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) = CURRENT_DATE`;
    } 
    // 🟡 WEEKLY → Date-wise (last 7 days) in IST
    else if (range === "weekly") {
      dateExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      groupByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      orderByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      whereDate = `AND CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'`;
    } 
    // 🟢 MONTHLY → Date-wise (current month) in IST
    else if (range === "monthly") {
      dateExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      groupByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      orderByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      whereDate = `AND DATE_TRUNC('month', COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt")) = DATE_TRUNC('month', CURRENT_DATE)`;
    } 
    // 🔵 CUSTOM → Date-wise (user selected range) in IST
    else if (range === "custom") {
      dateExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      groupByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      orderByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) <= :to::date)
        )
      `;
    } 
    else {
      dateExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      groupByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      orderByExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
    }

    const query = `
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
    `;

    console.log("🔍 Trend Query:", query);

    const rows = await sequelize.query(query, {
      replacements: {
        cafeteriaId,
        from: from ?? null,
        to: to ?? null,
      },
      type: QueryTypes.SELECT,
    });

    console.log("📊 Trend Result:", rows);

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
    console.error("❌ Trend Stack:", err.stack);
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
      whereDate = `AND CAST(COALESCE(o."createdAt" AT TIME ZONE 'Asia/Kolkata', o."createdAt") AS DATE) = CURRENT_DATE`;
    } else if (range === "weekly") {
      whereDate = `AND CAST(COALESCE(o."createdAt" AT TIME ZONE 'Asia/Kolkata', o."createdAt") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === "monthly") {
      whereDate = `AND DATE_TRUNC('month', COALESCE(o."createdAt" AT TIME ZONE 'Asia/Kolkata', o."createdAt")) = DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE(o."createdAt" AT TIME ZONE 'Asia/Kolkata', o."createdAt") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE(o."createdAt" AT TIME ZONE 'Asia/Kolkata', o."createdAt") AS DATE) <= :to::date)
        )
      `;
    }

    const query = `
      SELECT 
        mi.name AS label,
        SUM(oi.quantity)::INT AS count,
        SUM(oi.quantity * mi.price)::FLOAT AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      JOIN menu_items mi ON mi.id = oi."menuItemId"
      WHERE 
        o."cafeteriaId" = :cafeteriaId
        AND o."paymentStatus" = 'SUCCESS'
        ${whereDate}
      GROUP BY mi.name
      ORDER BY revenue DESC
      LIMIT 6
    `;

    console.log("🔍 Top Items Query:", query);

    const items = await sequelize.query(query, {
      replacements: { cafeteriaId, from: from ?? null, to: to ?? null },
      type: QueryTypes.SELECT,
    });

    console.log("📊 Top Items Result:", items);

    const totalRevenue = items.reduce((s, i) => s + (i.revenue || 0), 0);

    console.log("💰 Total Revenue:", totalRevenue);

    return res.json(
      items.map((i) => ({
        label: i.label,
        count: i.count,
        revenue: i.revenue,
        percentage: totalRevenue > 0 ? Math.round((i.revenue / totalRevenue) * 100) : 0,
      }))
    );
  } catch (err) {
    console.error("❌ Top items error:", err.message);
    console.error("❌ Top items stack:", err.stack);
    return res.status(500).json({ message: "Failed to fetch top items", error: err.message });
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

    // 🔴 DAILY → Hourly breakdown (0-23) in IST
    if (range === "daily") {
      groupExpr = `EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT`;
      labelExpr = `EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT || ':00'`;
      orderExpr = `EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT`;
      whereDate = `AND CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) = CURRENT_DATE`;
    } 
    // 🟡 WEEKLY → Date-wise in IST
    else if (range === "weekly") {
      groupExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      // ✅ FIX: Cast the formatted string so SQL knows it's part of the group
      labelExpr = `TO_CHAR(CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      whereDate = `AND CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'`;
    } 
    // 🟢 MONTHLY → Date-wise in IST
    else if (range === "monthly") {
      groupExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      // ✅ FIX: Same fix for monthly
      labelExpr = `TO_CHAR(CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      whereDate = `AND DATE_TRUNC('month', COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt")) = DATE_TRUNC('month', CURRENT_DATE)`;
    } 
    // 🔵 CUSTOM → Date-wise in IST
    else if (range === "custom") {
      groupExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      labelExpr = `TO_CHAR(CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) <= :to::date)
        )
      `;
    } 
    else {
      groupExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
      labelExpr = `TO_CHAR(CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE)`;
    }

    // ✅ FIXED: Use groupExpr for GROUP BY (not labelExpr)
    const query = `
      SELECT
        ${labelExpr} AS label,
        COUNT(*)::INT AS count
      FROM orders
      WHERE
        "cafeteriaId" = :cafeteriaId
        AND "paymentStatus" = 'SUCCESS'
        ${whereDate}
      GROUP BY ${groupExpr}
      ORDER BY ${orderExpr} ASC
    `;

    console.log("🔍 Orders Overview Query:", query);

    const rows = await sequelize.query(query, {
      replacements: {
        cafeteriaId,
        from: from ?? null,
        to: to ?? null,
      },
      type: QueryTypes.SELECT,
    });

    console.log("📊 Orders Overview Result:", rows);

    return res.json(rows);
  } catch (err) {
    console.error("❌ Orders overview error:", err.message);
    console.error("❌ Orders overview stack:", err.stack);
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

    // 🔴 DAILY → only today (hourly) in IST
    if (range === "daily") {
      whereDate = `
        AND CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) = CURRENT_DATE
      `;
    }
    // 🟡 WEEKLY → last 7 days in IST
    else if (range === "weekly") {
      whereDate = `
        AND CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'
      `;
    }
    // 🟢 MONTHLY → current month in IST
    else if (range === "monthly") {
      whereDate = `
        AND DATE_TRUNC('month', COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt")) = DATE_TRUNC('month', CURRENT_DATE)
      `;
    }
    // 🔵 CUSTOM (calendar) in IST
    else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt") AS DATE) <= :to::date)
        )
      `;
    }

    const query = `
      SELECT
        EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT AS hour,
        COUNT(*)::INT AS orders
      FROM orders
      WHERE
        "cafeteriaId" = :cafeteriaId
        AND "paymentStatus" = 'SUCCESS'
        ${whereDate}
      GROUP BY EXTRACT(HOUR FROM COALESCE("createdAt" AT TIME ZONE 'Asia/Kolkata', "createdAt"))::INT
      ORDER BY hour ASC
    `;

    console.log("🔍 Peak Hours Query:", query);

    const rows = await sequelize.query(query, {
      replacements: {
        cafeteriaId,
        from: from ?? null,
        to: to ?? null,
      },
      type: QueryTypes.SELECT,
    });

    console.log("📊 Peak Hours Result:", rows);

    return res.json(rows);
  } catch (err) {
    console.error("❌ Peak Hours Error:", err.message);
    console.error("❌ Peak Hours Stack:", err.stack);
    return res.status(500).json({
      message: "Failed to fetch peak hours",
      error: err.message,
    });
  }
};