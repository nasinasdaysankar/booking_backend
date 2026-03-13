import { SupportTicket, User } from "../models/index.js";

// ============================================
// PREDEFINED SUPPORT CATEGORIES & QUESTIONS
// These are served to the user app so they can only select from these
// ============================================
const SUPPORT_CATEGORIES = {
    "Order Issues": [
        "My order is delayed",
        "I received the wrong items",
        "My order was not delivered",
        "I want to cancel my order",
        "Order shows delivered but I didn't receive it",
    ],
    "Payment Issues": [
        "Payment was deducted but order not placed",
        "I was charged twice",
        "Refund not received",
        "Payment failed but amount deducted",
        "UPI payment stuck",
    ],
    "Account Issues": [
        "Unable to login",
        "OTP not received",
        "Want to change my phone number",
        "Want to change my email",
        "Account is locked/blocked",
    ],
    "App Issues": [
        "App is crashing",
        "App is very slow",
        "Unable to load menu",
        "Notification not received",
        "QR Scanner not working",
    ],
    "Other": [
        "I have a different issue (describe below)",
    ],
};

// ============================================
// GET SUPPORT CATEGORIES (for user app)
// ============================================
export const getSupportCategories = async (req, res) => {
    try {
        return res.json({
            success: true,
            categories: SUPPORT_CATEGORIES,
        });
    } catch (error) {
        console.error("❌ getSupportCategories ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// CREATE SUPPORT TICKET (user submits)
// ============================================
export const createSupportTicket = async (req, res) => {
    try {
        const userId = req.user.id;
        const { category, question, description, platform } = req.body;

        if (!category || !question) {
            return res.status(400).json({
                success: false,
                message: "Category and question are required",
            });
        }

        // Validate category exists
        if (!SUPPORT_CATEGORIES[category]) {
            return res.status(400).json({
                success: false,
                message: "Invalid category",
            });
        }

        // Validate question exists in category
        if (!SUPPORT_CATEGORIES[category].includes(question)) {
            return res.status(400).json({
                success: false,
                message: "Invalid question for this category",
            });
        }

        const ticket = await SupportTicket.create({
            userId,
            category,
            question,
            description: description || "",
            platform: platform || "Unknown",
            status: "open",
        });

        console.log(`🎫 New support ticket #${ticket.id} from user ${userId}: ${category} → ${question}`);

        return res.status(201).json({
            success: true,
            message: "Support ticket submitted successfully",
            ticket,
        });
    } catch (error) {
        console.error("❌ createSupportTicket ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// GET MY TICKETS (user sees their tickets)
// ============================================
export const getMyTickets = async (req, res) => {
    try {
        const userId = req.user.id;

        const tickets = await SupportTicket.findAll({
            where: { userId },
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            success: true,
            tickets,
        });
    } catch (error) {
        console.error("❌ getMyTickets ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// GET ALL TICKETS (admin/owner view)
// ============================================
export const getAllTickets = async (req, res) => {
    try {
        const { status, category } = req.query;

        const where = {};
        if (status) where.status = status;
        if (category) where.category = category;

        const tickets = await SupportTicket.findAll({
            where,
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["id", "name", "email", "phone"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            success: true,
            count: tickets.length,
            data: tickets,
        });
    } catch (error) {
        console.error("❌ getAllTickets ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// RESOLVE TICKET (admin/owner resolves)
// ============================================
export const resolveTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminResponse, status } = req.body;

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Ticket not found",
            });
        }

        // Update ticket
        ticket.adminResponse = adminResponse || ticket.adminResponse;
        ticket.status = status || "resolved";
        if (status === "resolved" || (!status && adminResponse)) {
            ticket.resolvedAt = new Date();
            ticket.status = "resolved";
        }
        await ticket.save();

        console.log(`✅ Ticket #${id} ${ticket.status} by admin`);

        return res.json({
            success: true,
            message: `Ticket ${ticket.status} successfully`,
            ticket,
        });
    } catch (error) {
        console.error("❌ resolveTicket ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};
