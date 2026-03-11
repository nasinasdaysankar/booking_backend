import { Order, OrderItem, Cafeteria } from '../models/index.js'; // Ensure OrderItem is imported if needed
import { Sequelize } from 'sequelize';
const { Op } = Sequelize;

// --------------------------------------------------
// 1. GET DASHBOARD STATS (Revenue, Counts)
// --------------------------------------------------
export const getDashboardStats = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const range = req.query.range || "daily";

    let dateFilter = {};

    if (range === "daily") {
      dateFilter = {
        createdAt: {
          [Op.gte]: Sequelize.literal("CURRENT_DATE")
        }
      };
    }

    if (range === "weekly") {
      dateFilter = {
        createdAt: {
          [Op.gte]: Sequelize.literal("CURRENT_DATE - INTERVAL '7 days'")
        }
      };
    }

    if (range === "monthly") {
      dateFilter = {
        createdAt: {
          [Op.gte]: Sequelize.literal("CURRENT_DATE - INTERVAL '30 days'")
        }
      };
    }

    const where = { cafeteriaId, ...dateFilter };

    const totalOrders = await Order.count({ where });

    const totalRevenue = await Order.sum("totalAmount", {
      where: {
        ...where,
        status: { [Op.not]: "CANCELLED" }
      }
    });

    const pendingOrders = await Order.count({
      where: {
        cafeteriaId,
        status: { [Op.in]: ["PAID", "PREPARING", "READY"] }
      }
    });

    const avgOrderValue =
      totalOrders > 0 ? (totalRevenue || 0) / totalOrders : 0;

    res.json({
      totalRevenue: totalRevenue || 0,
      totalOrders,
      pendingOrders,
      avgOrderValue: avgOrderValue.toFixed(2)
    });
  } catch (err) {
    console.error("STATS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};


// --------------------------------------------------
// 2. GET ALL ORDERS (For the Order List)
// --------------------------------------------------
export const getCafeteriaOrders = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { status } = req.query;
    const where = {
      cafeteriaId,
      status: { [Sequelize.Op.notIn]: ['CANCELLED', 'EXPIRED'] } // Default filter
    };

    if (status) {
      if (status.includes(',')) {
        where.status = { [Sequelize.Op.in]: status.split(',') };
      } else {
        where.status = status;
      }
    }

    const orders = await Order.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

// --------------------------------------------------
// 3. UPDATE ORDER STATUS
// --------------------------------------------------
export const updateOrderStatus = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ where: { id, cafeteriaId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    await order.save();

    res.json({ message: 'Status updated', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating status' });
  }
};

// --------------------------------------------------
// 4. VERIFY ORDER (QR Scan)
// --------------------------------------------------
export const verifyOrderPickup = async (req, res) => {
  try {
    const { cafeteriaId } = req.params;
    const { billId } = req.body;
    const studentId = req.user.id;

    const cafeteria = await Cafeteria.findByPk(cafeteriaId);
    if (!cafeteria) return res.status(404).json({ message: 'Cafeteria not found' });

    const order = await Order.findOne({
      where: { billId, studentId, cafeteriaId }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found for this cafeteria' });
    }

    if (order.status !== 'READY') {
      return res.status(400).json({ message: `Order is not READY (current: ${order.status})` });
    }

    order.status = 'PICKED_UP';
    await order.save();

    res.json({
      ok: true,
      message: 'Order verified and marked as PICKED_UP',
      order: {
        id: order.id,
        billId: order.billId,
        status: order.status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error verifying order' });
  }
};

export const getTrendData = async (req, res) => {
  try {
    const range = req.query.range || "daily";

    let groupBy;
    let dateFormat;

    if (range === "daily") {
      groupBy = `DATE("created_at")`;
      dateFormat = "YYYY-MM-DD";
    } else if (range === "weekly") {
      groupBy = `DATE_TRUNC('week', "created_at")`;
      dateFormat = "YYYY-MM-DD";
    } else {
      groupBy = `DATE_TRUNC('month', "created_at")`;
      dateFormat = "YYYY-MM";
    }

    const [results] = await sequelize.query(`
      SELECT 
        TO_CHAR(${groupBy}, '${dateFormat}') AS date,
        SUM("totalamount")::FLOAT AS revenue,
        COUNT(*)::INT AS orders
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY ${groupBy}
      ORDER BY ${groupBy}
    `);

    return res.status(200).json(results);
  } catch (error) {
    console.error("❌ Trend Analytics Error:", error);
    return res.status(500).json({ message: "Failed to fetch trend data" });
  }
};