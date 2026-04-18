import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from the parent directory
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: true,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function migrate() {
  try {
    console.log('--- Database Migration Started ---');
    
    // Check if columns exist before adding
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cafeterias' 
      AND (column_name = 'is_pure_veg' OR column_name = 'promo_image_url_2');
    `);

    const existingColumns = results.map(r => r.column_name);

    if (!existingColumns.includes('is_pure_veg')) {
      console.log('Adding column: is_pure_veg');
      await sequelize.query('ALTER TABLE cafeterias ADD COLUMN is_pure_veg BOOLEAN DEFAULT false;');
    } else {
      console.log('Column is_pure_veg already exists.');
    }

    if (!existingColumns.includes('promo_image_url_2')) {
      console.log('Adding column: promo_image_url_2');
      await sequelize.query('ALTER TABLE cafeterias ADD COLUMN promo_image_url_2 TEXT;');
    } else {
      console.log('Column promo_image_url_2 already exists.');
    }

    console.log('--- Migration Completed Successfully ---');
  } catch (error) {
    console.error('Migration Failed:', error);
  } finally {
    await sequelize.close();
  }
}

migrate();
