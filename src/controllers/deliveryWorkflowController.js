import { Order, DeliveryPartner, User, PartnerFcmToken, AdminFcmToken, Cafeteria, MenuItem, OrderItem, UserFcmToken } from "../models/index.js";
import { emitOrderStatusToUser, emitAdminOrderUpdate, emitDeliveryOtp, emitDeliveryAssignment } from "../socket.js";
import { sendPushNotification } from "../utils/notificationUtils.js";
import { Sequelize } from "sequelize";
import admin from "../config/firebaseAdmin.js";
import { generateDeliveryOrderId } from "./paymentController.js";

// ==========================================
// 🛠️ HELPER: FETCH & SANITIZE ORDER FOR NOTIFICATIONS
// ==========================================
const getSanitizedOrderForNotify = async (orderId) => {
  const fullOrder = await Order.findByPk(orderId, {
    include: [
      { 
        model: OrderItem, 
        as: 'items',
        include: [{ model: MenuItem, as: 'menuItem', attributes: ['name'] }]
      },
      { model: User, attributes: ['id', 'name', 'phone'] },
      { model: Cafeteria, as: 'Cafeteria', attributes: ['id', 'name', 'latitude', 'longitude'] },
      { model: DeliveryPartner, attributes: ['id', 'name', 'phone', 'lastLat', 'lastLong'] }
    ]
  });

  if (!fullOrder) return null;

  const plainOrder = fullOrder.get({ plain: true });
  return {
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
    deliveryPartnerName: plainOrder.DeliveryPartner?.name || null,
    deliveryPartnerPhone: plainOrder.DeliveryPartner?.phone || null,
    partnerLat: plainOrder.DeliveryPartner?.lastLat || null,
    partnerLng: plainOrder.DeliveryPartner?.lastLong || null,
    deliveryOrderId: plainOrder.deliveryOrderId,
    readyReminderCount: plainOrder.readyReminderCount
  };
};

// ==========================================
// 0. ASSIGN ORDER (Admin Action)
// ==========================================

