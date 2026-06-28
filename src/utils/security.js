import { SystemSetting } from "../models/index.js";

/**
 * Checks if a given email is whitelisted in system_settings for bypassing geo-boundary/checks.
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export const checkIfEmailIsBypassed = async (email) => {
  if (!email) return false;
  try {
    const setting = await SystemSetting.findOne({ where: { key: "APP_BYPASS_EMAILS" } });
    if (!setting || !setting.value) return false;
    
    // Support comma-separated emails
    const emails = setting.value.split(",").map(e => e.trim().toLowerCase());
    return emails.includes(email.trim().toLowerCase());
  } catch (error) {
    console.error("❌ Error checking APP_BYPASS_EMAILS:", error);
    return false;
  }
};
