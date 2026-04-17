import express from "express";
import {
    getSupportCategories,
    getAdminSupportCategories,
    createSupportTicket,
    getMyTickets,
    getAllTickets,
    resolveTicket,
    verifyTicketResolution,
    addTicketMessage,
    getTicketMessages,
    getAdminSupportTickets,
    toggleMedia,
} from "../controllers/supportTicketController.js";
import { auth, requireRole, superadminAuth, eitherAdminAuth, eitherAuth } from "../middleware/auth.js";

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


// ============================================
// ADMIN/OWNER ROUTES (superadmin only)
// ============================================

// Get all user-source tickets
router.get("/all", superadminAuth, getAllTickets);

// Get all admin-source tickets
router.get("/admin/all", superadminAuth, getAdminSupportTickets);

// Resolve/update a ticket
router.put("/:id/resolve", superadminAuth, resolveTicket);

// Toggle media support for a ticket
router.put("/:id/toggle-media", superadminAuth, toggleMedia);

// --- Conversation Threads ---

// Add a message to a ticket (Conversational) - Allows User app, Admin app or Superadmin Dashboard
router.post("/:id/messages", eitherAuth, addTicketMessage);

// Get all messages for a ticket (Thread history)
router.get("/:id/messages", eitherAuth, getTicketMessages);

// Verify/submit feedback on a resolved ticket
router.put("/:id/verify-resolution", eitherAuth, verifyTicketResolution);

export default router;
