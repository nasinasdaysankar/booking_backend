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
import { authenticateAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Register new vendor (Admin only)
router.post("/register", authenticateAdmin, registerVendor);

// ✅ Get vendor by cafeteria ID
router.get("/cafeteria/:cafeteriaId", authenticateAdmin, getVendorByCafeteria);

// ✅ Get all vendors
router.get("/", authenticateAdmin, getAllVendors);

// ✅ Update vendor status (for KYC approval)
router.put("/:id/status", authenticateAdmin, updateVendorStatus);

export default router;
