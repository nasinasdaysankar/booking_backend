import { v4 as uuidv4 } from 'uuid';
import { Order, OrderItem, MenuItem } from '../models/index.js';

const calculateETA = (menuItemsWithQty) => {
  // Simple ETA: max(estPrepTime) + queue factor (e.g., 5 mins)
  let maxPrep = 0;
  for (const item of menuItemsWithQty) {
    if (item.estPrepTimeMinutes > maxPrep) {
      maxPrep = item.estPrepTimeMinutes;
    }
  }
  return maxPrep + 5;
};

export const createOrder = async (req, res) => {
  const t = await Order.sequelize.transaction();
  try {
    const { cafeteriaId, items } = req.body;
    // items: [{ menuItemId, quantity }]

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items' });
    }

    const dbItems = await MenuItem.findAll({
      where: { id: items.map(i => i.menuItemId) }
    });

    if (dbItems.length !== items.length) {
      return res.status(400).json({ message: 'Some items invalid' });
    }

    let total = 0;
    const itemsWithDetails = [];

    for (const cartItem of items) {
      const mi = dbItems.find(d => d.id === cartItem.menuItemId);
      if (!mi || !mi.isAvailable) {
        return res.status(400).json({ message: `Item not available: ${cartItem.menuItemId}` });
      }
      const price = parseFloat(mi.price);
      total += price * cartItem.quantity;
      itemsWithDetails.push({
        menuItem: mi,
        quantity: cartItem.quantity,
        priceAtOrder: price
      });
    }

    const eta = calculateETA(itemsWithDetails.map(i => i.menuItem));

    const billId = `BILL-${uuidv4().slice(0, 8).toUpperCase()}`;

    const order = await Order.create({
      billId,
      studentId: req.user.id,
      cafeteriaId,
      totalAmount: total.toFixed(2),
      status: 'PAID', // assume mock payment success
      paymentStatus: 'SUCCESS',
      etaMinutes: eta
    }, { transaction: t });

    for (const it of itemsWithDetails) {
      await OrderItem.create({
        orderId: order.id,
        menuItemId: it.menuItem.id,
        quantity: it.quantity,
        priceAtOrder: it.priceAtOrder
      }, { transaction: t });
    }

    await t.commit();

    res.status(201).json({
      message: 'Order created',
      order: {
        id: order.id,
        billId: order.billId,
        etaMinutes: order.etaMinutes,
        totalAmount: order.totalAmount,
        status: order.status
      }
    });
  } catch (err) {
    console.error(err);
    await t.rollback();
    res.status(500).json({ message: 'Error creating order' });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { studentId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({
      where: { id, studentId: req.user.id },
      include: [OrderItem]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching order' });
  }
};
