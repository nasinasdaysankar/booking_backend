
import { sequelize } from "../models/index.js";
import { QueryTypes } from "sequelize";
import { analyticsCacheGet, analyticsCacheSet, CACHE_KEYS } from "../utils/cache.js";
import { getCache, setCache } from "../config/redis.js";

// ─────────────────────────────────────────────────────────────────────────
// Helper: build an optional payment_method WHERE clause.
// paymentMethod = "ONLINE" | "CASH" | null (all methods)
// ─────────────────────────────────────────────────────────────────────────
const buildPaymentMethodClause = (paymentMethod) => {
  if (!paymentMethod || !["ONLINE", "CASH"].includes(paymentMethod.toUpperCase())) {
    return { clause: "", value: null };
  }
  return {
    clause: `AND "payment_method" = :paymentMethod`,
    value: paymentMethod.toUpperCase(),
  };
};

// ─────────────────────────────────────────────────────────────────────────
// TREND
// ─────────────────────────────────────────────────────────────────────────
export const getTrendData = async (req, res) => {
  try {
    const { range = "daily", from, to, paymentMethod } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Admin not linked to cafeteria" });
    }

    const { clause: pmClause, value: pmValue } = buildPaymentMethodClause(paymentMethod);

    // ✅ Cache key includes payment method so Online/Cash results are cached separately
    const cacheKey = CACHE_KEYS.ANALYTICS_TREND(
      cafeteriaId,
      `${range}_${from || ""}_${to || ""}_${pmValue || "all"}`
    );
    const cached = await analyticsCacheGet(cacheKey);
    if (cached) return res.json(cached);

    let dateExpr, whereDate, groupByExpr, orderByExpr;

    if (range === "daily") {
      dateExpr = `EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT`;
      groupByExpr = `EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT`;
      orderByExpr = `EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT`;
      whereDate = `AND CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) = CURRENT_DATE`;
    } else if (range === "weekly") {
      dateExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      groupByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      orderByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      whereDate = `AND CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === "monthly") {
      dateExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      groupByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      orderByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      whereDate = `AND DATE_TRUNC('month', COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at")) = DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (range === "custom") {
      dateExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      groupByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      orderByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) <= :to::date)
        )
      `;
    } else {
      dateExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      groupByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      orderByExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      whereDate = "";
    }

    const finalFrom = from || null;
    const finalTo = to || (from ? from : null);

    const query = `
      SELECT 
        ${dateExpr} AS date,
        (SUM("totalamount") - SUM("totalamount" * 0.0195 * 1.18) - SUM(COALESCE(commission_amount, 0)))::FLOAT AS revenue,
        COUNT(id)::INT AS orders
      FROM orders
      WHERE 
        "cafeteriaid" = :cafeteriaId
        AND "paymentstatus" = 'SUCCESS'
        ${pmClause}
        ${whereDate}
      GROUP BY ${groupByExpr}
      ORDER BY ${orderByExpr} ASC
    `;

    const rows = await sequelize.query(query, {
      replacements: { cafeteriaId, from: finalFrom, to: finalTo, paymentMethod: pmValue },
      type: QueryTypes.SELECT,
    });

    // For DAILY: fill all 24 hours
    if (range === "daily") {
      const completeData = [];
      for (let hour = 0; hour < 24; hour++) {
        const existing = rows.find((r) => r.date === hour);
        completeData.push({
          date: hour,
          revenue: existing?.revenue ?? 0,
          orders: existing?.orders ?? 0,
        });
      }
      await analyticsCacheSet(cacheKey, completeData);
      return res.json(completeData);
    }

    await analyticsCacheSet(cacheKey, rows);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Trend Error:", err.message);
    return res.status(500).json({ message: "Trend fetch failed", error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────
// TOP ITEMS
// ─────────────────────────────────────────────────────────────────────────
export const getTopItems = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { from, to, range = "daily", paymentMethod } = req.query;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    const { clause: pmClause, value: pmValue } = buildPaymentMethodClause(paymentMethod);

    const cacheKey = CACHE_KEYS.ANALYTICS_TOP(
      cafeteriaId,
      `${range}_${from || ""}_${to || ""}_${pmValue || "all"}`
    );
    const cached = await analyticsCacheGet(cacheKey);
    if (cached) return res.json(cached);

    let whereDate = "";

    if (range === "daily") {
      whereDate = `AND CAST(COALESCE(o."created_at" AT TIME ZONE 'Asia/Kolkata', o."created_at") AS DATE) = CURRENT_DATE`;
    } else if (range === "weekly") {
      whereDate = `AND CAST(COALESCE(o."created_at" AT TIME ZONE 'Asia/Kolkata', o."created_at") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === "monthly") {
      whereDate = `AND DATE_TRUNC('month', COALESCE(o."created_at" AT TIME ZONE 'Asia/Kolkata', o."created_at")) = DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE(o."created_at" AT TIME ZONE 'Asia/Kolkata', o."created_at") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE(o."created_at" AT TIME ZONE 'Asia/Kolkata', o."created_at") AS DATE) <= :to::date)
        )
      `;
    }

    // Payment method filter applies to the orders join
    const pmJoinClause = pmValue ? `AND o."payment_method" = :paymentMethod` : "";

    const query = `
      SELECT 
        oi.name AS label,
        SUM(oi.quantity)::INT AS count,
        SUM(oi.quantity * oi.priceatorder)::FLOAT AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderid"
      WHERE 
        o."cafeteriaid" = :cafeteriaId
        AND o."paymentstatus" = 'SUCCESS'
        ${pmJoinClause}
        ${whereDate}
      GROUP BY oi.name
      ORDER BY revenue DESC
      LIMIT 6
    `;

    const items = await sequelize.query(query, {
      replacements: { cafeteriaId, from: from ?? null, to: to ?? null, paymentMethod: pmValue },
      type: QueryTypes.SELECT,
    });

    const totalRevenue = items.reduce((s, i) => s + (i.revenue || 0), 0);

    const result = items.map((i) => ({
      label: i.label,
      count: i.count,
      revenue: i.revenue,
      percentage: totalRevenue > 0 ? Math.round((i.revenue / totalRevenue) * 100) : 0,
    }));

    await analyticsCacheSet(cacheKey, result);
    return res.json(result);
  } catch (err) {
    console.error("❌ Top items error:", err.message);
    return res.status(500).json({ message: "Failed to fetch top items", error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────
// ORDERS OVERVIEW
// ─────────────────────────────────────────────────────────────────────────
export const getOrdersOverview = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { range = "weekly", from, to, paymentMethod } = req.query;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    const { clause: pmClause, value: pmValue } = buildPaymentMethodClause(paymentMethod);

    const cacheKey = CACHE_KEYS.ANALYTICS_OVERVIEW(
      cafeteriaId,
      `${range}_${from || ""}_${to || ""}_${pmValue || "all"}`
    );
    const cached = await analyticsCacheGet(cacheKey);
    if (cached) return res.json(cached);

    let groupExpr, labelExpr, orderExpr, whereDate = "";

    if (range === "daily") {
      groupExpr = `EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT`;
      labelExpr = `EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT || ':00'`;
      orderExpr = `EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT`;
      whereDate = `AND CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) = CURRENT_DATE`;
    } else if (range === "weekly") {
      groupExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      labelExpr = `TO_CHAR(CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      whereDate = `AND CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === "monthly") {
      groupExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      labelExpr = `TO_CHAR(CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      whereDate = `AND DATE_TRUNC('month', COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at")) = DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (range === "custom") {
      groupExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      labelExpr = `TO_CHAR(CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) <= :to::date)
        )
      `;
    } else {
      groupExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
      labelExpr = `TO_CHAR(CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE), 'DD Mon')`;
      orderExpr = `CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE)`;
    }

    const query = `
      SELECT
        ${labelExpr} AS label,
        COUNT(*)::INT AS count
      FROM orders
      WHERE
        "cafeteriaid" = :cafeteriaId
        AND "paymentstatus" = 'SUCCESS'
        ${pmClause}
        ${whereDate}
      GROUP BY ${groupExpr}
      ORDER BY ${orderExpr} ASC
    `;

    const rows = await sequelize.query(query, {
      replacements: { cafeteriaId, from: from ?? null, to: to ?? null, paymentMethod: pmValue },
      type: QueryTypes.SELECT,
    });

    await analyticsCacheSet(cacheKey, rows);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Orders overview error:", err.message);
    return res.status(500).json({ message: "Failed to fetch orders overview", error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────
// PEAK HOURS
// ─────────────────────────────────────────────────────────────────────────
export const getPeakHours = async (req, res) => {
  try {
    const { range = "daily", from, to, paymentMethod } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    const { clause: pmClause, value: pmValue } = buildPaymentMethodClause(paymentMethod);

    const cacheKey = CACHE_KEYS.ANALYTICS_PEAK(
      cafeteriaId,
      `${range}_${from || ""}_${to || ""}_${pmValue || "all"}`
    );
    const cached = await analyticsCacheGet(cacheKey);
    if (cached) return res.json(cached);

    let whereDate = "";

    if (range === "daily") {
      whereDate = `AND CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) = CURRENT_DATE`;
    } else if (range === "weekly") {
      whereDate = `AND CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === "monthly") {
      whereDate = `AND DATE_TRUNC('month', COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at")) = DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at") AS DATE) <= :to::date)
        )
      `;
    }

    const query = `
      SELECT
        EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT AS hour,
        COUNT(*)::INT AS orders
      FROM orders
      WHERE
        "cafeteriaid" = :cafeteriaId
        AND "paymentstatus" = 'SUCCESS'
        ${pmClause}
        ${whereDate}
      GROUP BY EXTRACT(HOUR FROM COALESCE("created_at" AT TIME ZONE 'Asia/Kolkata', "created_at"))::INT
      ORDER BY hour ASC
    `;

    const rows = await sequelize.query(query, {
      replacements: { cafeteriaId, from: from ?? null, to: to ?? null, paymentMethod: pmValue },
      type: QueryTypes.SELECT,
    });

    await analyticsCacheSet(cacheKey, rows);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Peak Hours Error:", err.message);
    return res.status(500).json({ message: "Failed to fetch peak hours", error: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────
// COMMISSION STATS (no payment_method filter — commissions are payment-agnostic)
// ─────────────────────────────────────────────────────────────────────────
export const getCommissionStats = async (req, res) => {
  try {
    const { from, to } = req.query;
    const cafeteriaId = req.user.cafeteriaId;

    if (!cafeteriaId) {
      return res.status(400).json({ message: "Cafeteria not linked" });
    }

    const cacheKey = CACHE_KEYS.ANALYTICS_COMMISSION(cafeteriaId);
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    let whereDate = "";
    if (from && to) {
      whereDate = `AND ("created_at" >= :from::date AND "created_at" <= :to::date)`;
    }

    const result = await sequelize.query(
      `
      SELECT 
        COUNT(id)::INT as totalTransactions,
        SUM(amount)::FLOAT as totalCommission
      FROM commissions
      WHERE 
        "cafeteriaid" = :cafeteriaId
        ${whereDate}
      `,
      {
        replacements: { cafeteriaId, from: from ?? null, to: to ?? null },
        type: QueryTypes.SELECT,
      }
    );

    const stats = result[0] || { totalTransactions: 0, totalCommission: 0 };
    const response = { success: true, data: stats };

    await setCache(cacheKey, response, 300);
    return res.json(response);
  } catch (err) {
    console.error("❌ Commission Stats Error:", err.message);
    return res.status(500).json({ message: "Failed to fetch commission stats", error: err.message });
  }
};