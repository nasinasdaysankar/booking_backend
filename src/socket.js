let ioInstance = null;

export const initSocket = (io) => {
  ioInstance = io;
  console.log("🧠 Socket instance stored");
};

// ================= ADMIN: NEW ORDER =================
export const emitNewOrder = (cafeteriaId, payload) => {
  if (!ioInstance) {
    console.log("❌ Socket not initialized");
    return;
  }

  const room = `cafeteria_${cafeteriaId}`;
  console.log("📢 Emitting NEW_ORDER to:", room);

  ioInstance.to(room).emit("NEW_ORDER", payload);
};

// ================= PARTNER: NEW ASSIGNMENT =================
export const emitDeliveryAssignment = (partnerId, payload) => {
  if (!ioInstance) return;

  const room = `partner_${partnerId}`;
  console.log("📢 Emitting NEW_ASSIGNMENT to:", room);

  ioInstance.to(room).emit("NEW_ASSIGNMENT", payload);
};

// ================= USER: ORDER STATUS UPDATE =================
// ================= USER: ORDER STATUS UPDATE =================
export const emitOrderStatusToUser = (studentId, payload) => {
  if (!ioInstance) {
    console.log("❌ Socket not initialized");
    return;
  }

  const room = `user_${studentId}`;
  console.log("📢 Emitting ORDER_STATUS_UPDATE to:", room);

  ioInstance.to(room).emit("ORDER_STATUS_UPDATE", payload);
};

// ================= USER: PARTNER LOCATION UPDATE =================
export const emitPartnerLocationToUser = (studentId, payload) => {
  if (!ioInstance) return;

  const room = `user_${studentId}`;
  console.log("📢 Emitting PARTNER_LOCATION_UPDATE to:", room);

  ioInstance.to(room).emit("PARTNER_LOCATION_UPDATE", payload);
};

// ================= USER: DELIVERY OTP =================
export const emitDeliveryOtp = (studentId, payload) => {
  if (!ioInstance) return;

  const room = `user_${studentId}`;
  console.log("📢 Emitting DELIVERY_OTP to:", room);

  ioInstance.to(room).emit("DELIVERY_OTP", payload);
};

// ================= ADMIN: ORDER STATUS UPDATE =================
export const emitAdminOrderUpdate = (cafeteriaId, payload) => {
  if (!ioInstance) return;

  const room = `cafeteria_${cafeteriaId}`;
  console.log("📢 Emitting ORDER_STATUS_UPDATE (Admin) to:", room);

  ioInstance.to(room).emit("ORDER_STATUS_UPDATE", payload);
};

// ================= ADMIN: STOCK UPDATE/ALERT =================
export const emitStockUpdate = (cafeteriaId, payload) => {
  if (!ioInstance) {
    console.log("❌ [STOCK] ioInstance is null — cannot emit");
    return;
  }

  const room = `cafeteria_${cafeteriaId}`;
  console.log(`📢 [STOCK] Emitting STOCK_UPDATE to room '${room}'`);

  ioInstance.to(room).emit("STOCK_UPDATE", payload);

  // Log room membership asynchronously (non-blocking, diagnostic only)
  ioInstance.in(room).fetchSockets().then(sockets => {
    console.log(`📊 [STOCK] Room '${room}' has ${sockets.length} socket(s) after emit`);
  }).catch(() => {});
};

// ================= ADMIN & USER: CAFETERIA UPDATE =================
export const emitCafeteriaUpdate = (cafeteriaId, payload) => {
  if (!ioInstance) return;

  console.log(`📢 Emitting global CAFETERIA_UPDATE for cafeteria ${cafeteriaId}`);

  // Broadcast to all connected clients (users and admins)
  ioInstance.emit("CAFETERIA_UPDATE", { cafeteriaId, ...payload });
};

// ================= SUPPORT TICKETS: REAL-TIME CHAT =================
export const emitSupportMessage = (ticketId, payload) => {
  if (!ioInstance) {
    console.log("❌ [SUPPORT] Socket not initialized");
    return;
  }

  const room = `ticket_${ticketId}`;
  console.log(`📢 [SUPPORT] Emitting SUPPORT_MESSAGE to room '${room}'`);

  ioInstance.to(room).emit("SUPPORT_MESSAGE", payload);
};