export const assignPartner = async (req, res) => {
  try {
    const { orderId, partnerId } = req.body;
    const adminCafeteriaId = req.user.cafeteriaId;

    const order = await Order.findByPk(orderId, {
      include: [{ model: Cafeteria, as: 'Cafeteria', attributes: ['name', 'latitude', 'longitude'] }]
    });
    const partner = await DeliveryPartner.findByPk(partnerId, {
      include: [{ model: Cafeteria, as: 'Cafeteria', attributes: ['name', 'latitude', 'longitude'] }]
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

    // ✅ Ensure deliveryOrderId exists when assigned
    if (!order.deliveryOrderId && order.orderType === 'DELIVERY') {
      order.deliveryOrderId = await generateDeliveryOrderId(order.cafeteriaId, null);
      console.log(`📦 [ASSIGN] Generated missing Delivery ID: ${order.deliveryOrderId}`);
    }

    await order.save();

    // 1. Emit Socket to Partner
    emitDeliveryAssignment(partner.id, {
      orderId: order.id,
      billId: order.billId,
      itemsCount: order.itemCount || 1,
      totalAmount: parseFloat(order.totalAmount || 0),
      status: order.status,
      cafeteriaName: order.Cafeteria?.name || partner.Cafeteria?.name,
      cafeteriaLat: parseFloat(order.Cafeteria?.latitude || partner.Cafeteria?.latitude || 0),
      cafeteriaLng: parseFloat(order.Cafeteria?.longitude || partner.Cafeteria?.longitude || 0),
      customerLat: parseFloat(order.latitude || 0),
      customerLng: parseFloat(order.longitude || 0),
      deliveryAddress: order.deliveryAddress,
      deliveryOrderId: order.deliveryOrderId,
      readyReminderCount: order.readyReminderCount,
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

    // Fetch full order for consistent notifications
    const sanitizedOrder = await getSanitizedOrderForNotify(orderId);

    // Notify others
    emitOrderStatusToUser(order.studentId, { 
      orderId: order.id, 
      status: "ACCEPTED",
      partnerName: sanitizedOrder.deliveryPartnerName,
      partnerPhone: sanitizedOrder.deliveryPartnerPhone,
      partnerLat: sanitizedOrder.partnerLat,
      partnerLng: sanitizedOrder.partnerLng,
      cafeteriaLat: sanitizedOrder.cafeteriaLat,
      cafeteriaLng: sanitizedOrder.cafeteriaLng,
    });
    
    emitAdminOrderUpdate(order.cafeteriaId, sanitizedOrder);

    res.json({ message: "Order accepted", order: sanitizedOrder });
  } catch (err) {
    console.error("ACCEPT ORDER ERROR:", err);
    res.status(500).json({ message: "Error accepting order" });
  }
};

export const rejectOrder = async (req, res) => {
  const { orderId } = req.body;
  const partnerId = req.user?.id;
  console.log(`📥 [REJECT_START] Order: ${orderId}, Partner: ${partnerId}`);

  try {
    const partner = await DeliveryPartner.findByPk(partnerId);
    const order = await Order.findByPk(orderId);

    if (!order) {
      console.log(`❌ [REJECT_FAIL] Order ${orderId} not found`);
      return res.status(404).json({ message: "Order not found" });
    }
    if (!partner) {
      console.log(`❌ [REJECT_FAIL] Partner ${partnerId} not found`);
      return res.status(404).json({ message: "Partner not found" });
    }

    console.log(`✅ [REJECT_FLOW] Found Order #${order.id} (Status: ${order.status}) and Partner ${partner.name}`);

    // Reset rejection count if it's a new day
    const today = new Date().toISOString().split('T')[0];
    const lastReset = partner.lastRejectionReset ? partner.lastRejectionReset.toISOString().split('T')[0] : null;

    if (lastReset !== today) {
      console.log(`♻️ [REJECT_FLOW] Resetting rejection count for ${partner.name}`);
      partner.rejectionCount = 0;
      partner.lastRejectionReset = new Date();
    }

    console.log(`📊 [REJECT_FLOW] Current rejection count: ${partner.rejectionCount}/100`);
    if (partner.rejectionCount >= 100) {
      console.log(`🚫 [REJECT_FAIL] Rejection limit reached for ${partner.name}`);
      return res.status(400).json({ message: "Daily rejection limit (100) reached" });
    }

    // Process rejection
    partner.rejectionCount += 1;
    console.log(`💾 [REJECT_FLOW] Saving partner rejectionCount=${partner.rejectionCount}...`);
    await partner.save();
    console.log(`✅ [REJECT_FLOW] Partner saved successfully`);

    console.log(`💾 [REJECT_FLOW] Updating order ${orderId}: partnerId=null, status=READY...`);
    order.deliveryPartnerId = null;
    order.status = "READY"; // Reset status back to READY
    await order.save();
    console.log(`✅ [REJECT_FLOW] Order saved successfully. New status: ${order.status}`);

    // 🔔 Fetch full order for consistent notifications
    const sanitizedOrder = await getSanitizedOrderForNotify(orderId);

    // 🔔 Notify Admin that it needs reassignment
    console.log(`📡 [REJECT_SOCKET] Emitting update for Order ${orderId} to cafeteria_${order.cafeteriaId}`);
    emitAdminOrderUpdate(order.cafeteriaId, {
      ...sanitizedOrder,
      socketMessage: "Order returned for reassignment" 
    });

    // 📱 Send Push Notification to all admins of this cafeteria
    try {
      console.log(`🔍 [REJECT_PUSH] Searching for admin tokens for cafeteriaId: ${order.cafeteriaId}`);
      const adminTokens = await AdminFcmToken.findAll({ 
        where: { cafeteriaId: order.cafeteriaId } 
      });

      console.log(`🔍 [REJECT_PUSH] Found ${adminTokens.length} tokens for cafeteria ${order.cafeteriaId}`);

      if (adminTokens.length > 0) {
        const tokenList = adminTokens.map(t => t.fcmToken);
        
        console.log(`🔔 Sending REJECT_NOTIFICATION to ${tokenList.length} admins...`);
        
        // Use multicast for multiple tokens
        const response = await admin.messaging().sendEachForMulticast({
          tokens: tokenList,
          notification: {
            title: "Delivery Rejected ❌",
            body: `Order #${order.billId || order.id} has been rejected by ${partner.name}. Please reassign it.`,
          },
          data: {
            orderId: String(order.id),
            type: "DELIVERY_REJECTED",
            partnerName: String(partner.name),
            cafeteriaId: String(order.cafeteriaId)
          },
          android: {
            priority: "high",
            notification: {
              channelId: "high_importance_channel_v2",
              sound: "new_order", // Use new_order sound for urgent reassignment
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: "Delivery Rejected ❌",
                  body: `Order #${order.billId || order.id} has been rejected by ${partner.name}. Please reassign it.`,
                },
                sound: "new_order.caf",
                badge: 1,
              },
            },
          },
        });

        console.log(`✅ [REJECT_PUSH] Success: ${response.successCount}, Failure: ${response.failureCount}`);
        
        // Cleanup stale tokens
        const tokensToDelete = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === "messaging/registration-token-not-registered" ||
              errorCode === "messaging/invalid-registration" ||
              errorCode === "messaging/third-party-auth-error"
            ) {
              tokensToDelete.push(tokenList[idx]);
            }
          }
        });

        if (tokensToDelete.length > 0) {
          await AdminFcmToken.destroy({ where: { fcmToken: tokensToDelete } });
          console.log(`🧹 [REJECT_PUSH] Cleaned up ${tokensToDelete.length} stale tokens`);
        }
      } else {
        console.warn(`⚠️ [REJECT_PUSH] NO ADMIN TOKENS found for cafeteria ${order.cafeteriaId}. No push sent.`);
      }
    } catch (pushErr) {
      console.error("❌ [REJECT_PUSH] ERROR:", pushErr.message);
    }

    console.log(`🏁 [REJECT_DONE] Rejection process completed for Order ${orderId}`);
    res.json({ message: "Order rejected and reassigned" });
  } catch (err) {
    console.error(`🔥 [REJECT_CRIT] FATAL ERROR:`, err);
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
        status: ["ASSIGNED", "ACCEPTED", "READY"] // Allow pickup if assigned, accepted, or marked READY by kitchen
      } 
    });
    if (!order) return res.status(404).json({ message: "Order not found, not assigned to you, or not in a pickable state" });

    order.status = "PICKED_UP";
    order.pickedUpAt = new Date();
    await order.save();

    const sanitizedOrder = await getSanitizedOrderForNotify(orderId);

    emitOrderStatusToUser(order.studentId, { 
      orderId: order.id, 
      status: "PICKED_UP",
      partnerName: sanitizedOrder.deliveryPartnerName,
      partnerLat: sanitizedOrder.partnerLat,
      partnerLng: sanitizedOrder.partnerLng,
      cafeteriaLat: sanitizedOrder.cafeteriaLat,
      cafeteriaLng: sanitizedOrder.cafeteriaLng,
      customerLat: sanitizedOrder.customerLat,
      customerLng: sanitizedOrder.customerLng,
      readyReminderCount: sanitizedOrder.readyReminderCount,
    });

    emitAdminOrderUpdate(order.cafeteriaId, sanitizedOrder);
    
    // 📱 Send Push Notification to User
    try {
      const userTokens = await UserFcmToken.findAll({ where: { userId: order.studentId } });
      if (userTokens.length > 0) {
        await sendPushNotification(
          userTokens.map(t => t.fcmToken),
          "Out for Delivery! 🛵",
          `Your order #${fullOrder.billId || order.id} is on the way.`,
          { 
            orderId: order.id.toString(), 
            type: "OUT_FOR_DELIVERY",
            target_screen: "ORDER_HISTORY",
          },
          order.studentId,
          false, // isAdmin: false (Sending to User App)
          "delivery_updates_channel"
        );
      }
    } catch (pushErr) {
      console.error("❌ [DELIVERY_OTP_PUSH] ERROR:", pushErr.message);
    }

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

    const sanitizedOrder = await getSanitizedOrderForNotify(orderId);

    emitOrderStatusToUser(order.studentId, { 
      orderId: order.id, 
      status: "OUT_FOR_DELIVERY",
      partnerName: sanitizedOrder.deliveryPartnerName,
      partnerLat: sanitizedOrder.partnerLat,
      partnerLng: sanitizedOrder.partnerLng,
      cafeteriaLat: sanitizedOrder.cafeteriaLat,
      cafeteriaLng: sanitizedOrder.cafeteriaLng,
      customerLat: sanitizedOrder.customerLat,
      customerLng: sanitizedOrder.customerLng,
      readyReminderCount: sanitizedOrder.readyReminderCount,
    });
    emitAdminOrderUpdate(order.cafeteriaId, sanitizedOrder);

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

    // 📱 Send Push Notification to User with New OTP
    try {
      const userTokens = await UserFcmToken.findAll({ where: { userId: order.studentId } });
      if (userTokens.length > 0) {
        await sendPushNotification(
          userTokens.map(t => t.fcmToken),
          "Out for Delivery! 🛵",
          `OTP for order #${order.billId || order.id} is ${otp}.`,
          { 
            orderId: order.id.toString(), 
            type: "DELIVERY_OTP_REGENERATED",
            target_screen: "ORDER_HISTORY",
            otp: otp 
          },
          order.studentId,
          false, // isAdmin: false (Sending to User App)
          "delivery_updates_channel"
        );
      }
    } catch (pushErr) {
      console.error("❌ [REGEN_OTP_PUSH] ERROR:", pushErr.message);
    }

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

    // Fetch full order for consistent notifications
    const sanitizedOrder = await getSanitizedOrderForNotify(orderId);

    // Notify User and Admin about DELIVERED
    emitOrderStatusToUser(order.studentId, { orderId: order.id, status: "DELIVERED" });
    emitAdminOrderUpdate(order.cafeteriaId, sanitizedOrder);

    // Also mark as COMPLETED and emit that too
    order.status = "COMPLETED";
    order.deliveryOtp = null; // clear OTP immediately
    await order.save();

    // Fetch again for COMPLETED status
    const finalOrder = await getSanitizedOrderForNotify(orderId);

    emitOrderStatusToUser(order.studentId, { orderId: order.id, status: "COMPLETED" });
    emitAdminOrderUpdate(order.cafeteriaId, finalOrder);

    res.json({ message: "Delivery verified successfully" });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};
