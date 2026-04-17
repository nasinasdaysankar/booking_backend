import { sequelize, SupportTicket, User, Admin, SupportMessage, UserFcmToken, AdminFcmToken } from "../models/index.js";
import { sendNotification, sendPushNotification } from "../utils/notificationUtils.js";
import { emitSupportMessage } from "../socket.js";
import path from "path";

// ============================================
// PREDEFINED SUPPORT CATEGORIES, QUESTIONS & SOLUTIONS
// ============================================
const SUPPORT_CATEGORIES = {
    "Order Issues": [
        {
            question: "My order is stuck in 'Preparing' status for too long",
            solution: "We apologize for the delay! Order preparation time depends on the cafeteria's current workload. If your order has been in 'Preparing' status for more than 15 minutes, this could be due to high demand or a temporary kitchen delay. You can visit the counter and show your digital token. If the issue persists, our team will look into it.",
        },
        {
            question: "I picked up my order but the app still shows it as 'Ready'",
            solution: "The order status updates automatically once the cafeteria staff scans or marks it as collected. If the status hasn't changed within a few minutes, try pulling down to refresh your order history. The status discrepancy doesn't affect your order record.",
        },
        {
            question: "I received the wrong item",
            solution: "We sincerely apologize for the mix-up! Please return to the cafeteria counter immediately and show your digital receipt/bill. The staff will replace the wrong item with the correct one. If you've already left, please submit this ticket and our team will follow up with the cafeteria.",
        },
        {
            question: "An item is missing from my order",
            solution: "Please cross-check all items in your tray against your digital bill. If an item is indeed missing, return to the counter and notify the staff — they will provide the missing item right away. If you cannot go back, submit this ticket and we'll coordinate with the cafeteria.",
        },
        {
            question: "I want to cancel my order",
            solution: "Orders can only be cancelled before the cafeteria begins preparation. Please visit the cafeteria counter as quickly as possible and inform the staff. Once preparation has started, cancellation is not possible. For future orders, you can check your order status and act promptly.",
        },
        {
            question: "My order was marked as expired or cancelled automatically",
            solution: "Orders are automatically cancelled if not collected within the designated buffer time after they become 'Ready'. This is done to ensure food freshness. Unfortunately, refunds for expired orders follow the standard refund policy — please submit a ticket and our team will review your case.",
        },
        {
            question: "I see an order in my history that I didn't place",
            solution: "If you notice an unauthorized order under your account, please do not ignore it. This could indicate an account security issue. Change your password immediately and contact our support team by submitting a ticket. We will investigate the transaction and take appropriate action.",
        },
    ],
    "Payment Issues": [
        {
            question: "Payment was deducted but my order was not placed",
            solution: "This can happen due to a temporary network interruption between your bank and our payment gateway. In most cases, the amount is automatically refunded within 3-5 business days. Our team will need to manually verify this with the payment gateway. Please provide your contact details so we can follow up with you directly.",
            requiresContactDetails: true,
        },
        {
            question: "I was charged twice for the same order",
            solution: "A double charge usually occurs due to a network timeout causing your bank to retry the payment. Please provide your contact details below. Our team will verify both transactions in the payment gateway logs and initiate a refund for the duplicate charge within 3-5 business days.",
            requiresContactDetails: true,
        },
        {
            question: "My refund has not been received",
            solution: "Refunds typically take 3-7 business days to reflect in your account, depending on your bank. If it has been longer than that, our team will need to check the refund status with the payment gateway. Please share your contact details so we can investigate and provide an update.",
            requiresContactDetails: true,
        },
        {
            question: "My UPI payment is stuck or pending",
            solution: "A UPI payment stuck in 'Pending' state usually resolves automatically within 24 hours. If the money was debited but the order was not placed, it will be refunded. If it hasn't resolved, our team will manually check the gateway logs. Please provide your contact details below.",
            requiresContactDetails: true,
        },
        {
            question: "I paid but the payment screen shows an error",
            solution: "If you encountered an error screen but the payment was deducted from your account, please don't attempt to pay again. Our system logs all payment attempts. Provide your contact details and we will verify the transaction status and ensure your order is processed or refunded.",
            requiresContactDetails: true,
        },
        {
            question: "I want to request a refund for my order",
            solution: "Refunds are processed on a case-by-case basis depending on the reason. If the cafeteria did not provide your ordered items or made an error, you may be eligible for a refund. Please provide your contact details so our team can review your order and initiate the refund process.",
            requiresContactDetails: true,
        },
    ],
    "Account Issues": [
        {
            question: "I am unable to login to my account",
            solution: "Please check that your internet connection is stable. Ensure you are entering the correct mobile number or email and password. If you've forgotten your password, use the 'Forgot Password' option on the login screen. If the issue persists after trying these steps, try reinstalling the app.",
        },
        {
            question: "I forgot my password",
            solution: "Tap the 'Forgot Password' button on the login screen. Enter your registered email address and you will receive a password reset link. Check your spam folder if you don't see the email in your inbox. Complete the reset process and you should be able to log in with your new password.",
        },
        {
            question: "My account has been locked or suspended",
            solution: "Accounts may be temporarily suspended due to suspicious activity or repeated failed login attempts. Please submit this ticket with your registered email/phone and our team will review your account status and assist you in restoring access.",
        },
        {
            question: "I need to update my phone number or email",
            solution: "For security reasons, updating primary contact details requires manual verification by our team. Please go to your Profile page to update basic details. For changes to your registered phone/email, submit a ticket and our team will guide you through the verification process.",
        },
        {
            question: "My profile picture or name is not updating",
            solution: "Go to your Profile page and tap the edit button. Make your changes and ensure you press 'Save'. If you're updating a profile picture, ensure your internet connection is stable during the upload. If the update still doesn't save, try logging out and back in.",
        },
        {
            question: "I want to delete my account",
            solution: "Account deletion is a permanent action and cannot be undone. Before proceeding, ensure you have collected any pending orders. To request account deletion, please submit this ticket with your registered email address. Our team will process the deletion and confirm via email.",
        },
    ],
    "App Issues": [
        {
            question: "The app is crashing or freezing",
            solution: "Please try the following steps: (1) Force close the app and reopen it. (2) Clear the app's cache from your phone settings. (3) Check if your phone's storage is full. (4) Update the app to the latest version from the Play Store or App Store. (5) If none of these work, try reinstalling the app.",
        },
        {
            question: "The menu is not loading or is empty",
            solution: "This is usually caused by a slow or unstable internet connection. Try the following: (1) Check your Wi-Fi or mobile data connection. (2) Pull down on the menu screen to refresh. (3) Toggle your Wi-Fi off and on again. (4) Close and reopen the app. If the menu still doesn't load, the cafeteria may be temporarily closed.",
        },
        {
            question: "I cannot see my order history",
            solution: "Pull down on the Order History page to refresh. Ensure you are connected to the internet. If you've recently logged in on a new device, your history may take a moment to sync. If history is still missing, try logging out and back in. Your order data is saved on our servers and is never lost.",
        },
        {
            question: "Notifications are not working",
            solution: "Please check: (1) Notification permissions for the app in your phone's Settings > Apps > [App Name] > Notifications. (2) Ensure 'Do Not Disturb' mode is not active. (3) Make sure the app is updated to the latest version. (4) On some Android phones, you may need to disable battery optimization for the app.",
        },
        {
            question: "The QR code scanner is not working",
            solution: "Ensure the app has camera permission: go to Phone Settings > Apps > [App Name] > Permissions > Camera and enable it. Also make sure your camera lens is clean and you're holding the device steady. If the scanner still doesn't work, try restarting the app.",
        },
        {
            question: "My location is not being detected",
            solution: "Please ensure: (1) Your device's Location/GPS is turned on. (2) The app has location permission (Settings > Apps > [App Name] > Permissions > Location). (3) Set location mode to 'High Accuracy' for best results. If you're indoors, GPS may be less accurate — try moving closer to a window.",
        },
        {
            question: "Images and media are not loading",
            solution: "Image loading issues are typically caused by a slow internet connection. Try switching between Wi-Fi and mobile data. Ensure you have enough storage space on your device. Clearing the app cache can also help load images faster. If a specific item has no image, it may not have been added by the cafeteria.",
        },
    ],
    "Other": [
        {
            question: "I have a different issue (describe below)",
            solution: "No problem! Our support team is ready to help with any issue you have. Please describe your problem in detail in the text box below. Include any relevant information such as order ID, time of incident, and screenshots if possible. Our team will get back to you as soon as possible.",
        },
    ],
};

