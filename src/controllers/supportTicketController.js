import { SupportTicket, User } from "../models/index.js";

// ============================================
// PREDEFINED SUPPORT CATEGORIES, QUESTIONS & SOLUTIONS
// ============================================
const SUPPORT_CATEGORIES = {
    "Order Issues": [
        {
            question: "Item not received?",
            solution: "Once your order status changes to 'Ready' or 'Completed',You need to take the order with in 20 Min from the time of order.If you reached before in time please present your digital token at the cafeteria counter to collect your freshly prepared meal.",
        },
        {
            question: "Received the wrong item?",
            solution: "We sincerely apologize for the oversight! If the item you collected does not match your digital receipt, please show your bill to the cafeteria staff immediately. They will gladly replace it for you on the spot.",
        },
        {
            question: "I want to cancel the order?",
            solution: "To cancel an order, please contact the cafeteria staff at the counter immediately. They can cancel it for you, provided the kitchen hasn't started preparing your food. Cancellations cannot be processed once preparation has begun.",
        },
        {
            question: "There is a missing item in my order",
            solution: "Please cross-verify your tray contents with your digital receipt. If an item is missing, simply return to the counter and notify the staff. They will provide the missing item to you right away.",
        }
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
            question: "Unable to login to my account",
            solution: "Please ensure your internet connection is stable and you are using the correct credentials. If the issue persists, try clearing the application's cache data or reinstalling the app for a fresh instance.",
        },
        {
            question: "Need to update phone number or email",
            solution: "For maximum security, modifying your primary contact details requires administrative verification. Please submit a request below, and our support infrastructure team will manually process the update.",
        },
    ],
    "App Issues": [
        {
            question: "App is crashing",
            solution: "Please try clearing the app cache or updating the app to the latest version from the Play Store/App Store. Restarting your phone can also help.",
        },
        {
            question: "Menu not loading",
            solution: "This usually happens due to a poor internet connection. Try turning your Wi-Fi or mobile data off and on again, or pull down to refresh the page.",
        },
        {
            question: "QR Scanner not working",
            solution: "Ensure you have granted camera permissions to the app. You can verify this in your phone's settings under Apps > Booking App > Permissions.",
        },
        {
            question: "Location not detecting",
            solution: "Please check if your device's GPS/Location service is turned on and that the app has permission to access your location.",
        }
    ],
    "Other": [
        {
            question: "I have a different issue (describe below)",
            solution: "Our intelligent support system is here to help! Please describe your issue in the text box below. Our dedicated support team will review your ticket and provide a tailored resolution promptly.",
        },
    ],
};

