import { Sequelize } from "sequelize";

const useSSL = process.env.DB_SSL === "true";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,

  // ============================================
  // 🔧 OPTIMIZED FOR DEVELOPMENT STABILITY
  // ============================================
  pool: {
    max: 50,      // ✅ Increased from 10 to 50 to handle more concurrent requests
    min: 2,       // ✅ Keep at least 2 connections alive to avoid cold start latency
    acquire: 45000, // ✅ Increased from 30s to 45s for more headroom
    idle: 10000,  
    evict: 5000,  
  },

  dialectOptions: {
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...(useSSL && {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }),
    connectTimeout: 30000,
    statement_timeout: 30000,
  },
});

export default sequelize;