// ============================================
// ADMIN-SPECIFIC SUPPORT CATEGORIES
// ============================================
const ADMIN_SUPPORT_CATEGORIES = {
    "Order Management": [
        {
            question: "A customer says their order was not received but app shows 'Completed'",
            solution: "Please check the order's detailed timeline in the Order History section. Verify the 'Completed' or 'Ready' timestamp. If the order was marked complete but the customer claims they didn't receive it, check with your cafeteria staff if the order was physically prepared and placed at the counter. If confirmed as an error, please submit a ticket for our team to process a refund.",
        },
        {
            question: "How do I update an order's status manually?",
            solution: "Go to the Orders section and find the specific order. Tap on it to open the order details. You will see options to update its status (e.g., from 'Preparing' to 'Ready'). Tap the appropriate status button and confirm. The customer's app will update in real-time. Only update statuses when they accurately reflect the kitchen's progress.",
        },
        {
            question: "An order is stuck in 'Preparing' status",
            solution: "This typically happens when the kitchen completes an order but the status isn't updated in the app. Go to the Order details and manually mark it as 'Ready'. If you are unable to update the status due to an app error, try refreshing the orders page or restarting the app. If the issue persists, submit a ticket.",
        },
        {
            question: "A customer is requesting a refund for their order",
            solution: "Navigate to the relevant order in Order History. Check if the order qualifies for a refund based on your cafeteria's policy (wrong item, missing item, not prepared etc.). If eligible, our support team processes refunds manually through the payment gateway. Submit a ticket with the Order ID and reason, and our team will action the refund.",
        },
        {
            question: "Multiple orders came in at once and I'm overwhelmed",
            solution: "The app displays all active orders in real-time. You can prioritize orders by their placement time. If the volume is too high, consider temporarily closing new orders from the app settings (Cafeteria Status toggle). Once you've caught up, switch the status back to 'Open'. If you need longer-term capacity management features, submit feedback via this ticket.",
        },
        {
            question: "A customer's order was auto-cancelled but they're at the counter",
            solution: "Orders auto-cancel if not collected within the buffer window. If the customer is present but the order was just cancelled, please check if the food was already prepared. If it was, use your discretion to serve them. Submit a ticket with the order ID if you feel the cancellation was in error, and our team will review and process a refund if applicable.",
        },
    ],
    "Payment & Refunds": [
        {
            question: "A customer's payment is showing but the order was not created",
            solution: "This is a payment-order sync issue, typically caused by a network interruption. Our backend team needs to verify the payment gateway logs and either manually create the order or process a refund. Please provide the customer's name, approximate order time, and amount so our team can investigate urgently.",
            requiresContactDetails: true,
        },
        {
            question: "A refund was processed but the customer hasn't received it",
            solution: "Refunds take 3-7 business days to reflect in the customer's bank account after being initiated. Please share the Order ID and refund initiation date. Our team will verify the refund status with the payment gateway and provide a tracking reference number to the customer.",
            requiresContactDetails: true,
        },
        {
            question: "My daily revenue report shows incorrect totals",
            solution: "Revenue reports are calculated based on completed orders minus refunds and cancellations. First, verify all orders are correctly marked as 'Completed' and check if any refunds were processed that day. If the discrepancy persists after this check, submit a ticket with the specific date and the expected vs. displayed amounts for our team to investigate.",
        },
        {
            question: "A customer was charged twice for the same order",
            solution: "Double charges occur due to payment gateway retries during network issues. The duplicate amount should be automatically refunded within 24-48 hours by the payment gateway. If it hasn't been refunded, submit a ticket with the order ID and transaction details. Our team will contact the payment gateway to expedite the refund.",
            requiresContactDetails: true,
        },
        {
            question: "Payment gateway showing errors during peak hours",
            solution: "Payment gateway errors during peak hours can be caused by high transaction volume or temporary gateway downtime. Check the gateway's status page if available. These usually resolve within minutes. If errors persist for more than 30 minutes and are affecting multiple customers, submit a ticket immediately so our team can escalate to the payment gateway provider.",
            requiresContactDetails: true,
        },
    ],
    "Menu Management": [
        {
            question: "I am unable to add a new menu item",
            solution: "Ensure you fill in all required fields: Item Name, Price, Category, and at least one image. Item names should not contain special characters. Check that your internet connection is stable before submitting. If the item still won't save, try using a shorter name or a different image format (JPEG recommended under 5MB).",
        },
        {
            question: "A menu item's price update is not reflecting for customers",
            solution: "After updating a price, the change should reflect for customers within 30-60 seconds. Ask the customer to pull-to-refresh their menu page. Price changes are not cached on the user's device for long. If the old price continues to show after a few minutes, try editing and saving the item again.",
        },
        {
            question: "A deleted item is still appearing for customers",
            solution: "After deletion, it may take up to 1 minute for the change to propagate to all users. Ask the customer to refresh their app. If the item still appears after 5 minutes, try marking the item as 'Unavailable' first if a re-delete doesn't work, and submit a ticket so our team can clear the cache.",
        },
        {
            question: "I cannot toggle a category's visibility on or off",
            solution: "The category visibility toggle in Menu Management controls what customers see. After toggling, wait 5-10 seconds for confirmation. If the toggle snaps back, this could be a UI sync issue. Force close the app, reopen it, and try again. If the problem persists, submit a ticket.",
        },
        {
            question: "Menu item images are not uploading",
            solution: "Ensure the image is under 5MB in size and is in JPEG or PNG format. Check your internet connection — image uploads require a stable connection. If upload fails, try compressing the image first. You can also try a different image. If all images fail to upload, the issue may be server-side and you should submit a ticket.",
        },
        {
            question: "Stock levels are not updating after I mark an item as out of stock",
            solution: "After marking an item as unavailable/out-of-stock, the change should reflect immediately. Try refreshing the menu management page. If the item still shows as available after a minute, try toggling the availability off, saving, and then re-checking. Submit a ticket if the stock status continues to be incorrect.",
        },
    ],
    "App & Technical": [
        {
            question: "The admin app is crashing or freezing",
            solution: "Please try the following steps in order: (1) Force close the app and reopen it. (2) Clear the app cache from Phone Settings > Apps > Admin App > Storage. (3) Check if your device storage is full. (4) Update the app to the latest version from the Play Store/App Store. (5) Restart your device. If crashes continue, submit a ticket with details of when it crashes.",
        },
        {
            question: "New customer orders are not appearing in real-time",
            solution: "Real-time order updates depend on a stable internet connection and active socket connection. Check: (1) Your internet connection is active. (2) The app is not in battery-saving mode (this can kill background connections). (3) Notifications are enabled for the app. (4) Your cafeteria status is set to 'Open'. Try closing and reopening the app to re-establish the socket connection.",
        },
        {
            question: "I cannot log in to the admin panel",
            solution: "Verify your admin credentials are correct. If you've forgotten your password, contact your system administrator. Ensure your device's date and time are set correctly (authentication tokens can fail with wrong time settings). If login fails consistently, submit a ticket with your admin email — do not share your password.",
        },
        {
            question: "The thermal printer is not connecting or printing",
            solution: "Check: (1) The printer is powered on and has paper loaded. (2) Bluetooth is enabled on your device. (3) The printer is within Bluetooth range (within 10 meters). Go to Settings > Printer Setup and try re-pairing the device. If the printer was connected before, try 'Forget' and re-add it. Submit a ticket if the printer still won't connect after these steps.",
        },
        {
            question: "Push notifications for new orders are not working",
            solution: "Check: (1) Notification permissions for the admin app: Settings > Apps > Admin App > Notifications — ensure all are enabled. (2) Disable battery optimization for the app: Settings > Battery > Battery Optimization > Admin App > Don't Optimize. (3) Make sure the app is updated. (4) Try logging out and back in to refresh the notification token.",
        },
        {
            question: "The dashboard analytics or charts are not loading",
            solution: "Dashboard analytics require a stable internet connection to fetch data. Try pulling down to refresh the dashboard. If charts remain empty, check if the date range you've selected has any data. Try switching to a different date range and back. If the issue persists after refreshing, submit a ticket.",
        },
    ],
    "Other": [
        {
            question: "I have a different issue (describe below)",
            solution: "Please describe your issue in detail in the text box below. Include relevant information such as the feature affected, when the issue started, and what you were trying to do when it occurred. Our dedicated support team will review your ticket and provide a resolution as soon as possible.",
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
// CREATE SUPPORT TICKET (user/admin submits)
// ============================================
export const createSupportTicket = async (req, res) => {
    try {
        const userId = req.user.id;
        const { category, question, description, platform, source } = req.body;
        const senderType = source || "user";

        if (!category || !question) {
            return res.status(400).json({
                success: false,
                message: "Category and question are required",
            });
        }

        console.log(`🔍 Validating ticket submission: Source=${senderType}, Category=${category}, Question=${question}`);

        // Use admin or user categories depending on source
        const categories = senderType === "admin" ? ADMIN_SUPPORT_CATEGORIES : SUPPORT_CATEGORIES;

        // Validate category exists
        if (!categories[category]) {
            console.warn(`⚠️ Unknown category submitted: ${category}. Defaulting to 'Other'.`);
        }

        // Validate question exists in category
        const currentCategory = categories[category] || categories["Other"];
        const questionObj = currentCategory.find(q => q.question === question);
        
        if (!questionObj) {
            console.warn(`⚠️ Question mismatch: "${question}" not found in category "${category}". Proceeding anyway.`);
        }

        const ticket = await sequelize.transaction(async (t) => {
            const newTicket = await SupportTicket.create({
                userId,
                category: category || "Other",
                question: question || "Unknown Question",
                description: description || "",
                platform: platform || "Unknown",
                source: senderType,
                status: "open",
            }, { transaction: t });

            console.log(`🎫 New support ticket #${newTicket.id} from ${senderType} ${userId}: ${category} → ${question}`);

            // 💬 Create the initial message in the thread
            const firstMessageText = description ? `${question}\n\nDetails: ${description}` : question;
            await SupportMessage.create({
                ticketId: newTicket.id,
                senderId: userId,
                senderType,
                message: firstMessageText,
            }, { transaction: t });

            return newTicket;
        });

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
        const userType = req.user.userType || "user"; // "user" or "admin"

        const tickets = await SupportTicket.findAll({
            where: { 
                userId,
                source: userType 
            },
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
// GET ALL TICKETS (admin/owner view) - User side tickets
// ============================================
export const getAllTickets = async (req, res) => {
    try {
        const { status, category } = req.query;

        const where = { source: 'user' };
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
// GET ALL TICKETS (admin/owner view) - Admin side tickets
// ============================================
export const getAdminSupportTickets = async (req, res) => {
    try {
        const { status, category } = req.query;

        const where = { source: 'admin' };
        if (status) where.status = status;
        if (category) where.category = category;

        const tickets = await SupportTicket.findAll({
            where,
            include: [
                {
                    model: Admin,
                    as: "admin",
                    attributes: ["id", "name", "staffId", "role"],
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
        console.error("❌ getAdminSupportTickets ERROR:", error.message);
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

        // 💬 Add admin response as a message in the thread
        await SupportMessage.create({
            ticketId: id,
            senderId: 0, // 0 for superadmin/owner
            senderType: "owner",
            message: adminResponse || `Status updated to ${ticket.status}`,
        });

        // Increment user unread count for the message
        ticket.userUnreadCount = (ticket.userUnreadCount || 0) + 1;
        await ticket.save();


        // 🔔 Send push notification
        const notifyUser = async () => {
            try {
                const ticketSource = ticket.source || 'user';
                const notifTitle = ticket.status === 'resolved' ? '✅ Support Ticket Resolved' : '💬 Support Ticket Update';
                const notifBody = adminResponse ? adminResponse.substring(0, 100) : `Your ticket has been marked as ${ticket.status}`;

                let tokens = [];
                if (ticketSource === 'admin') {
                    const adminTokens = await AdminFcmToken.findAll({ where: { adminId: ticket.userId } });
                    tokens = adminTokens.map(t => t.fcmToken);
                } else {
                    const userTokens = await UserFcmToken.findAll({ where: { userId: ticket.userId } });
                    tokens = userTokens.map(t => t.fcmToken);
                }

                if (tokens.length > 0) {
                    await sendPushNotification(tokens, notifTitle, notifBody, {
                        type: "SUPPORT_UPDATE",
                        ticketId: id.toString(),
                        category: ticket.category,
                    }, ticket.userId, ticketSource === 'admin');
                }

                // 🌐 Real-time socket update
                emitSupportMessage(id, {
                    type: "SUPPORT_UPDATE",
                    ticketId: id,
                    status: ticket.status,
                    message: adminResponse || `Status updated to ${ticket.status}`
                });
            } catch (err) {
                console.error("❌ Notification error in resolveTicket:", err.message);
            }
        };

        notifyUser();

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
        const { isSolved } = req.body;
        const currentUserId = req.user.id;
        const currentUserType = req.user.userType; // "user" or "admin"

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        // Security: Ensure only the creator of the ticket can verify it
        if (ticket.userId !== currentUserId || ticket.source !== currentUserType) {
            return res.status(403).json({ success: false, message: "Unauthorized access to this ticket" });
        }

        // Update ticket status
        if (isSolved) {
            ticket.status = "resolved";
            ticket.ownerRequestedConfirmation = false;
        } else {
            ticket.status = "in_progress"; 
            ticket.ownerRequestedConfirmation = false;
        }

        await ticket.save();

        // 💬 Add user response as a message in the thread
        const feedbackMsg = isSolved 
            ? "✅ Yes, my issue is solved. Thank you!" 
            : "❌ No, the issue is still persistent.";
            
        await SupportMessage.create({
            ticketId: id,
            senderId: currentUserId,
            senderType: currentUserType, 
            message: feedbackMsg,
        });

        // Increment owner unread count for user feedback
        ticket.ownerUnreadCount = (ticket.ownerUnreadCount || 0) + 1;
        await ticket.save();

        return res.json({
            success: true,
            message: `Response recorded: Issue ${isSolved ? 'solved' : 'reopened'}`,
            ticket
        });
    } catch (error) {
        console.error("❌ verifyTicketResolution ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// ADD MESSAGE TO TICKET (Conversational)
// ============================================
export const addTicketMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, mediaUrl1, mediaUrl2 } = req.body;
        const senderId = req.user.id;

        // Determine senderType from user object/role
        let senderType = "user";
        if (req.user.role === "superadmin") senderType = "owner";
        else if (req.user.role === "admin" || req.user.role === "vendor") senderType = "admin";

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        // Check permissions: users/admins can only reply to their own tickets
        const isRequestOwner = ticket.userId === senderId && ticket.source === req.user.userType;
        if (senderType !== "owner" && !isRequestOwner) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        // Check media permissions (limit to 2 as per requirement)
        const hasMedia = mediaUrl1 || mediaUrl2;
        if (hasMedia && senderType !== "owner" && !ticket.isMediaEnabled) {
            return res.status(403).json({ success: false, message: "Media uploads are not enabled for this ticket. Please contact support to enable them." });
        }

        const newMessage = await SupportMessage.create({
            ticketId: id,
            senderId,
            senderType,
            message,
            mediaUrl1: mediaUrl1 || null,
            mediaUrl2: mediaUrl2 || null,
        });

        // Update ticket status and unread counts
        if (senderType === "owner") {
            if (ticket.status === "open") {
                ticket.status = "in_progress";
            }
            ticket.userUnreadCount += 1;
        } else {
            ticket.ownerUnreadCount += 1;
        }
        await ticket.save();


        // 🔔 Send Push Notification to the other party
        const notifyOtherParty = async () => {
            try {
                let tokens = [];
                let title = "💬 New Support Message";
                let body = message.substring(0, 100) + (message.length > 100 ? "..." : "");

                console.log(`🔍 [NOTIFY] Attempting to notify other party for ticket ${id}. Source: ${ticket.source}, Sender: ${senderType}`);

                if (senderType === "owner") {
                    // Notify User or Admin
                    if (ticket.source === "admin") {
                        console.log(`🔍 [NOTIFY] Fetching Admin tokens for adminId: ${ticket.userId}`);
                        const adminTokens = await AdminFcmToken.findAll({ where: { adminId: ticket.userId } });
                        tokens = adminTokens.map(t => t.fcmToken);
                        console.log(`🔍 [NOTIFY] Found ${tokens.length} Admin tokens.`);
                    } else {
                        console.log(`🔍 [NOTIFY] Fetching User tokens for userId: ${ticket.userId}`);
                        const userTokens = await UserFcmToken.findAll({ where: { userId: ticket.userId } });
                        tokens = userTokens.map(t => t.fcmToken);
                        console.log(`🔍 [NOTIFY] Found ${tokens.length} User tokens.`);
                    }
                } else {
                    console.log(`🔍 [NOTIFY] Ticket creator (${senderType}) replied. Superadmin dashboard update via socket.`);
                }

                if (tokens.length > 0) {
                    await sendPushNotification(tokens, title, body, {
                        type: "SUPPORT_MESSAGE",
                        ticketId: id.toString(),
                        category: ticket.category || "Support",
                    }, ticket.userId, ticket.source === 'admin');
                } else if (senderType === "owner") {
                    console.log(`⚠️ [NOTIFY] No tokens found for recipient ${ticket.userId} (source: ${ticket.source})`);
                }

                // 🌐 Real-time socket update for everyone in the ticket room
                emitSupportMessage(id, {
                    type: "SUPPORT_MESSAGE",
                    ticketId: id,
                    message: newMessage,
                });

            } catch (err) {
                console.error("❌ Notification error in addTicketMessage:", err.message);
            }
        };

        notifyOtherParty(); // Fire and forget

        return res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: newMessage,
        });
    } catch (error) {
        console.error("❌ addTicketMessage ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// GET TICKET MESSAGES (Thread history)
// ============================================
export const getTicketMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const currentId = req.user.id;
        const userRole = req.user.role;
        const userType = req.user.userType; // "user" or "admin"

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        const isSuperadmin = userRole === "superadmin" || userRole === "owner";
        const isRequestOwner = ticket.userId === currentId && ticket.source === userType;

        // Check permissions
        if (!isSuperadmin && !isRequestOwner) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        // Reset unread counts for the viewer
        if (isSuperadmin) {
            if (ticket.ownerUnreadCount > 0) {
                ticket.ownerUnreadCount = 0;
                await ticket.save();
            }
        } else {
            if (ticket.userUnreadCount > 0) {
                ticket.userUnreadCount = 0;
                await ticket.save();
            }
        }

        const messages = await SupportMessage.findAll({
            where: { ticketId: id },
            order: [["createdAt", "ASC"]],
        });

        return res.json({
            success: true,
            data: messages,
            ticket: {
                isMediaEnabled: ticket.isMediaEnabled,
                ownerRequestedConfirmation: ticket.ownerRequestedConfirmation,
                status: ticket.status
            }
        });
    } catch (error) {
        console.error("❌ getTicketMessages ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ============================================
// TOGGLE MEDIA PERMISSION (superadmin only)
// ============================================
export const toggleMedia = async (req, res) => {
    try {
        const { id } = req.params;
        const { isMediaEnabled } = req.body;

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        ticket.isMediaEnabled = isMediaEnabled;
        await ticket.save();

        // 🔔 Notify User/Admin about media permission toggle
        const notifyToggle = async () => {
            try {
                const title = "🛠️ Support Ticket Update";
                const body = `Media uploads have been ${isMediaEnabled ? 'ENABLED' : 'DISABLED'} for your ticket #${id}`;
                
                let tokens = [];
                if (ticket.source === "admin") {
                    const adminTokens = await AdminFcmToken.findAll({ where: { adminId: ticket.userId } });
                    tokens = adminTokens.map(t => t.fcmToken);
                } else {
                    const userTokens = await UserFcmToken.findAll({ where: { userId: ticket.userId } });
                    tokens = userTokens.map(t => t.fcmToken);
                }

                if (tokens.length > 0) {
                    await sendPushNotification(tokens, title, body, {
                        type: "SUPPORT_MEDIA_TOGGLE",
                        ticketId: id.toString(),
                        isMediaEnabled: isMediaEnabled.toString()
                    }, ticket.userId, ticket.source === 'admin');
                }

                // 🌐 Real-time socket update for media toggle
                emitSupportMessage(id, {
                    type: "SUPPORT_MEDIA_TOGGLE",
                    ticketId: id,
                    isMediaEnabled: isMediaEnabled,
                    message: `Media uploads have been ${isMediaEnabled ? "enabled" : "disabled"} for this ticket.`
                });
            } catch (err) {
                console.error("❌ Notification error in toggleMedia:", err.message);
            }
        };

        notifyToggle();

        return res.json({
            success: true,
            message: `Media support ${isMediaEnabled ? "enabled" : "disabled"} successfully`,
        });
    } catch (error) {
        console.error("❌ toggleMedia ERROR:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};
