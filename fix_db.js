import sequelize from "./src/config/db.js";

async function fixDatabase() {
  try {
    console.log("Checking for missing column 'total_order_number' in 'orders' table...");
    
    // Add the column if it doesn't exist
    await sequelize.query(`
      ALTER TABLE "orders" 
      ADD COLUMN IF NOT EXISTS "total_order_number" INTEGER;
    `);
    
    console.log("✅ Column 'total_order_number' ensured in 'orders' table.");

    // Also ensure the counter table exists (redundant but safe)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS total_order_counters (
        counter_name VARCHAR(50) PRIMARY KEY,
        counter INTEGER DEFAULT 0
      );
    `);
    console.log("✅ Table 'total_order_counters' ensured.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to fix database:", error);
    process.exit(1);
  }
}
//uday
fixDatabase();
