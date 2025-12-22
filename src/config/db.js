import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Determine if we are running on Railway or locally
const isProduction = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

const databaseUrl = process.env.DATABASE_URL || 
  `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`;

console.log(`Connecting to database: ${isProduction ? "Production (SSL)" : "Local (No SSL)"}`);

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: isProduction ? {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  } : {}, // No SSL for local development
});

export default sequelize;