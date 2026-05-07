import { Order, DeliveryPartner, User, PartnerFcmToken, Cafeteria, MenuItem, OrderItem } from "../models/index.js";
import { emitOrderStatusToUser, emitAdminOrderUpdate, emitDeliveryOtp, emitDeliveryAssignment } from "../socket.js";
import { sendPushNotification } from "../utils/notificationUtils.js";
import { Sequelize } from "sequelize";

// ==========================================
// 0. ASSIGN ORDER (Admin Action)
// ==========================================

export const assignPartner = async (req, res) => {
  try {
    const { orderId, partnerId } = req.body;
    const adminCafeteriaId = req.user.cafeteriaId;

    const order = await Order.findByPk(orderId);
    const partner = await DeliveryPartner.findByPk(partnerId, {
      include: [{ model: Cafeteria, attributes: ['name', 'latitude', 'longitude'] }]
    });

    if (!order || !partner) {
      return res.status(404).json({ message: "Order or Partner not found" });
    }

    // Security Check: Partner must belong to the same cafeteria as the admin
    if (partner.cafeteriaId !== adminCafeteriaId || order.cafeteriaId !== adminCafeteriaId) {
      return res.status(403).json({ message: "Unauthorized assignment" });
    }

    if (!partner.isActive) {
      return res.status(400).json({ message: "Partner is currently inactive" });
    }

    order.deliveryPartnerId = partner.id;
    order.status = "ASSIGNED"; 
    await order.save();

    // 1. Emit Socket to Partner
    emitDeliveryAssignment(partner.id, {
      orderId: order.id,
      billId: order.billId,
      itemsCount: order.itemCount || 1,
      totalAmount: parseFloat(order.totalAmount || 0),
      status: order.status,
      cafeteriaName: partner.Cafeteria?.name,
      cafeteriaLat: parseFloat(partner.Cafeteria?.latitude || 0),
      cafeteriaLng: parseFloat(partner.Cafeteria?.longitude || 0),
      customerLat: parseFloat(order.latitude || 0),
      customerLng: parseFloat(order.longitude || 0),
      deliveryAddress: order.deliveryAddress,
      deliveryOrderId: order.deliveryOrderId,
    });

    // 2. Emit Socket to User & Admin
    emitOrderStatusToUser(order.studentId, { orderId: order.id, status: "ASSIGNED" });
    emitAdminOrderUpdate(order.cafeteriaId, { 
      orderId: order.id, 
      status: "ASSIGNED", 
      partnerName: partner.name,
      orderType: order.orderType,
    });

    // 3. Send Push Notification to Partner
    const partnerTokens = await PartnerFcmToken.findAll({ where: { partnerId: partner.id } });
    if (partnerTokens.length > 0) {
      // Use the actual cafeteria name from the partner's association if available
      const cafeName = partner.Cafeteria?.name || "the cafeteria";
      
      await sendPushNotification(
        partnerTokens.map(t => t.fcmToken),
        "New Delivery Assigned 📦",
        `You have a new delivery task at ${cafeName}.`,
        { orderId: order.id.toString(), type: "NEW_ASSIGNMENT" },
        partner.id,
        false,
        "high_importance_channel",
        true // isPartner
      );
    }

    console.log(`✅ Order ${orderId} assigned to Partner ${partnerId} (${partner.name})`);
    res.json({ message: "Order assigned successfully", order });
  } catch (err) {
    console.error("ASSIGN PARTNER ERROR:", err);
    res.status(500).json({ message: "Assignment failed" });
  }
};

// ==========================================
// 1. ACCEPT / REJECT ORDER
// ==========================================

