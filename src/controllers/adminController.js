import { Order, Cafeteria } from '../models/index.js';

export const getCafeteriaOrders = async (req, res) => {
  try {
    const cafeteriaId = req.user.cafeteriaId;
    const { status } = req.query;

    const where = { cafeteriaId };
    if (status) where.status = status;

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

// Student scans static QR (contains cafeteriaId or token), then sends billId to verify.
export const verifyOrderPickup = async (req, res) => {
  try {
    const { cafeteriaId } = req.params;
    const { billId } = req.body;

    // student must be logged in:
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
