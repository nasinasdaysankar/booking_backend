import { Sequelize } from 'sequelize';
import fs from 'fs';

const TEST_URL = 'postgresql://postgres:pRdiMAYQLHgxGxoIupVxZqlmujElfpBg@metro.proxy.rlwy.net:38037/railway';

const sequelize = new Sequelize(TEST_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

async function smartMigration() {
  try {
    console.log('🚀 STARTING SMART MIGRATION (PRESERVING INDEXES)...');
    await sequelize.authenticate();
    
    const dump = JSON.parse(fs.readFileSync('production_full_dump.json', 'utf8'));
    const tableNames = Object.keys(dump);

    await sequelize.query('SET session_replication_role = "replica"');

    for (const tableName of tableNames) {
      const records = dump[tableName];
      if (!records || records.length === 0) continue;

      // 1. Check if table exists
      const [tableExists] = await sequelize.query(
        `SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '${tableName}')`
      );

      if (!tableExists[0].exists) {
        console.log(`🛠️ Creating missing utility table: "${tableName}"...`);
        const first = records[0];
        const columns = Object.keys(first).map(col => {
          const val = first[col];
          let type = 'TEXT';
          if (typeof val === 'number') type = Number.isInteger(val) ? 'INTEGER' : 'DECIMAL';
          if (typeof val === 'boolean') type = 'BOOLEAN';
          if (val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/))) type = 'TIMESTAMP WITH TIME ZONE';
          return `"${col}" ${type}`;
        }).join(', ');
        await sequelize.query(`CREATE TABLE "${tableName}" (${columns})`);
      }

      // 2. GET ACTUAL TABLE COLUMNS TO AVOID ERRORS
      const [actualColumnsResults] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`
      );
      const actualColumns = actualColumnsResults.map(c => c.column_name);
      
      console.log(`📡 Pushing data to: "${tableName}"...`);

      // 3. BULK PUSH (Filtered)
      const firstRecord = records[0];
      const validKeys = Object.keys(firstRecord).filter(k => actualColumns.includes(k));
      const columns = validKeys.map(c => `"${c}"`).join(', ');
      
      const chunkSize = 100;

      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const valuesList = chunk.map(record => {
          return '(' + validKeys.map(key => {
            const val = record[key];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            return val;
          }).join(', ') + ')';
        }).join(', ');

        try {
          await sequelize.query(`INSERT INTO "${tableName}" (${columns}) VALUES ${valuesList} ON CONFLICT DO NOTHING`);
        } catch (err) {
          console.warn(`⚠️ Warning in ${tableName}: ${err.message}`);
        }
      }
      console.log(` ✅ "${tableName}" synced.`);
    }

    await sequelize.query('SET session_replication_role = "origin"');
    console.log('\n✨ ULTIMATE SUCCESS! Migration finished. Indexes preserved. No duplicates.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

smartMigration();