export const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.deliveryPartnerId !== partnerId) {
      return res.status(403).json({ message: "Order not assigned to you" });
    }

    order.status = "ACCEPTED";
    await order.save();

    // Fetch full order with associations for the response
    const fullOrder = await Order.findByPk(orderId, {
      include: [
        { 
          model: OrderItem, 
          as: 'items',
          include: [{ model: MenuItem, as: 'menuItem', attributes: ['name'] }]
        },
        { model: User, attributes: ['id', 'name', 'phone'] },
        { model: Cafeteria, as: 'Cafeteria', attributes: ['id', 'name', 'latitude', 'longitude'] },
        { model: DeliveryPartner, attributes: ['name', 'phone'] }
      ]
    });

    // Sanitize for response
    const plainOrder = fullOrder.get({ plain: true });
    const sanitizedOrder = {
      ...plainOrder,
      totalAmount: parseFloat(plainOrder.totalAmount || 0),
      customerName: plainOrder.User?.name || 'Guest User',
      customerPhone: plainOrder.User?.phone || '',
      cafeteriaName: plainOrder.Cafeteria?.name || 'Cafeteria',
      cafeteriaPhone: plainOrder.Cafeteria?.phone || '',
      cafeteriaLat: parseFloat(plainOrder.Cafeteria?.latitude || 0),
      cafeteriaLng: parseFloat(plainOrder.Cafeteria?.longitude || 0),
      customerLat: parseFloat(plainOrder.latitude || 0),
      customerLng: parseFloat(plainOrder.longitude || 0),
      deliveryOrderId: plainOrder.deliveryOrderId
    };

    // Notify others
    emitOrderStatusToUser(order.studentId, { 
      orderId: order.id, 
      status: "ACCEPTED",
      partnerName: fullOrder.DeliveryPartner?.name ?? null,
      partnerPhone: fullOrder.DeliveryPartner?.phone ?? null,
      partnerLat: fullOrder.DeliveryPartner?.lastLat ?? null,
      partnerLng: fullOrder.DeliveryPartner?.lastLong ?? null,
      cafeteriaLat: fullOrder.Cafeteria?.latitude ?? null,
      cafeteriaLng: fullOrder.Cafeteria?.longitude ?? null,
    });
    emitAdminOrderUpdate(order.cafeteriaId, { 
      orderId: order.id, 
      status: "ACCEPTED",
      orderType: order.orderType,
    });

    res.json({ message: "Order accepted", order: sanitizedOrder });
  } catch (err) {
    console.error("ACCEPT ORDER ERROR:", err);
    res.status(500).json({ message: "Error accepting order" });
  }
};

export const rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.user.id;

    const partner = await DeliveryPartner.findByPk(partnerId);
    const order = await Order.findByPk(orderId);

    if (!order || !partner) return res.status(404).json({ message: "Not found" });

    // Reset rejection count if it's a new day
    const today = new Date().toISOString().split('T')[0];
    const lastReset = partner.lastRejectionReset ? partner.lastRejectionReset.toISOString().split('T')[0] : null;

    if (lastReset !== today) {
      partner.rejectionCount = 0;
      partner.lastRejectionReset = new Date();
    }

    if (partner.rejectionCount >= 3) {
      return res.status(400).json({ message: "Daily rejection limit (3) reached" });
    }

    // Process rejection
    partner.rejectionCount += 1;
    await partner.save();

    order.deliveryPartnerId = null;
    order.status = "READY"; // Reset status back to READY
    await order.save();

    // Notify Admin that it needs reassignment
    emitAdminOrderUpdate(order.cafeteriaId, { orderId: order.id, status: "READY", message: "Delivery partner rejected assignment" });

    res.json({ message: "Order rejected", rejectionCount: partner.rejectionCount });
  } catch (err) {
    console.error("REJECT ORDER ERROR:", err);
    res.status(500).json({ message: "Error rejecting order" });
  }
};

// ==========================================
// 2. STATUS UPDATES (Workflow)
// ==========================================

