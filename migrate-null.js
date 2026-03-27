import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { sequelize } from './src/models/index.js';

async function migrate() {
  try {
    console.log("🚀 Altering orders table for cashfreeorderid nullability...");
    await sequelize.query('ALTER TABLE orders ALTER COLUMN cashfreeorderid DROP NOT NULL;');
    console.log("✅ Success! cashfreeorderid is now nullable.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

migrate();
