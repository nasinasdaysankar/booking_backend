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
    max: 20,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },

  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

export default sequelize;