export const updateToPickedUp = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findOne({ 
      where: { 
        id: orderId, 
        deliveryPartnerId: partnerId,
        status: ["ASSIGNED", "ACCEPTED"] // Allow pickup if assigned or explicitly accepted
      } 
    });
    if (!order) return res.status(404).json({ message: "Order not found, not assigned to you, or not in a pickable state" });

    order.status = "PICKED_UP";
    order.pickedUpAt = new Date();
    
    // Automatically generate 6-digit OTP on pickup
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    order.deliveryOtp = otp;
    order.deliveryOtpExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity for delivery
    
    await order.save();

    const fullOrder = await Order.findByPk(orderId, {
      include: [
        { model: Cafeteria, as: 'Cafeteria', attributes: ['latitude', 'longitude'] },
        { model: DeliveryPartner, attributes: ['name', 'lastLat', 'lastLong'] }
      ]
    });

    emitOrderStatusToUser(order.studentId, { 
      orderId: order.id, 
      status: "OUT_FOR_DELIVERY",
      partnerName: fullOrder.DeliveryPartner?.name ?? null,
      partnerLat: fullOrder.DeliveryPartner?.lastLat ?? null,
      partnerLng: fullOrder.DeliveryPartner?.lastLong ?? null,
      cafeteriaLat: fullOrder.Cafeteria?.latitude ?? null,
      cafeteriaLng: fullOrder.Cafeteria?.longitude ?? null,
      customerLat: fullOrder.latitude ?? null,
      customerLng: fullOrder.longitude ?? null,
      deliveryOtp: order.deliveryOtp, // 🔥 Include OTP here
    });

    // Also emit specifically to the OTP room
    emitDeliveryOtp(order.studentId, { orderId: order.id, otp: order.deliveryOtp });

    emitAdminOrderUpdate(order.cafeteriaId, { orderId: order.id, status: "PICKED_UP" });

    res.json({ message: "Order marked as PICKED_UP", order });
  } catch (err) {
    console.error("PICKED_UP ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
};

export const updateToOutForDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findOne({ where: { id: orderId, deliveryPartnerId: partnerId } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = "OUT_FOR_DELIVERY";
    await order.save();

    const fullOrder = await Order.findByPk(orderId, {
      include: [
        { model: Cafeteria, as: 'Cafeteria', attributes: ['latitude', 'longitude'] },
        { model: DeliveryPartner, attributes: ['name', 'lastLat', 'lastLong'] }
      ]
    });

    emitOrderStatusToUser(order.studentId, { 
      orderId: order.id, 
      status: "OUT_FOR_DELIVERY",
      partnerName: fullOrder.DeliveryPartner?.name ?? null,
      partnerLat: fullOrder.DeliveryPartner?.lastLat ?? null,
      partnerLng: fullOrder.DeliveryPartner?.lastLong ?? null,
      cafeteriaLat: fullOrder.Cafeteria?.latitude ?? null,
      cafeteriaLng: fullOrder.Cafeteria?.longitude ?? null,
      customerLat: fullOrder.latitude ?? null,
      customerLng: fullOrder.longitude ?? null,
    });
    emitAdminOrderUpdate(order.cafeteriaId, { orderId: order.id, status: "OUT_FOR_DELIVERY" });

    res.json({ message: "Order is OUT_FOR_DELIVERY", order });
  } catch (err) {
    console.error("OUT_FOR_DELIVERY ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
};

// ==========================================
// 3. OTP LOGIC
// ==========================================

export const generateDeliveryOtp = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findOne({ 
      where: { id: orderId, deliveryPartnerId: partnerId },
      include: [{ model: User, attributes: ['id'] }]
    });
    
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    order.deliveryOtp = otp;
    order.deliveryOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins validity
    await order.save();

    // Emit to User
    emitDeliveryOtp(order.studentId, { orderId: order.id, otp });

    res.json({ message: "OTP generated", expiresAt: order.deliveryOtpExpiresAt });
  } catch (err) {
    console.error("GENERATE OTP ERROR:", err);
    res.status(500).json({ message: "OTP generation failed" });
  }
};

export const verifyDeliveryOtp = async (req, res) => {
  try {
    const { orderId, otp } = req.body;
    const partnerId = req.user.id;

    const order = await Order.findOne({ where: { id: orderId, deliveryPartnerId: partnerId } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.deliveryOtp || order.deliveryOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Success flow
    order.status = "DELIVERED";
    await order.save();

    // Notify User and Admin about DELIVERED
    emitOrderStatusToUser(order.studentId, { orderId: order.id, status: "DELIVERED" });
    emitAdminOrderUpdate(order.cafeteriaId, { orderId: order.id, status: "DELIVERED" });

    // Also mark as COMPLETED and emit that too
    order.status = "COMPLETED";
    order.deliveryOtp = null; // clear OTP immediately
    await order.save();

    emitOrderStatusToUser(order.studentId, { orderId: order.id, status: "COMPLETED" });
    emitAdminOrderUpdate(order.cafeteriaId, { orderId: order.id, status: "COMPLETED" });

    res.json({ message: "Delivery verified successfully" });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};
