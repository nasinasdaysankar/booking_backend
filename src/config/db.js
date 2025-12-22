import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not set!");
  process.exit(1);
}

console.log(`🔗 Attempting to connect to database...`);

// Determine if we should use SSL
// Use SSL only if it's a remote Railway host, not localhost
const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
const shouldUseSSL = !isLocalhost;

console.log(`📍 Connection type: ${isLocalhost ? "Local (No SSL)" : "Remote (SSL)"}`);

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: shouldUseSSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

sequelize
  .authenticate()
  .then(() => {
    console.log("✅ Database connected successfully!");
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });

export default sequelize;