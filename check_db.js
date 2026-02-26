
import { sequelize, OrderFeedback, AppFeedback } from "./src/models/index.js";

async function checkTables() {
    try {
        const [results] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("All Tables:", results.map(r => r.table_name || r.TABLE_NAME));

        console.log("OrderFeedback Model Table Name:", OrderFeedback.getTableName());
        console.log("AppFeedback Model Table Name:", AppFeedback.getTableName());

        process.exit(0);
    } catch (err) {
        console.error("Error checking tables:", err);
        process.exit(1);
    }
}

checkTables();
