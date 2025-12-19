// // userOrderController.js - FIXED VERSION
// import { CafeteriaQr, Order } from "../models/index.js";
// import { Op } from "sequelize";

// console.log("✅ LOADED: userOrderController.js");

// export const scanStaticCafeteriaQR = async (req, res) => {
//   try {
//     const { qrToken } = req.body;
//     const studentId = req.user.id; // From auth middleware
//     const cafeteriaId = req.user.cafeteriaId; // From auth middleware

//     console.log("🔍 QR SCAN REQUEST:");
//     console.log("   Student ID:", studentId);
//     console.log("   QR Token:", qrToken);
//     console.log("   Cafeteria ID:", cafeteriaId);
//     console.log("   Auth User:", req.user);

//     // ❌ VALIDATION
//     if (!qrToken || qrToken.trim() === "") {
//       return res.status(400).json({
//         success: false,
//         message: "QR token is required"
//       });
//     }

//     if (!studentId) {
//       return res.status(401).json({
//         success: false,
//         message: "Not authenticated - no student ID"
//       });
//     }

//     // 1️⃣ Find which cafeteria this QR belongs to
//     const cafeteriaQr = await CafeteriaQr.findOne({
//       where: { qrToken: qrToken.trim() }
//     });

//     console.log("🔎 CafeteriaQR lookup result:", cafeteriaQr);

//     if (!cafeteriaQr) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid QR Code"
//       });
//     }

//     // 2️⃣ Find the most recent ACTIVE order for THIS student at THIS cafeteria
//     const order = await Order.findOne({
//       where: {
//         studentId,
//         cafeteriaId: cafeteriaQr.cafeteriaId,
//         status: {
//           [Op.in]: ["PAID", "PREPARING", "READY"]
//         }
//       },
//       order: [["createdAt", "DESC"]]
//     });

//     console.log("📦 Order lookup result:", order);

//     // 3️⃣ If NO active order exists
//     if (!order) {
//       const lastPickedUp = await Order.findOne({
//         where: {
//           studentId,
//           cafeteriaId: cafeteriaQr.cafeteriaId,
//           status: "PICKED_UP"
//         },
//         order: [["updatedAt", "DESC"]]
//       });

//       if (lastPickedUp) {
//         return res.status(400).json({
//           success: false,
//           message: "You have already picked up your last order"
//         });
//       }

//       return res.status(404).json({
//         success: false,
//         message: "No active orders found for this cafeteria"
//       });
//     }

//     // 4️⃣ Return status-based response
//     let uiMessage = "";
//     let canPickUp = false;

//     switch (order.status) {
//       case "PAID":
//         uiMessage = "⏳ Order received! Waiting for kitchen to start.";
//         break;
//       case "PREPARING":
//         uiMessage = "👨‍🍳 We are cooking your meal!";
//         break;
//       case "READY":
//         uiMessage = "✅ Your order is ready! Pick it up now.";
//         canPickUp = true;
//         break;
//     }

//     console.log("✅ QR SCAN SUCCESS - Order:", order.id, "Status:", order.status);

//     return res.json({
//       success: true,
//       orderId: order.id,
//       status: order.status,
//       message: uiMessage,
//       canPickUp: canPickUp
//     });

//   } catch (error) {
//     console.error("❌ QR SCAN ERROR:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error during QR scan"
//     });
//   }
// };

// export const confirmOrderPickup = async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     const studentId = req.user.id;

//     console.log("🎉 PICKUP CONFIRMATION:");
//     console.log("   Order ID:", orderId);
//     console.log("   Student ID:", studentId);

//     const order = await Order.findOne({
//       where: { id: orderId, studentId }
//     });

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found"
//       });
//     }

//     if (order.status !== "READY") {
//       return res.status(400).json({
//         success: false,
//         message: `Order is not ready. Current status: ${order.status}`
//       });
//     }

//     // Mark as picked up and clear QR
//     await order.update({
//       status: "PICKED_UP",
//       qrToken: null,
//       qrExpiresAt: null
//     });

//     console.log("✅ Order marked PICKED_UP:", orderId);

//     return res.json({
//       success: true,
//       message: "Order picked up successfully!",
//       receipt: {
//         orderId: order.id,
//         billId: order.billId,
//         totalAmount: order.totalAmount,
//         pickedAt: new Date(),
//         status: "PICKED_UP"
//       }
//     });

//   } catch (error) {
//     console.error("❌ PICKUP ERROR:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error during pickup"
//     });
//   }
// };
import { CafeteriaQr, Order } from "../models/index.js";
import { Op } from "sequelize";

export const scanStaticCafeteriaQR = async (req, res) => {
  try {
    const { qrToken } = req.body;
    const studentId = req.user.id;

    const cafeteriaQr = await CafeteriaQr.findOne({ where: { qrToken: qrToken?.trim() } });
    if (!cafeteriaQr) return res.status(400).json({ success: false, message: "Invalid QR" });

    // Find latest active order for this student at this cafeteria
    const order = await Order.findOne({
      where: {
        studentId,
        cafeteriaId: cafeteriaQr.cafeteriaId,
        status: { [Op.in]: ["PAID", "PREPARING", "READY"] }
      },
      order: [["createdAt", "DESC"]]
    });

    if (!order) return res.status(404).json({ success: false, message: "No active order found" });

    let msg = order.status === "READY" ? "✅ Ready for pickup!" : "👨‍🍳 Cooking your order...";
    res.json({ success: true, orderId: order.id, status: order.status, message: msg, canPickUp: order.status === "READY" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Scan error" });
  }
};

export const confirmOrderPickup = async (req, res) => {
  try {
    const { orderId } = req.body;
    const studentId = req.user.id;

    const order = await Order.findOne({ where: { id: orderId, studentId } });

    if (!order || order.status !== "READY") {
      return res.status(400).json({ success: false, message: "Order not ready or not yours" });
    }

    await order.update({ status: "PICKED_UP" });
    res.json({ success: true, message: "🎉 Picked up successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Pickup error" });
  }
};