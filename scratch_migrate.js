import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres:mgYwgaeYwwTPIWzdovtddxHFwMeUlcFd@crossover.proxy.rlwy.net:41322/railway'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    await client.query('ALTER TABLE affiliate_products ALTER COLUMN title TYPE TEXT');
    await client.query('ALTER TABLE affiliate_products ALTER COLUMN image_url TYPE TEXT');
    await client.query('ALTER TABLE affiliate_products ALTER COLUMN affiliate_link TYPE TEXT');
    
    console.log('Successfully updated affiliate_products columns to TEXT');
  } catch (error) {
    console.error('Error updating columns:', error);
  } finally {
    await client.end();
  }
}

run();
