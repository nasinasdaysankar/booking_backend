import { SupportTicket, User } from "../models/index.js";

// ============================================
// PREDEFINED SUPPORT CATEGORIES, QUESTIONS & SOLUTIONS
// ============================================
const SUPPORT_CATEGORIES = {
    "Order Issues": [
        {
            question: "My order is delayed",
            solution: "Orders usually take 15-20 minutes depending on the cafeteria load. If it's taking unusually long, please ensure your payment was successful. Our cafeteria partners are working hard to prepare your meal quickly!",
        },
        {
            question: "I received the wrong items",
            solution: "We apologize for the mix-up! Please double-check your order receipt. If the items received don't match your bill, you can submit a ticket below and our team will resolve it.",
        },
        {
            question: "My order was not delivered",
            solution: "Please check your order status in the app. If it says 'Delivered' but you haven't received it, check with the cafeteria counter immediately. If you still need help, open a ticket below.",
        },
        {
            question: "I want to cancel my order",
            solution: "Orders can only be canceled within a very short window before the kitchen starts preparation. If the status is already 'Preparing', cancellation is no longer possible.",
        },
    ],
    "Payment Issues": [
        {
            question: "Payment was deducted but order not placed",
            solution: "Since this is a payment issue, our team will need to manually check this and issue a refund if applicable. Please provide your email and phone number below so we can contact you to resolve this.",
            requiresContactDetails: true,
        },
        {
            question: "I was charged twice",
            solution: "Since you were charged twice, our team will need to verify the transactions and issue a refund manually. Please provide your contact details below.",
            requiresContactDetails: true,
        },
        {
            question: "Refund not received",
            solution: "To check the status of your refund, our team needs your contact details. Please provide your email and phone number below so we can assist you.",
            requiresContactDetails: true,
        },
        {
            question: "UPI payment stuck",
            solution: "If your UPI payment is stuck, we will need to check the payment gateway logs. Please provide your contact details below so we can issue a refund if it failed.",
            requiresContactDetails: true,
        },
    ],
    "Account Issues": [
        {
            question: "Unable to login",
            solution: "Please ensure you are using the correct email/phone number. If you changed your device, try clearing the app cache and logging in again.",
        },
        {
            question: "Want to change my phone number or email",
            solution: "Currently, you cannot change your primary email/phone from the app yourself. Please submit a request, and our support team will update it for you.",
        },
    ],
    "App Issues": [
        {
            question: "App is crashing or slow",
            solution: "Please try clearing the app cache or updating the app to the latest version from the Play Store/App Store. Restarting your phone can also help.",
        },
    ],
    "Other": [
        {
            question: "I have a different issue (describe below)",
            solution: "Please describe your issue in the text box below. Our support team will review it and get back to you as soon as possible.",
        },
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
        const questionObj = SUPPORT_CATEGORIES[category].find(q => q.question === question);
        if (!questionObj) {
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
        const { adminResponse, status, ownerRequestedConfirmation } = req.body;

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Ticket not found",
            });
        }

        // Update ticket
        ticket.adminResponse = adminResponse || ticket.adminResponse;
        
        if (ownerRequestedConfirmation !== undefined) {
             ticket.ownerRequestedConfirmation = ownerRequestedConfirmation;
        }

        ticket.status = status || "resolved";
        if (status === "resolved" || (!status && adminResponse)) {
            if (ticket.status !== "resolved") {
                ticket.resolvedAt = new Date();
            }
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

// ============================================
// VERIFY TICKET RESOLUTION (user response to admin)
// ============================================
export const verifyTicketResolution = async (req, res) => {
    try {
        const { id } = req.params;
        const { isSolved, email, phone } = req.body;
        const userId = req.user.id;

        const ticket = await SupportTicket.findOne({ where: { id, userId } });
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Ticket not found",
            });
        }

        // Only allow if admin asked for confirmation
        if (!ticket.ownerRequestedConfirmation) {
            return res.status(400).json({
                success: false,
                message: "Confirmation not requested for this ticket",
            });
        }

        if (isSolved) {
            ticket.status = "resolved";
            ticket.ownerRequestedConfirmation = false;
        } else {
            ticket.status = "open"; // Or in_progress
            ticket.ownerRequestedConfirmation = false;
            if (email) ticket.userEmail = email;
            if (phone) ticket.userPhone = phone;
        }

        await ticket.save();

        return res.json({
            success: true,
            message: "Feedback submitted successfully",
            ticket,
        });

    } catch (error) {
        console.error("❌ verifyTicketResolution ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};
