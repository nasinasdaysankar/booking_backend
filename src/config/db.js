import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,

  // 🔥 VERY IMPORTANT FOR LOAD
  pool: {
    max: 20,        // max DB connections
    min: 5,         // keep some alive
    acquire: 30000, // max time to get connection
    idle: 10000,    // release idle connections
  },

  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, 
    },
  },
});

export default sequelize;
