import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'src/firebase-admin.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

console.log("Testing Firebase Admin SDK initialization...");

admin.auth().listUsers(1)
  .then((listUsersResult) => {
    console.log("✅ SUCCESS: Firebase Admin SDK is successfully authenticated!");
    console.log("Retrieved users count:", listUsersResult.users.length);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ FAILURE: Firebase Admin SDK authentication failed.");
    console.error("Error Code:", err.code);
    console.error("Error Message:", err.message);
    process.exit(1);
  });
