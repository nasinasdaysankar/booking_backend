let ioInstance = null;

export const initSocket = (io) => {
  ioInstance = io;
  console.log("🧠 Socket instance stored");
};

export const emitNewOrder = (cafeteriaId, payload) => {
  if (!ioInstance) {
    console.log("❌ Socket not initialized");
    return;
  }

  const room = `cafeteria_${cafeteriaId}`;
  console.log("📢 Emitting NEW_ORDER to:", room);

  ioInstance.to(room).emit("NEW_ORDER", payload);
};
