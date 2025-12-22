import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:NewStrongPassword123@localhost:5432/booking_db";

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: process.env.DATABASE_URL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
});

export default sequelize;
