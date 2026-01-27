import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,

  // ============================================
  // 🔥 OPTIMIZED FOR 700-1000 CONCURRENT USERS
  // ============================================
  pool: {
    max: 100,        // ✅ Increased from 20 → handles more concurrent connections
    min: 20,         // ✅ Increased from 5 → keeps more connections alive
    acquire: 60000,  // ✅ Increased from 30s → wait longer before failing
    idle: 30000,     // ✅ Increased from 10s → keep idle connections longer
  },

  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

export default sequelize;
