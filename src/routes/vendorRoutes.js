// ===================================================================
// FILE: routes/vendorRoutes.js
// Vendor Management Routes
// ===================================================================

import express from "express";
import {
    registerVendor,
    getVendorByCafeteria,
    getAllVendors,
    updateVendorStatus,
} from "../controllers/vendorController.js";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// ✅ Register new vendor (Admin only)
router.post("/register", auth, requireRole(["admin"]), registerVendor);

// ✅ Get vendor by cafeteria ID
router.get("/cafeteria/:cafeteriaId", auth, requireRole(["admin"]), getVendorByCafeteria);

// ✅ Get all vendors
router.get("/", auth, requireRole(["admin"]), getAllVendors);

// ✅ Update vendor status (for KYC approval)
router.put("/:id/status", auth, requireRole(["admin"]), updateVendorStatus);

export default router;
