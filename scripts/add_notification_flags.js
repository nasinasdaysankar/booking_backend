/**
 * Migration Script: Add Notification Tracking Flags to Orders Table
 * 
 * This script adds two new boolean columns to the orders table:
 * - tenMinReminderSent: Tracks if 10-minute reminder notification was sent
 * - expirationNotificationSent: Tracks if expiration notification was sent
 * 
 * Run this script once to update your database schema.
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Check if columns already exist
        const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('tenMinReminderSent', 'expirationNotificationSent');
    `;

        const checkResult = await client.query(checkQuery);

        if (checkResult.rows.length > 0) {
            console.log('⚠️  Columns already exist. Skipping migration.');
            return;
        }

        // Add the new columns
        console.log('🔧 Adding notification tracking columns...');

        await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS "tenMinReminderSent" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "expirationNotificationSent" BOOLEAN NOT NULL DEFAULT false;
    `);

        console.log('✅ Migration completed successfully!');
        console.log('   - Added column: tenMinReminderSent (BOOLEAN, default: false)');
        console.log('   - Added column: expirationNotificationSent (BOOLEAN, default: false)');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
};

// Run the migration
runMigration()
    .then(() => {
        console.log('\n✨ All done! You can now restart your server.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Migration error:', error);
        process.exit(1);
    });
