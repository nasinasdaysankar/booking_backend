// src/config/firebaseAdmin.js
import admin from "firebase-admin";
import { wrapMessaging } from "./notificationGuard.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct path to JSON
const serviceAccountPath = path.join(__dirname, "../firebase-admin.json");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin initialized");

  // 🛡️ Apply Safety Guard
  wrapMessaging(admin.messaging());
}

export default admin;
