// import express from 'express';
// import { auth, requireRole } from '../middleware/auth.js';
// import { 
//   getAdminOrders, 
//   updateOrderStatus, 
//   getMyCafeteriaQR 
// } from '../controllers/adminOrderController.js';

// const router = express.Router();

// // Fetch orders for the cafeteria dashboard
// router.get(
//   "/orders", 
//   auth, 
//   requireRole(['staff', 'admin']), // Allows both roles
//   getAdminOrders
// );

// // Update status (PAID -> PREPARING -> READY)
// router.patch(
//   "/orders/:id/status", 
//   auth, 
//   requireRole(['staff', 'admin']), 
//   updateOrderStatus
// );

// // Display the Static QR code for scanning
// router.get(
//   "/cafeteria/qr", 
//   auth, 
//   requireRole(['staff', 'admin']), // Fixed: ensure this matches your DB role
//   getMyCafeteriaQR
// );

// export default router;
import express from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { getAdminOrders, updateOrderStatus, getMyCafeteriaQR } from '../controllers/adminOrderController.js';

const router = express.Router();

router.get("/orders", auth, requireRole(['admin']), getAdminOrders); // change ['staff', 'admin'] → ['admin'] if no staff role
router.patch("/orders/:id/status", auth, requireRole(['admin']), updateOrderStatus);
router.get("/cafeteria/qr", auth, requireRole(['admin']), getMyCafeteriaQR);

export default router;