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

// ================= ADMIN: ORDER STATUS UPDATE =================
export const emitAdminOrderUpdate = (cafeteriaId, payload) => {
  if (!ioInstance) return;

  const room = `cafeteria_${cafeteriaId}`;
  console.log("📢 Emitting ORDER_STATUS_UPDATE (Admin) to:", room);

  ioInstance.to(room).emit("ORDER_STATUS_UPDATE", payload);
};

// ================= ADMIN: STOCK UPDATE/ALERT =================
export const emitStockUpdate = async (cafeteriaId, payload) => {
  if (!ioInstance) {
    console.log("❌ [STOCK] ioInstance is null — cannot emit");
    return;
  }

  const room = `cafeteria_${cafeteriaId}`;
  const sockets = await ioInstance.in(room).fetchSockets();
  console.log(`📢 [STOCK] Emitting STOCK_UPDATE to room '${room}' — ${sockets.length} socket(s) in room`);

  ioInstance.to(room).emit("STOCK_UPDATE", payload);
};
