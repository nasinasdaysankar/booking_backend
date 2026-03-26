-- Migration 006: Drop entirely unused tables
-- Run AFTER migration 005 and AFTER taking a full database backup.
-- Safe to run multiple times (IF EXISTS guards every statement).

-- upi_payments: entire upiController.js is commented out; no frontend ever calls it
DROP TABLE IF EXISTS upi_payments;

-- notifications: Notification model was never imported in models/index.js;
-- no controller, route, or frontend references it
DROP TABLE IF EXISTS notifications;

-- notifications_system: exported as Notification but never queried anywhere;
-- no .create(), .findAll(), or .findOne() calls exist
DROP TABLE IF EXISTS notifications_system;

-- system_alerts: imported in superadminRoutes.js but never queried;
-- no .create() or .findAll() calls exist anywhere
DROP TABLE IF EXISTS system_alerts;
