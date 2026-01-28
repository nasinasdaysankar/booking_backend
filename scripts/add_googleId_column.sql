-- Migration: Add googleId column to users table
-- Run this script to add the googleId field for Google authentication tracking
-- This column stores the Firebase UID for users who sign in with Google

-- Check if column exists before adding (PostgreSQL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'googleId'
    ) THEN
        ALTER TABLE users ADD COLUMN "googleId" VARCHAR(255) NULL;
        RAISE NOTICE 'Added googleId column to users table';
    ELSE
        RAISE NOTICE 'googleId column already exists';
    END IF;
END $$;
