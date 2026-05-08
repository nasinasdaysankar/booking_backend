/**
 * 🔒 Notification Safeguard (Guard)
 * Prevents development environment from sending push notifications to real users.
 */

import { User, UserFcmToken, AdminFcmToken, PartnerFcmToken } from "../models/index.js";
import { Op } from "sequelize";

// Load whitelist from env or use defaults
const whitelistEmails = (process.env.DEVELOPER_EMAILS || "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Checks if a destination (token or user email) is safe to send to.
 * @param {string} token - FCM registration token
 * @returns {Promise<boolean>}
 */
const isSafeToMessage = async (token) => {
  if (process.env.NODE_ENV === "production") return true;

  try {
    // 1. Check User Tokens (Strict Email Whitelist)
    const tokenRecord = await UserFcmToken.findOne({
      where: { fcmToken: token },
      include: [{ model: User, attributes: ["email", "originalEmail"] }]
    });

    if (tokenRecord && tokenRecord.User) {
      const email = (tokenRecord.User.email || tokenRecord.User.originalEmail || "").toLowerCase();
      const isWhitelisted = whitelistEmails.includes(email);

      if (isWhitelisted) {
        console.log(`✅ [GUARD] Allowing user notification to whitelisted dev: ${email}`);
        return true;
      } else {
        console.warn(`🛑 [GUARD] BLOCKED notification to production user: ${email}`);
        return false;
      }
    }

    // 2. Check Admin Tokens (Allow in Development for testing)
    const adminToken = await AdminFcmToken.findOne({ where: { fcmToken: token } });
    if (adminToken) {
      console.log(`✅ [GUARD] Allowing admin notification in development mode`);
      return true;
    }

    // 3. Check Partner Tokens (Allow in Development for testing)
    const partnerToken = await PartnerFcmToken.findOne({ where: { fcmToken: token } });
    if (partnerToken) {
      console.log(`✅ [GUARD] Allowing partner notification in development mode`);
      return true;
    }

    console.warn(`🛑 [GUARD] Blocked unknown token: ${token.substring(0, 10)}... (No associated record found)`);
    return false;
  } catch (error) {
    console.error("❌ [GUARD] Error checking safety:", error.message);
    return false; // Error defaults to safe block
  }
};

/**
 * Wraps the Firebase messaging service with security checks
 */
export const wrapMessaging = (messaging) => {
  const originalSend = messaging.send.bind(messaging);
  const originalSendEach = messaging.sendEach.bind(messaging);
  const originalSendEachForMulticast = messaging.sendEachForMulticast.bind(messaging);

  // 1. Single Send
  messaging.send = async (message, dryRun) => {
    if (await isSafeToMessage(message.token)) {
      return originalSend(message, dryRun);
    }
    return "blocked-by-guard"; // Return dummy response
  };

  // 2. Batch Send
  messaging.sendEach = async (messages, dryRun) => {
    if (process.env.NODE_ENV === "production") return originalSendEach(messages, dryRun);

    const safeMessages = [];
    for (const msg of messages) {
      if (await isSafeToMessage(msg.token)) {
        safeMessages.push(msg);
      }
    }

    if (safeMessages.length === 0) {
      return { responses: messages.map(() => ({ success: true, messageId: "blocked" })), successCount: 0, failureCount: 0 };
    }

    return originalSendEach(safeMessages, dryRun);
  };

  // 3. Multicast Send
  messaging.sendEachForMulticast = async (payload, dryRun) => {
    if (process.env.NODE_ENV === "production") return originalSendEachForMulticast(payload, dryRun);

    const safeTokens = [];
    for (const token of payload.tokens) {
      if (await isSafeToMessage(token)) {
        safeTokens.push(token);
      }
    }

    if (safeTokens.length === 0) {
      return { responses: payload.tokens.map(() => ({ success: true, messageId: "blocked" })), successCount: 0, failureCount: 0 };
    }

    return originalSendEachForMulticast({ ...payload, tokens: safeTokens }, dryRun);
  };

  console.log("🛡️ Notification Guard Active (Local Whitelist Mode)");
  return messaging;
};