// ============================================
// ADMIN-SPECIFIC SUPPORT CATEGORIES
// ============================================
const ADMIN_SUPPORT_CATEGORIES = {
    "Order Management": [
        {
            question: "Customer says order not received but status shows completed",
            solution: "Please verify the order timeline in the Order History section. If the order was marked as 'Completed' or 'Ready', the customer should have collected it within 20 minutes. Check the pickup timestamp and confirm with your cafeteria staff if the order was physically collected.",
        },
        {
            question: "How to cancel a customer's order?",
            solution: "Go to the active orders section, find the customer's order, and tap the cancel button. You can only cancel orders that haven't started preparation. Once the kitchen has begun preparing, cancellation is not possible through the app.",
        },
        {
            question: "Order stuck in 'Preparing' status",
            solution: "This usually happens when the order status wasn't updated after preparation. Go to the order and manually update its status to 'Ready' or 'Completed'. If the order is stuck and you cannot update it, try refreshing the orders page.",
        },
        {
            question: "Customer requesting a refund",
            solution: "Navigate to the order in Order History, and use the Refund option. The refund will be processed through the original payment method. If you encounter issues processing the refund, please submit a ticket below.",
        },
    ],
    "Payment & Refunds": [
        {
            question: "Customer's payment received but order not created",
            solution: "This is a payment-order sync issue. Our team will need to verify the payment gateway logs and manually create or refund the order. Please provide the customer details below.",
            requiresContactDetails: true,
        },
        {
            question: "Refund not reflecting in customer's account",
            solution: "Refunds typically take 3-5 business days to reflect. If it's been longer, our team will need to check the payment gateway. Please submit a ticket with the order details.",
            requiresContactDetails: true,
        },
        {
            question: "Daily sales report showing incorrect amounts",
            solution: "Please verify if all orders for the day have been properly marked as completed. Cancelled orders and refunded orders may affect the totals. If the discrepancy persists after verification, submit a ticket below.",
        },
        {
            question: "UPI/Payment gateway errors",
            solution: "Payment gateway issues require backend investigation. Please provide the details and timestamps so our team can check the gateway logs.",
            requiresContactDetails: true,
        },
    ],
    "Menu Management": [
        {
            question: "Unable to add or edit menu items",
            solution: "Ensure you have a stable internet connection. Try refreshing the menu page. If items still can't be added, clear the app cache and try again. Make sure item names don't contain special characters that aren't supported.",
        },
        {
            question: "Category visibility toggle not working",
            solution: "The category visibility toggle controls what customers see on the user app. After toggling, wait a few seconds for the changes to sync. If it still doesn't reflect, try toggling it off and on again, then refresh.",
        },
        {
            question: "Menu items showing wrong prices",
            solution: "Go to Menu Management, find the item, and update the price. Changes will be reflected in the user app immediately. If you're unable to edit the price, try deleting and re-adding the item.",
        },
        {
            question: "Deleted items still appearing for customers",
            solution: "After deleting menu items, it may take a few seconds for the cache to clear. Ask the customer to pull-to-refresh or restart their app. If the issue persists, submit a ticket below.",
        },
    ],
    "App & Technical": [
        {
            question: "Admin app is crashing",
            solution: "Please try clearing the app cache from your phone's settings, or update to the latest version from the Play Store/App Store. Restart your device and try again.",
        },
        {
            question: "Printer not connecting",
            solution: "Ensure your thermal printer is powered on and Bluetooth is enabled on your device. Go to Printer Setup in Settings and try re-pairing the printer. Make sure you're within Bluetooth range (typically 10 meters).",
        },
        {
            question: "Real-time orders not appearing",
            solution: "This is usually a connectivity issue. Check your internet connection and make sure notifications are enabled for the app. Try closing and reopening the app. If orders are still not appearing in real-time, check if your cafeteria status is set to 'Open'.",
        },
        {
            question: "QR code scanner not working",
            solution: "Ensure camera permissions are granted to the app. Go to your phone's Settings > Apps > Admin App > Permissions and enable Camera. Restart the app and try again.",
        },
    ],
    "Other": [
        {
            question: "I have a different issue (describe below)",
            solution: "Please describe your issue in the text box below. Our dedicated support team will review your ticket and provide a resolution as soon as possible.",
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
// GET ADMIN SUPPORT CATEGORIES (for admin app)
// ============================================
export const getAdminSupportCategories = async (req, res) => {
    try {
        return res.json({
            success: true,
            categories: ADMIN_SUPPORT_CATEGORIES,
        });
    } catch (error) {
        console.error("❌ getAdminSupportCategories ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// CREATE SUPPORT TICKET (user submits)
// ============================================
export const createSupportTicket = async (req, res) => {
    try {
        const userId = req.user.id;
        const { category, question, description, platform, source } = req.body;

        if (!category || !question) {
            return res.status(400).json({
                success: false,
                message: "Category and question are required",
            });
        }

        // Use admin or user categories depending on source
        const categories = source === "admin" ? ADMIN_SUPPORT_CATEGORIES : SUPPORT_CATEGORIES;

        // Validate category exists
        if (!categories[category]) {
            return res.status(400).json({
                success: false,
                message: "Invalid category",
            });
        }

        // Validate question exists in category
        const questionObj = categories[category].find(q => q.question === question);
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
