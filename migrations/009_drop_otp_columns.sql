-- Migration 009: Drop OTP columns from users and orders tables
-- Run after shifting OTP handling to Valkey/Redis cache database.
-- Safe to run multiple times.

-- Drop OTP columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS otpcode;
ALTER TABLE users DROP COLUMN IF EXISTS otpexpiry;

-- Drop OTP columns from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_otp;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_otp_expires_at;
