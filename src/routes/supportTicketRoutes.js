import express from "express";
import {
    getSupportCategories,
    getAdminSupportCategories,
    createSupportTicket,
    getMyTickets,
    getAllTickets,
    resolveTicket,
    verifyTicketResolution,
} from "../controllers/supportTicketController.js";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// ============================================
// USER ROUTES (authenticated users)
// ============================================

// Get predefined support categories & questions
router.get("/categories", auth, getSupportCategories);

// Get admin-specific support categories & questions
router.get("/admin-categories", auth, getAdminSupportCategories);

// Submit a new support ticket
router.post("/create", auth, createSupportTicket);

// Get my support tickets
router.get("/my-tickets", auth, getMyTickets);

// Verify/submit feedback on a resolved ticket
router.put("/my-tickets/:id/verify-resolution", auth, verifyTicketResolution);

// ============================================
// ADMIN/OWNER ROUTES (superadmin only)
// ============================================

// Get all tickets (with optional filters)
router.get("/all", auth, requireRole(["superadmin"]), getAllTickets);

// Resolve/update a ticket
router.put("/:id/resolve", auth, requireRole(["superadmin"]), resolveTicket);

export default router;
