import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Accept Railway-style envs too (PGURL/PG*). If DATABASE_URL is not set,
// fall back to individual vars.
const urlFromEnv = process.env.DATABASE_URL || process.env.PGURL;
const databaseUrl =
  urlFromEnv ||
  `postgresql://${process.env.DATABASE_USER || process.env.PGUSER}:${
    process.env.DATABASE_PASSWORD || process.env.PGPASSWORD
  }@${process.env.DATABASE_HOST || process.env.PGHOST}:${
    process.env.DATABASE_PORT || process.env.PGPORT || 5432
  }/${process.env.DATABASE_NAME || process.env.PGDATABASE}`;

// Decide when to force SSL: any hosted URL (non-localhost) or explicit flags.
const useSsl = (() => {
  if (process.env.DB_SSL === "false") return false;
  if (process.env.DB_SSL === "true") return true;
  if (process.env.PGSSLMODE === "require") return true;
  return Boolean(
    urlFromEnv && !databaseUrl.toLowerCase().includes("localhost")
  );
})();

// Log the target without exposing credentials to help debug on Railway.
try {
  const parsed = new URL(databaseUrl);
  console.log(
    `Connecting to database: ${useSsl ? "Production (SSL)" : "Local (No SSL)"} -> ${parsed.hostname}:${parsed.port}/${parsed.pathname.slice(
      1
    )}`
  );
} catch {
  console.log(
    `Connecting to database: ${useSsl ? "Production (SSL)" : "Local (No SSL)"}`
  );
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: useSsl
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

export default sequelize;