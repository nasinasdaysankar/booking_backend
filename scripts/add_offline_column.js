import "dotenv/config";
import sequelize from "../src/config/db.js";

const addColumn = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    console.log("🛠 Checking for is_offline column...");
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cafeterias' AND column_name = 'is_offline';
    `);

    if (results.length === 0) {
      console.log("➕ Adding is_offline column to cafeterias table...");
      await sequelize.query(`
        ALTER TABLE cafeterias 
        ADD COLUMN is_offline BOOLEAN DEFAULT FALSE;
      `);
      console.log("✅ Column added successfully");
    } else {
      console.log("ℹ️ Column is_offline already exists");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error adding column:", err.message);
    process.exit(1);
  }
};

addColumn();
