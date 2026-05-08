
import { AdminFcmToken } from "../src/models/index.js";

async function checkTokens() {
  try {
    const tokens = await AdminFcmToken.findAll();
    console.log(`\n🔍 Total Admin Tokens: ${tokens.length}`);
    tokens.forEach(t => {
      console.log(`📍 Cafeteria: ${t.cafeteriaId}, Token: ${t.fcmToken.substring(0, 20)}..., Device: ${t.deviceName || 'unknown'}`);
    });
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

checkTokens();
