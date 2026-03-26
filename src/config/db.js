import dotenv from "dotenv";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : process.env.NODE_ENV === "test"
      ? ".env.test"
      : ".env.local";

dotenv.config({ path: envFile });

import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,

  // ============================================
  // 🔧 OPTIMIZED FOR DEVELOPMENT STABILITY
  // ============================================
  pool: {
    max: 10,
    min: 0,       // Allow pool to drain fully — avoids keeping stale connections alive
    acquire: 30000,
    idle: 10000,  // Evict idle connections after 10s (Railway proxy drops them at ~30s)
    evict: 5000,  // Check for idle connections every 5s
  },

  dialectOptions: {
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
    connectTimeout: 30000,
    statement_timeout: 30000,
  },
});

export default sequelize;
