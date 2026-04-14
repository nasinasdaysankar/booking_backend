
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
// Helper: Convert a TIMESTAMPTZ column to IST (Asia/Kolkata) local time.
//
//   PostgreSQL:  "created_at" AT TIME ZONE 'Asia/Kolkata'
//
// When the source column is TIMESTAMPTZ (which Sequelize's DataTypes.DATE
// maps to), applying AT TIME ZONE <tz> returns a TIMESTAMP WITHOUT TIME
// ZONE representing the wall-clock time in that zone.
//
// IMPORTANT: Do NOT wrap this in COALESCE("col" AT TIME ZONE ..., "col")
// because the fallback branch is still TIMESTAMPTZ, and PostgreSQL will
// silently cast it using the *server* timezone (UTC on Railway), which
// defeats the purpose and causes midnight–05:30 orders to land on the
// wrong day.
// ─────────────────────────────────────────────────────────────────────────
const istExpr = (col) => `(${col} AT TIME ZONE 'Asia/Kolkata')`;

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
    const ist = istExpr('"created_at"');

    if (range === "daily") {
      dateExpr = `EXTRACT(HOUR FROM ${ist})::INT`;
      groupByExpr = `EXTRACT(HOUR FROM ${ist})::INT`;
      orderByExpr = `EXTRACT(HOUR FROM ${ist})::INT`;
      whereDate = `AND CAST(${ist} AS DATE) = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE`;
    } else if (range === "weekly") {
      dateExpr = `CAST(${ist} AS DATE)`;
      groupByExpr = `CAST(${ist} AS DATE)`;
      orderByExpr = `CAST(${ist} AS DATE)`;
      whereDate = `AND CAST(${ist} AS DATE) >= (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '6 days'`;
    } else if (range === "monthly") {
      dateExpr = `CAST(${ist} AS DATE)`;
      groupByExpr = `CAST(${ist} AS DATE)`;
      orderByExpr = `CAST(${ist} AS DATE)`;
      whereDate = `AND DATE_TRUNC('month', ${ist}) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE)`;
    } else if (range === "custom") {
      dateExpr = `CAST(${ist} AS DATE)`;
      groupByExpr = `CAST(${ist} AS DATE)`;
      orderByExpr = `CAST(${ist} AS DATE)`;
      whereDate = `
        AND (
          (:from IS NULL OR CAST(${ist} AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(${ist} AS DATE) <= :to::date)
        )
      `;
    } else {
      dateExpr = `CAST(${ist} AS DATE)`;
      groupByExpr = `CAST(${ist} AS DATE)`;
      orderByExpr = `CAST(${ist} AS DATE)`;
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
    const ist = istExpr('o."created_at"');

    if (range === "daily") {
      whereDate = `AND CAST(${ist} AS DATE) = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE`;
    } else if (range === "weekly") {
      whereDate = `AND CAST(${ist} AS DATE) >= (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '6 days'`;
    } else if (range === "monthly") {
      whereDate = `AND DATE_TRUNC('month', ${ist}) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE)`;
    } else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR CAST(${ist} AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(${ist} AS DATE) <= :to::date)
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
    const ist = istExpr('"created_at"');

    if (range === "daily") {
      groupExpr = `EXTRACT(HOUR FROM ${ist})::INT`;
      labelExpr = `EXTRACT(HOUR FROM ${ist})::INT || ':00'`;
      orderExpr = `EXTRACT(HOUR FROM ${ist})::INT`;
      whereDate = `AND CAST(${ist} AS DATE) = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE`;
    } else if (range === "weekly") {
      groupExpr = `CAST(${ist} AS DATE)`;
      labelExpr = `TO_CHAR(CAST(${ist} AS DATE), 'DD Mon')`;
      orderExpr = `CAST(${ist} AS DATE)`;
      whereDate = `AND CAST(${ist} AS DATE) >= (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '6 days'`;
    } else if (range === "monthly") {
      groupExpr = `CAST(${ist} AS DATE)`;
      labelExpr = `TO_CHAR(CAST(${ist} AS DATE), 'DD Mon')`;
      orderExpr = `CAST(${ist} AS DATE)`;
      whereDate = `AND DATE_TRUNC('month', ${ist}) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE)`;
    } else if (range === "custom") {
      groupExpr = `CAST(${ist} AS DATE)`;
      labelExpr = `TO_CHAR(CAST(${ist} AS DATE), 'DD Mon')`;
      orderExpr = `CAST(${ist} AS DATE)`;
      whereDate = `
        AND (
          (:from IS NULL OR CAST(${ist} AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(${ist} AS DATE) <= :to::date)
        )
      `;
    } else {
      groupExpr = `CAST(${ist} AS DATE)`;
      labelExpr = `TO_CHAR(CAST(${ist} AS DATE), 'DD Mon')`;
      orderExpr = `CAST(${ist} AS DATE)`;
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
    const ist = istExpr('"created_at"');

    if (range === "daily") {
      whereDate = `AND CAST(${ist} AS DATE) = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE`;
    } else if (range === "weekly") {
      whereDate = `AND CAST(${ist} AS DATE) >= (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '6 days'`;
    } else if (range === "monthly") {
      whereDate = `AND DATE_TRUNC('month', ${ist}) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE)`;
    } else if (range === "custom") {
      whereDate = `
        AND (
          (:from IS NULL OR CAST(${ist} AS DATE) >= :from::date)
          AND (:to IS NULL OR CAST(${ist} AS DATE) <= :to::date)
        )
      `;
    }

    const query = `
      SELECT
        EXTRACT(HOUR FROM ${ist})::INT AS hour,
        COUNT(*)::INT AS orders
      FROM orders
      WHERE
        "cafeteriaid" = :cafeteriaId
        AND "paymentstatus" = 'SUCCESS'
        ${pmClause}
        ${whereDate}
      GROUP BY EXTRACT(HOUR FROM ${ist})::INT
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

    // ✅ FIX: Use IST for commission date filtering too
    const ist = istExpr('"created_at"');
    let whereDate = "";
    if (from && to) {
      whereDate = `AND (CAST(${ist} AS DATE) >= :from::date AND CAST(${ist} AS DATE) <= :to::date)`;
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