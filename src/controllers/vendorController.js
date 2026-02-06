// ===================================================================
// FILE: controllers/vendorController.js
// Cashfree Vendor Management (Split Settlement)
// ===================================================================

import { Vendor, Cafeteria } from "../models/index.js";
import axios from "axios";

// ===================================================================
// 🔧 HELPER: Get Cashfree credentials based on environment
// ===================================================================
const getCashfreeCredentials = () => {
    const isSandbox = process.env.CASHFREE_ENV !== "production";

    return {
        clientId: isSandbox
            ? process.env.CASHFREE_SANDBOX_CLIENT_ID
            : process.env.CASHFREE_PRODUCTION_CLIENT_ID,
        clientSecret: isSandbox
            ? process.env.CASHFREE_SANDBOX_CLIENT_SECRET
            : process.env.CASHFREE_PRODUCTION_CLIENT_SECRET,
        baseUrl: isSandbox
            ? "https://sandbox.cashfree.com/pg"
            : "https://api.cashfree.com/pg",
    };
};

// ===================================================================
// ✅ REGISTER VENDOR WITH CASHFREE
// ===================================================================
export const registerVendor = async (req, res) => {
    try {
        const {
            cafeteriaId,
            vendorName,
            vendorEmail,
            vendorPhone,
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
        } = req.body;

        // 1️⃣ Validate required fields
        if (!cafeteriaId || !vendorName || !vendorEmail || !vendorPhone ||
            !accountHolderName || !accountNumber || !ifscCode) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields for vendor registration",
            });
        }

        // 2️⃣ Check if cafeteria exists
        const cafeteria = await Cafeteria.findByPk(cafeteriaId);
        if (!cafeteria) {
            return res.status(404).json({
                success: false,
                message: "Cafeteria not found",
            });
        }

        // 3️⃣ Check if vendor already exists
        const existingVendor = await Vendor.findOne({ where: { cafeteriaId } });
        if (existingVendor) {
            return res.status(400).json({
                success: false,
                message: "Vendor already registered for this cafeteria",
                vendor: existingVendor,
            });
        }

        // 4️⃣ Create internal vendor ID
        const vendorId = `VENDOR_${cafeteriaId}`;

        // 5️⃣ Register vendor with Cashfree
        const { clientId, clientSecret, baseUrl } = getCashfreeCredentials();

        console.log("🚀 Registering vendor with Cashfree...");
        console.log("Vendor ID:", vendorId);
        console.log("Cafeteria:", vendorName);

        try {
            const cashfreeResponse = await axios.post(
                `${baseUrl}/easy-split/vendors`,
                {
                    vendor_id: vendorId,
                    status: "ACTIVE", // Set as active immediately for sandbox
                    name: vendorName,
                    email: vendorEmail,
                    phone: vendorPhone,
                    verify_account: false, // Set to true in production
                    dashboard_access: true,
                    schedule_option: 1, // Daily settlement
                    bank: [
                        {
                            account_holder_name: accountHolderName,
                            account_number: accountNumber,
                            ifsc: ifscCode,
                        },
                    ],
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-client-id": clientId,
                        "x-client-secret": clientSecret,
                        "x-api-version": "2023-08-01",
                    },
                }
            );

            console.log("✅ Cashfree vendor created:", cashfreeResponse.data);

            // 6️⃣ Save vendor to database
            const vendor = await Vendor.create({
                cafeteriaId,
                vendorId,
                cashfreeVendorId: cashfreeResponse.data.vendor_id || vendorId,
                vendorName,
                vendorEmail,
                vendorPhone,
                accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
                status: "ACTIVE", // Sandbox auto-approves
                activatedAt: new Date(),
            });

            return res.status(201).json({
                success: true,
                message: "Vendor registered successfully with Cashfree",
                vendor,
                cashfreeResponse: cashfreeResponse.data,
            });

        } catch (cashfreeError) {
            console.error("❌ Cashfree vendor registration failed:", cashfreeError.response?.data || cashfreeError.message);

            // Save vendor with PENDING_KYC status if Cashfree fails
            const vendor = await Vendor.create({
                cafeteriaId,
                vendorId,
                vendorName,
                vendorEmail,
                vendorPhone,
                accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
                status: "PENDING_KYC",
                rejectionReason: cashfreeError.response?.data?.message || cashfreeError.message,
            });

            return res.status(500).json({
                success: false,
                message: "Vendor saved locally but Cashfree registration failed",
                error: cashfreeError.response?.data || cashfreeError.message,
                vendor,
            });
        }

    } catch (error) {
        console.error("❌ Vendor registration error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during vendor registration",
            error: error.message,
        });
    }
};

// ===================================================================
// ✅ GET VENDOR BY CAFETERIA ID
// ===================================================================
export const getVendorByCafeteria = async (req, res) => {
    try {
        const { cafeteriaId } = req.params;

        const vendor = await Vendor.findOne({
            where: { cafeteriaId },
            include: [
                {
                    model: Cafeteria,
                    attributes: ["id", "name", "address"],
                },
            ],
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found for this cafeteria",
            });
        }

        return res.json({
            success: true,
            vendor,
        });
    } catch (error) {
        console.error("❌ Get vendor error:", error);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

// ===================================================================
// ✅ GET ALL VENDORS
// ===================================================================
export const getAllVendors = async (req, res) => {
    try {
        const vendors = await Vendor.findAll({
            include: [
                {
                    model: Cafeteria,
                    attributes: ["id", "name", "address"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            success: true,
            count: vendors.length,
            vendors,
        });
    } catch (error) {
        console.error("❌ Get all vendors error:", error);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

// ===================================================================
// ✅ UPDATE VENDOR STATUS
// ===================================================================
export const updateVendorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found",
            });
        }

        const updates = { status };
        if (status === "ACTIVE") {
            updates.activatedAt = new Date();
            updates.rejectionReason = null;
        } else if (status === "REJECTED") {
            updates.rejectionReason = rejectionReason;
        }

        await vendor.update(updates);

        return res.json({
            success: true,
            message: `Vendor status updated to ${status}`,
            vendor,
        });
    } catch (error) {
        console.error("❌ Update vendor status error:", error);
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

// ===================================================================
// 🔧 HELPER FUNCTION: Get Vendor by Cafeteria ID (for internal use)
// ===================================================================
export const getVendorByCafeteriaId = async (cafeteriaId) => {
    return await Vendor.findOne({
        where: { cafeteriaId, status: "ACTIVE" },
    });
};
