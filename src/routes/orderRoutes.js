// import express from 'express';
// const router = express.Router();
// import { auth } from '../middleware/auth.js';
// import { 
//   createOrder, 
//   getMyOrders, 
//   getOrderById 
// } from '../controllers/orderController.js';
// import { 
//   markOrderPaid,
//   scanStaticCafeteriaQR,
//   confirmOrderPickup
// } from '../controllers/adminOrderController.js';

// router.post('/', auth, createOrder);
// router.get('/', auth, getMyOrders);
// router.get('/:id', auth, getOrderById);
// router.post('/mark-paid/:orderId', auth, markOrderPaid);

// // 🔥 NEW STATIC QR FLOW ROUTES
// router.post('/scan-qr', auth, scanStaticCafeteriaQR); // Student scans cafeteria code
// router.post('/confirm-pickup', auth, confirmOrderPickup); // Student clicks "Pick up"

// export default router;
import express from 'express';
const router = express.Router();
import { auth } from '../middleware/auth.js';

// Order-related functions (user placing orders)
import { 
  createOrder, 
  getMyOrders, 
  getOrderById 
} from '../controllers/orderController.js';

// Static QR functions — these are now in userOrderController.js
import { 
  scanStaticCafeteriaQR,
  confirmOrderPickup
} from '../controllers/userOrderController.js';

// Admin-only function (if still needed here; otherwise move to admin routes)
import { markOrderPaid } from '../controllers/adminOrderController.js';

// User order routes
router.post('/', auth, createOrder);
router.get('/', auth, getMyOrders);
router.get('/:id', auth, getOrderById);

// Optional: Admin marks order as paid (you can keep or move this to admin routes)
router.post('/mark-paid/:orderId', auth, markOrderPaid);

// 🔥 STATIC QR FLOW ROUTES (for students/users)
router.post('/scan-qr', auth, scanStaticCafeteriaQR);         // User scans cafeteria QR
router.post('/confirm-pickup', auth, confirmOrderPickup);     // User confirms pickup

export default router;