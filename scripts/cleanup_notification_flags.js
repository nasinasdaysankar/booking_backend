/**
 * Cleanup Script: Reset notification flags for old orders
 * 
 * This script sets notification flags to TRUE for orders that have already
 * passed their notification thresholds, preventing old orders from 
 * triggering new notifications after the code update.
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const runCleanup = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

        // 1. Mark orders older than 10 mins in READY status as "reminder sent"
        const result1 = await client.query(`
      UPDATE orders 
      SET "tenMinReminderSent" = true 
      WHERE status = 'READY' 
      AND "updatedAt" < $1 
      AND "tenMinReminderSent" = false;
    `, [tenMinutesAgo]);

        console.log(`📧 Marked ${result1.rowCount} orders as "10-min reminder sent"`);

        // 2. Mark orders older than 20 mins in READY status as "expiration sent"
        const result2 = await client.query(`
      UPDATE orders 
      SET "expirationNotificationSent" = true 
      WHERE status = 'READY' 
      AND "updatedAt" < $1 
      AND "expirationNotificationSent" = false;
    `, [twentyMinutesAgo]);

        console.log(`📧 Marked ${result2.rowCount} orders as "expiration notification sent"`);

        console.log('\n✅ Cleanup completed successfully!');
        console.log('Old orders will NOT trigger duplicate notifications.');

    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
};

// Run the cleanup
runCleanup()
    .then(() => {
        console.log('\n✨ All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Cleanup error:', error);
        process.exit(1);
    });
