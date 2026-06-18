import express from "express";
import {
    getSupportCategories,
    getAdminSupportCategories,
    getDeliverySupportCategories,
    createSupportTicket,
    getMyTickets,
    getAllTickets,
    getDeliverySupportTickets,
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

// Get predefined support categories & questions (users)
router.get("/categories", auth, getSupportCategories);

// Get admin-specific support categories & questions (admin app)
router.get("/admin-categories", eitherAuth, getAdminSupportCategories);

// Get delivery-specific support categories & questions (delivery app)
router.get("/delivery-categories", eitherAuth, getDeliverySupportCategories);

// Submit a new support ticket (user, admin, or delivery)
router.post("/create", eitherAuth, createSupportTicket);

// Get my support tickets (user, admin, or delivery)
router.get("/my-tickets", eitherAuth, getMyTickets);


// ============================================
// ADMIN/OWNER ROUTES (superadmin only)
// ============================================

// Get all user-source tickets
router.get("/all", superadminAuth, getAllTickets);

// Get all admin-source tickets
router.get("/admin/all", superadminAuth, getAdminSupportTickets);

// Get all delivery-source tickets
router.get("/delivery/all", superadminAuth, getDeliverySupportTickets);

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
