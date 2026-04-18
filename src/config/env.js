import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 📂 Centralized Environment Loader
 * This module ensures the correct .env file is loaded based on NODE_ENV
 * and provides a fallback mechanism.
 */

const env = process.env.NODE_ENV || "development";

// Priority order for environment files
const envFiles = [
  `.env.${env}.local`,
  `.env.${env}`,
  `.env.local`,
  `.env`,
];

let loadedPath = null;

console.log(`🔍 [ENV] Initializing environment (NODE_ENV=${env})...`);

for (const file of envFiles) {
  const fullPath = path.resolve(__dirname, "../../", file);
  
  // Try loading the file
  const result = dotenv.config({ path: fullPath, override: true });
  
  if (!result.error) {
    loadedPath = file;
    console.log(`✅ [ENV] Loaded configuration from: ${file}`);
    break; // Load first matching file in priority list
  }
}

if (!loadedPath) {
  console.warn(`⚠️ [ENV] No environment files found. Using system environment variables.`);
}

export default {
  env,
  loadedPath,
};
