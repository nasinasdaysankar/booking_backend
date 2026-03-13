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
            solution: "Don't worry! This usually happens due to a bank delay. The amount will be automatically refunded to your original payment method within 3-5 business days. IF you need urgent help, please submit a ticket.",
            requiresContactDetails: true,
        },
        {
            question: "I was charged twice",
            solution: "Duplicate charges are automatically voided by the payment gateway and refunded within 3-5 working days. Please check your bank statement after a few days.",
            requiresContactDetails: true,
        },
        {
            question: "Refund not received",
            solution: "Refunds typically take 5-7 business days to reflect in your account depending on your bank. If it has been more than 7 days, please let us know.",
            requiresContactDetails: true,
        },
        {
            question: "UPI payment stuck",
            solution: "UPI payments can sometimes hit network issues. If your amount was deducted, it will either succeed in a few minutes or be refunded by your bank within 48 hours.",
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
