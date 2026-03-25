import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,

  // ============================================
  // 🔧 OPTIMIZED FOR DEVELOPMENT STABILITY
  // ============================================
  pool: {
    max: 10, // 🔧 Optimized for shared cloud proxies
    min: 1,  // 🟢 Keep at least 1 alive to avoid DNS re-lookup
    acquire: 30000,
    idle: 30000, // ⏳ Increased to prevent connection flickers
  },

  dialectOptions: {
    keepAlive: true,
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
    connectTimeout: 30000,
  },
});

export default sequelize;
