import admin from "../config/firebaseAdmin.js";
import { User, UserFcmToken, AdminFcmToken } from "../models/index.js";

/**
 * Centralized Notification Helper
 * Handles FCM token lifecycle (cleanup and uninstall detection)
 */

/**
 * Send a notification to a single token and handle errors
 */
export const sendNotification = async (message, userId, isAdmin = false) => {
    try {
        const response = await admin.messaging().send(message);
        return { success: true, response };
    } catch (error) {
        if (userId) {
            await handleFcmError(error, message.token, userId, isAdmin);
        }
        return { success: false, error };
    }
};

/**
 * Robust notification helper for controllers
 * Handles token arrays, titles, bodies, and data payload
 */
export const sendPushNotification = async (tokens, title, body, data = {}, userId = null, isAdmin = false, channelId = null) => {
    try {
        if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) return;

        const tokenList = Array.isArray(tokens) ? tokens : [tokens];
        
        const message = {
            notification: { title, body },
            data: data,
            tokens: tokenList,
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    channelId: channelId || (isAdmin ? "high_importance_channel_v2" : "high_importance_channel"),
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                    },
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        
        // Cleanup failed tokens
        const cleanupPromises = response.responses.map(async (res, idx) => {
            if (!res.success) {
                const token = tokenList[idx];
                await handleFcmError(res.error, token, userId, isAdmin);
            }
        });

        await Promise.all(cleanupPromises);
        return response;
    } catch (error) {
        console.error("❌ sendPushNotification ERROR:", error.message);
        return null;
    }
};

/**
 * Send batch notifications and handle individual token failures
 */
export const sendBatchNotifications = async (messages, userTokens, isAdmin = false) => {
    try {
        const response = await admin.messaging().sendEach(messages);
        
        // Iterate through responses to find failures
        const cleanupPromises = response.responses.map(async (res, idx) => {
            if (!res.success) {
                const token = messages[idx].token;
                const userId = userTokens[idx].userId;
                await handleFcmError(res.error, token, userId, isAdmin);
            }
        });

        await Promise.all(cleanupPromises);
        return response;
    } catch (error) {
        console.error("❌ FCM Batch error:", error.message);
        throw error;
    }
};

/**
 * Send a notification to multiple tokens and handle individual failures
 */
export const sendMulticastNotification = async (multicastMessage, userTokenMap, isAdmin = false) => {
    try {
        const response = await admin.messaging().sendEachForMulticast(multicastMessage);
        
        // Iterate through responses to find failures
        const cleanupPromises = response.responses.map(async (res, idx) => {
            if (!res.success) {
                const token = multicastMessage.tokens[idx];
                const userId = userTokenMap[token];
                if (userId) {
                    await handleFcmError(res.error, token, userId, isAdmin);
                }
            }
        });

        await Promise.all(cleanupPromises);
        return response;
    } catch (error) {
        console.error("❌ FCM Multicast error:", error.message);
        throw error;
    }
};

/**
 * Handle FCM specific errors like uninstalls or invalid tokens
 */
const handleFcmError = async (error, token, userId, isAdmin = false) => {
    const errorCode = error?.code || error?.errorInfo?.code;
    
    const isUninstallError = 
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/third-party-auth-error';

    if (isUninstallError) {
        console.log(`🗑️ Detected uninstall/invalid token for ${isAdmin ? 'Admin' : 'User'} ${userId}. Cleaning up...`);
        
        if (isAdmin) {
            // Cleanup Admin tokens (Admins don't have isUninstalled flag currently, just delete token)
            await AdminFcmToken.destroy({ where: { fcmToken: token } });
        } else {
            // 1. Delete the invalid token
            await UserFcmToken.destroy({ where: { fcmToken: token } });

            // 2. Check if user has any remaining tokens
            const remainingTokens = await UserFcmToken.count({ where: { userId } });
            
            if (remainingTokens === 0) {
                // 3. If no tokens left, mark user as uninstalled
                await User.update({
                    isUninstalled: true,
                    uninstalledAt: new Date()
                }, {
                    where: { id: userId }
                });
                console.log(`📉 User ${userId} marked as UNINSTALLED (0 tokens remaining)`);
            }
        }
    } else {
        console.error(`❌ FCM error for ${isAdmin ? 'Admin' : 'User'} ${userId}:`, errorCode);
    }
};
