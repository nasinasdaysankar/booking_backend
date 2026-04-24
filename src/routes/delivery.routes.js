import express from "express";
import { 
  partnerLogin, 
  getAssignedOrders, 
  updatePartnerFcmToken, 
  getPartnerPerformance, 
  getPartnerHistory,
  updateLocation,
  getPartnerLocation,
  updatePartnerStatus
} from "../controllers/deliveryController.js";
import {
  acceptOrder,
  rejectOrder,
  updateToPickedUp,
  updateToOutForDelivery,
  generateDeliveryOtp,
  verifyDeliveryOtp 
} from "../controllers/deliveryWorkflowController.js";
import {
  reportDeliveryIssue,
  markUnableToDeliver,
  resolveIssue
} from "../controllers/deliverySupportController.js";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// 🔓 PUBLIC ROUTE
router.post("/login", partnerLogin);
router.patch("/status/:id", updatePartnerStatus);

// 🔐 PROTECTED ROUTES (Delivery Partners only)
router.use(auth);
router.use(requireRole(["DELIVERY"]));

router.get("/orders", getAssignedOrders);
router.get("/performance", getPartnerPerformance);
router.get("/history", getPartnerHistory);
router.post("/location", updateLocation);
router.get("/partner-location/:orderId", getPartnerLocation);
router.post("/fcm-token", updatePartnerFcmToken);
router.post("/accept", acceptOrder);
router.post("/reject", rejectOrder);
router.post("/picked-up", updateToPickedUp);
router.post("/out-for-delivery", updateToOutForDelivery);
router.post("/generate-otp", generateDeliveryOtp);
router.post("/verify-otp", verifyDeliveryOtp);

// 🆘 SUPPORT & EXCEPTIONS
router.post("/support/report", reportDeliveryIssue);
router.post("/support/undeliverable", markUnableToDeliver);
router.post("/support/resolve", resolveIssue);

export default router;
